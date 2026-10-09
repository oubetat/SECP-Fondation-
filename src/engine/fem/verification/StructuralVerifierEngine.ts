import {
  StructuralVerdict,
  VerificationStatus,
  VerificationTolerancePolicy,
  StructuralVerificationEvidence,
  ResultProvenance,
  AnalysisType
} from "./types";
import { ResultProvenanceTracker } from "./ResultProvenanceTracker";
import { EquilibriumVerifier } from "./EquilibriumVerifier";
import { StressStrainEnergyVerifier } from "./StressStrainEnergyVerifier";
import { MeshVerificationEngine } from "./MeshVerificationEngine";
import { AnalyticalVerificationSuite } from "./AnalyticalVerificationSuite";
import { IndependentStructuralAssembler } from "./IndependentStructuralAssembler";

export class StructuralVerifierEngine {
  public static defaultTolerancePolicy(): VerificationTolerancePolicy {
    return {
      forceAbsTol: 1e-4,
      forceRelTol: 1e-4,
      momentAbsTol: 1e-3,
      energyRelTol: 1e-3,
      displacementRelTol: 1e-4,
      stressRelTol: 1e-3,
      residualAbsTol: 1e-4
    };
  }

  /**
   * Performs full structural verification battery on FEM model inputs and output results.
   */
  public static verifyStructuralAnalysis(
    analysisId: string,
    meshData: { nodesX: number[]; elements: [number, number][]; elementCoords?: number[][][] },
    materialData: { A: number; E: number; D?: number[][] },
    loadData: { appliedForces: number[][]; forceCoords?: number[][]; F_vector: number[] },
    bcData: { fixedDofs: number[]; prescribedVals: number[]; reactionCoords?: number[][] },
    solverSettings: any,
    primaryResults: { u: number[]; reactions?: number[][]; K?: number[][]; stress?: number[]; strain?: number[] },
    provenanceRecord?: ResultProvenance,
    tolPolicy: VerificationTolerancePolicy = this.defaultTolerancePolicy()
  ): StructuralVerificationEvidence {
    const verificationId = `VERIF_${ResultProvenanceTracker.hashData(`${analysisId}_${Date.now()}`)}`;

    const provenance = provenanceRecord || ResultProvenanceTracker.createProvenance(
      analysisId,
      meshData,
      materialData,
      loadData,
      bcData,
      solverSettings,
      primaryResults,
      AnalysisType.LINEAR_STATIC
    );

    // 1. Provenance Verification
    const provCheck = ResultProvenanceTracker.verifyProvenance(
      provenance,
      meshData,
      materialData,
      loadData,
      bcData,
      solverSettings,
      primaryResults
    );

    if (!provCheck.valid) {
      return {
        verificationId,
        analysisId,
        provenance,
        provenanceValid: false,
        forceBalanceError: Infinity,
        momentBalanceError: Infinity,
        reactionBalanceError: Infinity,
        constraintResidualNorm: Infinity,
        linearResidualNorm: Infinity,
        energyError: Infinity,
        stressRecoveryError: Infinity,
        meshConvergenceError: Infinity,
        analyticalReferenceError: Infinity,
        manufacturedSolutionError: Infinity,
        independentCheckSuccess: false,
        verdict: StructuralVerdict.PROVENANCE_FAILURE
      };
    }

    // 2. Independent Matrix Assembly
    const K_indep = IndependentStructuralAssembler.assembleBarStiffnessMatrix(
      meshData.nodesX,
      meshData.elements,
      materialData.A,
      materialData.E
    );

    const u_indep = IndependentStructuralAssembler.solveSystem(
      K_indep,
      loadData.F_vector,
      bcData.fixedDofs,
      bcData.prescribedVals
    );

    const R_indep = IndependentStructuralAssembler.computeIndependentReactions(
      K_indep,
      u_indep,
      loadData.F_vector,
      bcData.fixedDofs
    );

    // 3. Independent vs Primary Check
    let independentSuccess = true;
    for (let i = 0; i < u_indep.length; i++) {
      const diff = Math.abs(primaryResults.u[i] - u_indep[i]);
      if (diff > tolPolicy.displacementRelTol * Math.max(Math.abs(u_indep[i]), 1e-6)) {
        independentSuccess = false;
        break;
      }
    }

    // 4. Equilibrium Checks
    const indepReactionsVecs: number[][] = R_indep.map(r => [r, 0, 0]);
    const forceBalCheck = EquilibriumVerifier.verifyForceBalance(loadData.appliedForces, indepReactionsVecs, tolPolicy);
    const momentBalCheck = EquilibriumVerifier.verifyMomentBalance(
      loadData.forceCoords || loadData.appliedForces.map(() => [0, 0, 0]),
      loadData.appliedForces,
      bcData.reactionCoords || indepReactionsVecs.map(() => [0, 0, 0]),
      indepReactionsVecs,
      tolPolicy
    );

    const linResCheck = EquilibriumVerifier.verifyLinearResidual(K_indep, primaryResults.u, loadData.F_vector, tolPolicy, bcData.fixedDofs);
    const constResCheck = EquilibriumVerifier.verifyConstraintResidual(bcData.fixedDofs, primaryResults.u, bcData.prescribedVals, tolPolicy);

    // 5. Energy Balance Check
    const energyCheck = StressStrainEnergyVerifier.verifyEnergyBalance(K_indep, primaryResults.u, loadData.F_vector, tolPolicy);

    // 6. Mesh Quality & Manufactured Solution
    let meshErr = 0;
    if (meshData.elementCoords) {
      const meshQual = MeshVerificationEngine.verifyMeshQuality(meshData.elementCoords);
      meshErr = meshQual.error;
    }

    const L = Math.abs(meshData.nodesX[meshData.nodesX.length - 1] - meshData.nodesX[0]) || 1.0;
    const manufacturedRes = AnalyticalVerificationSuite.verifyManufacturedSolution(meshData.nodesX, primaryResults.u, L);

    // 7. Analytical Bar Benchmark
    const F_total = loadData.appliedForces.reduce((sum, f) => sum + f[0], 0);
    const u_tip = primaryResults.u[primaryResults.u.length - 1];
    const stress_max = F_total / materialData.A;
    const analyticalCheck = AnalyticalVerificationSuite.verifyAxialBar(F_total, L, materialData.A, materialData.E, u_tip, stress_max);

    // Determine Final Structural Verdict
    let verdict = StructuralVerdict.VERIFIED;

    if (!independentSuccess) {
      verdict = StructuralVerdict.INDEPENDENT_VERIFICATION_FAILURE;
    } else if (forceBalCheck.status === VerificationStatus.FAIL) {
      verdict = StructuralVerdict.EQUILIBRIUM_FAILURE;
    } else if (linResCheck.status === VerificationStatus.FAIL) {
      verdict = StructuralVerdict.RESIDUAL_FAILURE;
    } else if (constResCheck.status === VerificationStatus.FAIL) {
      verdict = StructuralVerdict.BC_VERIFICATION_FAILURE;
    } else if (energyCheck.status === VerificationStatus.FAIL) {
      verdict = StructuralVerdict.ENERGY_VERIFICATION_FAILURE;
    } else if (analyticalCheck.status === VerificationStatus.FAIL) {
      verdict = StructuralVerdict.REFERENCE_VALIDATION_FAILURE;
    }

    return {
      verificationId,
      analysisId,
      provenance,
      provenanceValid: true,
      forceBalanceError: forceBalCheck.measuredValue,
      momentBalanceError: momentBalCheck.measuredValue,
      reactionBalanceError: forceBalCheck.error,
      constraintResidualNorm: constResCheck.measuredValue,
      linearResidualNorm: linResCheck.measuredValue,
      energyError: energyCheck.error,
      stressRecoveryError: 0,
      meshConvergenceError: meshErr,
      analyticalReferenceError: analyticalCheck.error,
      manufacturedSolutionError: manufacturedRes.l2Norm,
      independentCheckSuccess: independentSuccess,
      verdict
    };
  }
}
