/**
 * PATCH-SECP-075.4: Adversarial, Anti-Cheating & Clean-Room Mutation Engine
 * Implements:
 * 1. Blind / Hidden Mutation Testing (verifier blind to injection type)
 * 2. Multi-tier Negative Control Suite (Valid, Near-Valid, Sub-Threshold, Boundary-Invalid, Corrupt, NaN/Inf)
 * 3. Mutation Provenance Ledger (Baseline Hash, Mutated Input Hash, Invariant tracking, Verifier Version)
 */

import { SECP075LinearAlgebra } from './SECP075LinearAlgebra';
import { ConstitutiveMatrixEngine } from '../structural-physics/ConstitutiveMatrixEngine';
import { ElementFormulationEngine } from '../structural-physics/ElementFormulationEngine';
import { ShapeFunctionIsoparametricEngine } from '../structural-physics/ShapeFunctionIsoparametricEngine';
import { MeshNode, MeshElement, FEAMesh, BoundaryCondition, LoadDefinition } from '../structural-physics/StructuralPhysicsTypes';
import { GlobalAssemblyEngine } from '../structural-physics/GlobalAssemblyEngine';
import { SECP075CryptographicChain } from './SECP075CryptographicChain';

export interface MutationProvenanceEntry {
  mutationId: string;
  name: string;
  mutationType: string;
  mutationDescription: string;
  baselineHash: string;
  mutatedInputHash: string;
  expectedFailureInvariant: string;
  observedFailureInvariant: string;
  verifierVersion: string;
  detected: boolean;
  verdictConsistent: boolean;
  details: string;
}

export interface NegativeControlEntry {
  tier: 'VALID' | 'NEAR_VALID' | 'SUB_THRESHOLD' | 'BOUNDARY_INVALID' | 'CORRUPT_ABOVE_THRESHOLD' | 'NAN_INF';
  description: string;
  injectedPerturbation: number;
  tolerance: number;
  expectedPass: boolean;
  actualPass: boolean;
  verdictConsistent: boolean;
  measuredMetric: number;
  details: string;
}

export interface BlindMutationResult {
  candidateId: string;
  blindPayloadHash: string;
  injectedDefectType: string;
  detectedDefectType: string;
  correctlyIdentified: boolean;
  details: string;
}

export interface AdversarialSuiteResult {
  passed: boolean;
  provenanceHash: string;
  mutations: MutationProvenanceEntry[];
  negativeControls: NegativeControlEntry[];
  blindMutations: BlindMutationResult[];
  summary: string;
}

export class SECP075AdversarialEngine {
  private static readonly VERIFIER_VERSION = 'SECP-075.4-CLEANROOM';

  /**
   * Runs the complete suite of adversarial mutation injections, blind tests, and negative-control calibration.
   */
  public static runAdversarialSuite(): AdversarialSuiteResult {
    const mutations: MutationProvenanceEntry[] = [];

    // 1. Asymmetry Perturbation Injection
    mutations.push(this.testAsymmetryInjection());

    // 2. Inverted Jacobian / Crossed Element Geometry
    mutations.push(this.testInvertedJacobianInjection());

    // 3. Material Corruption Injection
    mutations.push(this.testMaterialCorruptionInjection());

    // 4. Singular / Unsupported Nullspace Detection
    mutations.push(this.testSingularNullspaceDetection());

    // 5. Penalty Independence / Dirichlet Elimination Contrast
    mutations.push(this.testPenaltyContaminationDetection());

    // 6. Blind Mutation Tests (Validator does not know mutation type beforehand)
    const blindMutations = this.runBlindMutationSuite();

    // 7. Multi-Tier Negative Control Calibration Suite
    const negativeControls = this.runNegativeControlSuite();

    const allMutationsPassed = mutations.every(m => m.detected && m.verdictConsistent);
    const allBlindPassed = blindMutations.every(b => b.correctlyIdentified);
    const allNegativeControlsPassed = negativeControls.every(n => n.verdictConsistent);

    const passed = allMutationsPassed && allBlindPassed && allNegativeControlsPassed;

    // Cryptographic audit provenance hash for the entire adversarial suite
    const provenanceHash = SECP075CryptographicChain.hashString(
      JSON.stringify({ mutations, negativeControls, blindMutations, v: this.VERIFIER_VERSION })
    );

    return {
      passed,
      provenanceHash: `SECP075-ADV-${provenanceHash}`,
      mutations,
      negativeControls,
      blindMutations,
      summary: passed
        ? `Adversarial Clean-Room Gate passed: ${mutations.length} mutations rejected, ${blindMutations.length} blind defects identified, ${negativeControls.length} negative controls calibrated.`
        : 'Adversarial vulnerability detected in clean-room verification gate.'
    };
  }

  private static testAsymmetryInjection(): MutationProvenanceEntry {
    const mutationId = 'MUT-ASYM-001';
    const nodes: MeshNode[] = [
      { id: 1, x: 0, y: 0, z: 0, dofIndices: [] },
      { id: 2, x: 1, y: 0, z: 0, dofIndices: [] },
      { id: 3, x: 1, y: 1, z: 0, dofIndices: [] },
      { id: 4, x: 0, y: 1, z: 0, dofIndices: [] }
    ];
    const element: MeshElement = { id: 1, type: 'QUAD_2D', nodeIds: [1, 2, 3, 4], materialId: 'MAT-STEEL', thickness: 1.0 };
    const K = ElementFormulationEngine.formulateElementStiffness(element, nodes, false);

    const baselineHash = SECP075CryptographicChain.hashString(JSON.stringify(K));

    // Inject subtle asymmetric defect (0.01% perturbation to one off-diagonal term)
    const K_corrupt = K.map(row => [...row]);
    K_corrupt[0][2] += K[0][0] * 1e-4;

    const mutatedInputHash = SECP075CryptographicChain.hashString(JSON.stringify(K_corrupt));

    const error = SECP075LinearAlgebra.symmetryError(K_corrupt);
    const detected = error > 1e-8;

    return {
      mutationId,
      name: 'Adversarial Asymmetry Perturbation',
      mutationType: 'ASYMMETRY',
      mutationDescription: 'Injected 1e-4 off-diagonal asymmetry defect into K',
      baselineHash,
      mutatedInputHash,
      expectedFailureInvariant: 'SYMMETRY_VIOLATION_ERR_GT_1E-8',
      observedFailureInvariant: detected ? `SYMMETRY_VIOLATION_ERR=${error.toExponential(3)}` : 'NONE',
      verifierVersion: this.VERIFIER_VERSION,
      detected,
      verdictConsistent: detected,
      details: `Injected asymmetry error = ${error.toExponential(4)} (Threshold: 1e-8)`
    };
  }

  private static testInvertedJacobianInjection(): MutationProvenanceEntry {
    const mutationId = 'MUT-JACOB-002';
    const baselineNodes: MeshNode[] = [
      { id: 1, x: 0, y: 0, z: 0, dofIndices: [] },
      { id: 2, x: 1, y: 0, z: 0, dofIndices: [] },
      { id: 3, x: 1, y: 1, z: 0, dofIndices: [] },
      { id: 4, x: 0, y: 1, z: 0, dofIndices: [] }
    ];
    const baselineHash = SECP075CryptographicChain.hashString(JSON.stringify(baselineNodes));

    // Invert QUAD4 nodes (clockwise ordering creates negative Jacobian determinant)
    const invertedNodes: MeshNode[] = [
      { id: 1, x: 0, y: 0, z: 0, dofIndices: [] },
      { id: 2, x: 0, y: 1, z: 0, dofIndices: [] },
      { id: 3, x: 1, y: 1, z: 0, dofIndices: [] },
      { id: 4, x: 1, y: 0, z: 0, dofIndices: [] }
    ];
    const mutatedInputHash = SECP075CryptographicChain.hashString(JSON.stringify(invertedNodes));

    let detected = false;
    let detJValue = 0;
    try {
      const evalRes = ShapeFunctionIsoparametricEngine.evaluateQuad4(0, 0, invertedNodes);
      detJValue = evalRes.detJ;
      detected = evalRes.detJ < 0;
    } catch {
      detected = true;
    }

    return {
      mutationId,
      name: 'Inverted Element Jacobian Injection',
      mutationType: 'JACOBIAN_INVERSION',
      mutationDescription: 'Clockwise node winding producing det(J) < 0',
      baselineHash,
      mutatedInputHash,
      expectedFailureInvariant: 'NEGATIVE_JACOBIAN_DET_J_LT_0',
      observedFailureInvariant: detected ? `NEGATIVE_JACOBIAN_DET_J=${detJValue.toFixed(4)}` : 'NONE',
      verifierVersion: this.VERIFIER_VERSION,
      detected,
      verdictConsistent: detected,
      details: detected ? `Negative Jacobian det(J)=${detJValue.toFixed(4)} accurately flagged.` : 'Inverted geometry went undetected.'
    };
  }

  private static testMaterialCorruptionInjection(): MutationProvenanceEntry {
    const mutationId = 'MUT-MAT-003';
    const baselineMaterial = { youngsModulus: 200e9, poissonsRatio: 0.3, density: 7850, yieldStrength: 250e6 };
    const baselineHash = SECP075CryptographicChain.hashString(JSON.stringify(baselineMaterial));

    const corruptCases = [
      { youngsModulus: -200e9, poissonsRatio: 0.3 },
      { youngsModulus: 200e9, poissonsRatio: 0.501 },
      { youngsModulus: 200e9, poissonsRatio: -1.01 },
      { youngsModulus: 200e9, poissonsRatio: NaN }
    ];
    const mutatedInputHash = SECP075CryptographicChain.hashString(JSON.stringify(corruptCases));

    let allRejected = true;
    for (const c of corruptCases) {
      try {
        ConstitutiveMatrixEngine.validateMaterial({
          id: 'CORRUPT',
          name: 'Corrupt',
          youngsModulus: c.youngsModulus,
          poissonsRatio: c.poissonsRatio,
          density: 7850,
          yieldStrength: 250e6
        });
        allRejected = false;
      } catch {
        // Correctly thrown
      }
    }

    return {
      mutationId,
      name: 'Adversarial Material Parameter Corruption',
      mutationType: 'MATERIAL_CORRUPTION',
      mutationDescription: 'Injected negative E, nu > 0.5, nu < -1.0, and NaN',
      baselineHash,
      mutatedInputHash,
      expectedFailureInvariant: 'PHYSICAL_THERMODYNAMIC_STABILITY_FAILURE',
      observedFailureInvariant: allRejected ? 'REJECTED_THERMODYNAMIC_INVARIANTS' : 'UNCAUGHT_CORRUPTION',
      verifierVersion: this.VERIFIER_VERSION,
      detected: allRejected,
      verdictConsistent: allRejected,
      details: allRejected ? 'All 4 non-physical material invariants rejected.' : 'Non-physical material bypassed validation.'
    };
  }

  private static testSingularNullspaceDetection(): MutationProvenanceEntry {
    const mutationId = 'MUT-SING-004';
    const mesh: FEAMesh = {
      nodes: [
        { id: 1, x: 0, y: 0, z: 0, dofIndices: [] },
        { id: 2, x: 1, y: 0, z: 0, dofIndices: [] },
        { id: 3, x: 2, y: 0, z: 0, dofIndices: [] }
      ],
      elements: [
        { id: 1, type: 'BAR_1D', nodeIds: [1, 2], materialId: 'MAT-STEEL', crossSectionArea: 0.01 },
        { id: 2, type: 'BAR_1D', nodeIds: [2, 3], materialId: 'MAT-STEEL', crossSectionArea: 0.01 }
      ],
      qualityMetrics: { aspectRatioMin: 1, aspectRatioMax: 1, jacobianDeterminantMin: 1, isValid: true }
    };
    const baselineHash = SECP075CryptographicChain.hashString(JSON.stringify(mesh));

    // No boundary conditions applied
    const unconstrained = GlobalAssemblyEngine.assembleReducedSystem(mesh, [], []);
    const dense = Array.from({ length: 3 }, (_, i) =>
      Array.from({ length: 3 }, (_, j) => unconstrained.K.get(i, j))
    );
    const mutatedInputHash = SECP075CryptographicChain.hashString(JSON.stringify(dense));

    // Cholesky SPD must fail on singular unconstrained stiffness
    const spd = SECP075LinearAlgebra.choleskySPD(dense);
    const detected = !spd.positiveDefinite;

    return {
      mutationId,
      name: 'Unconstrained Singular Nullspace Detection',
      mutationType: 'SINGULAR_NULLSPACE',
      mutationDescription: 'Assembled unconstrained structure with rigid body modes',
      baselineHash,
      mutatedInputHash,
      expectedFailureInvariant: 'NON_POSITIVE_DEFINITE_CHOLESKY_FAIL',
      observedFailureInvariant: detected ? 'NON_POSITIVE_DEFINITE_CHOLESKY_FAIL' : 'FALSE_SPD_PASS',
      verifierVersion: this.VERIFIER_VERSION,
      detected,
      verdictConsistent: detected,
      details: detected ? 'Cholesky factorization correctly detected singular/non-SPD unconstrained system.' : 'Singular matrix passed as positive definite.'
    };
  }

  private static testPenaltyContaminationDetection(): MutationProvenanceEntry {
    const mutationId = 'MUT-LEAK-005';
    const mesh: FEAMesh = {
      nodes: [
        { id: 1, x: 0, y: 0, z: 0, dofIndices: [] },
        { id: 2, x: 1, y: 0, z: 0, dofIndices: [] }
      ],
      elements: [
        { id: 1, type: 'BAR_1D', nodeIds: [1, 2], materialId: 'MAT-STEEL', crossSectionArea: 0.01 }
      ],
      qualityMetrics: { aspectRatioMin: 1, aspectRatioMax: 1, jacobianDeterminantMin: 1, isValid: true }
    };
    const baselineHash = SECP075CryptographicChain.hashString(JSON.stringify(mesh));

    const bcs: BoundaryCondition[] = [{ id: 'bc1', nodeId: 1, type: 'FIXED', constrainedDOFs: [true] }];
    const loads: LoadDefinition[] = [{ id: 'ld1', nodeId: 2, type: 'FORCE', forceVector: { x: 1000, y: 0, z: 0 } }];

    const reduced = GlobalAssemblyEngine.assembleReducedSystem(mesh, bcs, loads);
    const penalty = GlobalAssemblyEngine.assembleSystem(mesh, bcs, loads);

    const mutatedInputHash = SECP075CryptographicChain.hashString(
      JSON.stringify({ redSize: reduced.K.getSize(), penSize: penalty.K.getSize() })
    );

    const penaltySize = penalty.K.getSize();
    const reducedSize = reduced.K.getSize();

    const detected = penaltySize === 2 && reducedSize === 1 && reduced.freeDOFs.length === 1;

    return {
      mutationId,
      name: 'Dirichlet Reduction vs Penalty Isolation',
      mutationType: 'PENALTY_LEAK',
      mutationDescription: 'Verified exact Dirichlet decoupling from penalty approximation',
      baselineHash,
      mutatedInputHash,
      expectedFailureInvariant: 'EXACT_DOF_DIMENSION_ISOLATION',
      observedFailureInvariant: detected ? 'EXACT_DOF_DIMENSION_ISOLATION' : 'PENALTY_CONTAMINATION',
      verifierVersion: this.VERIFIER_VERSION,
      detected,
      verdictConsistent: detected,
      details: `Reduced DOFs: ${reducedSize}, Penalty Total DOFs: ${penaltySize}. Clean decoupling proven.`
    };
  }

  /**
   * Blind Mutation Testing: Candidate objects with hidden faults are passed to an agnostic inspector.
   * The inspector must classify what invariant is broken without pre-declared hints.
   */
  public static runBlindMutationSuite(): BlindMutationResult[] {
    const results: BlindMutationResult[] = [];

    // Candidate 1: Hidden Asymmetric matrix
    const K1 = [
      [10.0, 2.0, 0.0],
      [2.0001, 10.0, 1.0],
      [0.0, 1.0, 10.0]
    ];
    results.push(this.inspectBlindMatrix('BLIND-CAND-01', K1, 'ASYMMETRY'));

    // Candidate 2: Hidden Indefinite matrix (negative eigenvalue / non-SPD)
    const K2 = [
      [10.0, 12.0],
      [12.0, 10.0]
    ];
    results.push(this.inspectBlindMatrix('BLIND-CAND-02', K2, 'INDEFINITE_NON_SPD'));

    // Candidate 3: Hidden NaN injection
    const K3 = [
      [10.0, NaN],
      [NaN, 10.0]
    ];
    results.push(this.inspectBlindMatrix('BLIND-CAND-03', K3, 'NAN_VALUE'));

    // Candidate 4: Perfectly valid SPD matrix
    const K4 = [
      [10.0, 2.0],
      [2.0, 10.0]
    ];
    results.push(this.inspectBlindMatrix('BLIND-CAND-04', K4, 'VALID_SPD'));

    return results;
  }

  private static inspectBlindMatrix(
    candidateId: string,
    matrix: number[][],
    actualDefect: string
  ): BlindMutationResult {
    const hash = SECP075CryptographicChain.hashString(JSON.stringify(matrix));

    // Blind classification pipeline
    let detectedType = 'VALID_SPD';

    // Step 1: Check NaN/Inf
    let hasNaN = false;
    for (const row of matrix) {
      for (const val of row) {
        if (!Number.isFinite(val)) {
          hasNaN = true;
          break;
        }
      }
    }

    if (hasNaN) {
      detectedType = 'NAN_VALUE';
    } else {
      // Step 2: Check symmetry
      const symErr = SECP075LinearAlgebra.symmetryError(matrix);
      if (symErr > 1e-8) {
        detectedType = 'ASYMMETRY';
      } else {
        // Step 3: Check Cholesky SPD
        const chol = SECP075LinearAlgebra.choleskySPD(matrix);
        if (!chol.positiveDefinite) {
          detectedType = 'INDEFINITE_NON_SPD';
        }
      }
    }

    const correctlyIdentified = detectedType === actualDefect;

    return {
      candidateId,
      blindPayloadHash: hash,
      injectedDefectType: actualDefect,
      detectedDefectType: detectedType,
      correctlyIdentified,
      details: `Blind inspector detected: ${detectedType} (Actual: ${actualDefect})`
    };
  }

  /**
   * Multi-Tier Negative Control Calibration Suite
   * Validates behavior along the entire spectrum:
   * VALID -> PASS
   * NEAR_VALID (1e-14) -> PASS
   * SUB_THRESHOLD (1e-12) -> PASS
   * BOUNDARY_INVALID (1e-7) -> FAIL
   * CORRUPT_ABOVE_THRESHOLD (1e-3) -> FAIL
   * NAN_INF -> FAIL
   */
  public static runNegativeControlSuite(): NegativeControlEntry[] {
    const baseK = [
      [100.0, 20.0],
      [20.0, 100.0]
    ];
    const tol = 1e-10;

    const cases: {
      tier: NegativeControlEntry['tier'];
      description: string;
      perturbation: number;
      expectedPass: boolean;
      injectFn: (k: number[][], p: number) => number[][];
    }[] = [
      {
        tier: 'VALID',
        description: 'Exact unperturbed symmetric SPD matrix',
        perturbation: 0.0,
        expectedPass: true,
        injectFn: (k) => k.map(r => [...r])
      },
      {
        tier: 'NEAR_VALID',
        description: 'Near-valid machine precision perturbation (1e-14)',
        perturbation: 1e-14,
        expectedPass: true,
        injectFn: (k, p) => {
          const res = k.map(r => [...r]);
          res[0][1] += p;
          return res;
        }
      },
      {
        tier: 'SUB_THRESHOLD',
        description: 'Sub-threshold numerical noise (1e-12, within 1e-10 tolerance)',
        perturbation: 1e-12,
        expectedPass: true,
        injectFn: (k, p) => {
          const res = k.map(r => [...r]);
          res[0][1] += p;
          return res;
        }
      },
      {
        tier: 'BOUNDARY_INVALID',
        description: 'Boundary-invalid perturbation (1e-7, strictly exceeds 1e-10 tol)',
        perturbation: 1e-7,
        expectedPass: false,
        injectFn: (k, p) => {
          const res = k.map(r => [...r]);
          res[0][1] += p;
          return res;
        }
      },
      {
        tier: 'CORRUPT_ABOVE_THRESHOLD',
        description: 'Gross corruption (1e-3 perturbation)',
        perturbation: 1e-3,
        expectedPass: false,
        injectFn: (k, p) => {
          const res = k.map(r => [...r]);
          res[0][1] += p;
          return res;
        }
      },
      {
        tier: 'NAN_INF',
        description: 'Non-finite NaN entry injection',
        perturbation: NaN,
        expectedPass: false,
        injectFn: (k) => {
          const res = k.map(r => [...r]);
          res[0][1] = NaN;
          return res;
        }
      }
    ];

    return cases.map(c => {
      const candidate = c.injectFn(baseK, c.perturbation);
      let actualPass = true;
      let metric = 0.0;

      // Evaluate symmetry
      const symErr = SECP075LinearAlgebra.symmetryError(candidate);
      metric = symErr;

      if (!Number.isFinite(symErr) || symErr > tol) {
        actualPass = false;
      }

      const verdictConsistent = actualPass === c.expectedPass;

      return {
        tier: c.tier,
        description: c.description,
        injectedPerturbation: c.perturbation,
        tolerance: tol,
        expectedPass: c.expectedPass,
        actualPass,
        verdictConsistent,
        measuredMetric: Number.isFinite(metric) ? metric : -1,
        details: `Expected: ${c.expectedPass ? 'PASS' : 'FAIL'}, Actual: ${actualPass ? 'PASS' : 'FAIL'} (Measured metric: ${metric.toExponential(3)}, Tol: ${tol.toExponential(1)})`
      };
    });
  }
}
