/**
 * SECP Industrial OS — Engineering Truth OS
 * LinearBucklingAnalysis.ts
 * 
 * SECP-FEM-UPGRADE-006: Linear Buckling Analysis Coordinator Engine.
 * Executes full 2-stage linear elastic buckling analysis workflow:
 * 1. Solves reference linear elastic static load case to recover internal stress/force field.
 * 2. Assembles material stiffness K and geometric stiffness K_G.
 * 3. Enforces boundary conditions via exact direct elimination partitioning.
 * 4. Extracts critical buckling load multipliers lambda_i and mode shapes phi_i via BucklingEigenSolver.
 * 5. Reconstructs full nodal mode shapes and validates convergence residuals.
 */

import { FEMCore } from "../core/FEMCore";
import { DOFComponent, FEMModel } from "../core/FEMTypes";
import { GeometricStiffnessEngine } from "./GeometricStiffnessEngine";
import { BucklingEigenSolver } from "./BucklingEigenSolver";
import { LinearBucklingModeResult, LinearBucklingOptions, LinearBucklingResult } from "./BucklingTypes";

export class LinearBucklingAnalysis {
  private femCore = new FEMCore();
  private geomEngine = new GeometricStiffnessEngine();
  private eigenSolver = new BucklingEigenSolver();

  public runBucklingAnalysis(
    model: FEMModel,
    options: LinearBucklingOptions = {}
  ): LinearBucklingResult {
    const rejectionReasons: string[] = [];

    // 1. Validate inputs and element formulations
    if (!model || model.elements.size === 0) {
      throw new Error(`[EMPTY_MODEL_ERROR] Cannot perform buckling analysis on an empty FEM model.`);
    }

    const supportedFormulations = new Set(["BEAM_2D", "FRAME_2D"]);
    for (const [elemId, elem] of model.elements.entries()) {
      if (!supportedFormulations.has(elem.formulationId)) {
        throw new Error(`[UNSUPPORTED_ELEMENT_FOR_BUCKLING] Formulation '${elem.formulationId}' on element '${elemId}' is not supported for flexural buckling stiffness assembly. Supported formulations: BEAM_2D, FRAME_2D.`);
      }
    }

    const refSol = this.femCore.solve(model, { solverType: 'DIRECT_PARTITIONED' });

    if (!refSol.equilibrium.ok) {
      throw new Error(`[REFERENCE_EQUILIBRIUM_FAILURE] Reference static load case failed equilibrium verification: ${refSol.equilibrium.error}`);
    }

    // 2. Check for compressive stress state
    let totalCompressiveForce = 0;
    let hasCompression = false;

    for (const [elemId, elemRes] of refSol.fields.elementFields.entries()) {
      const N = elemRes.internalForces?.N;
      if (N !== undefined && N < -1e-9) {
        hasCompression = true;
        totalCompressiveForce += Math.abs(N);
      }
    }

    if (!hasCompression) {
      throw new Error(`[NO_COMPRESSIVE_STRESS_STATE] No compressive internal axial force (N < 0) found in model under reference load case. Linear buckling requires a compressive stress field.`);
    }

    // Determine reference load P_ref from total compressive force or applied loads
    let referenceLoad = 0;
    for (const load of model.loads) {
      referenceLoad += Math.abs(load.value);
    }
    if (referenceLoad <= 0) {
      referenceLoad = totalCompressiveForce;
    }

    // 3. Assemble global material stiffness K_sparse and geometric stiffness K_G_sparse
    const dofManager = this.femCore.getDOFManager();
    const bcEngine = this.femCore.getBoundaryConditionEngine();

    const K_material_sparse = refSol.K_sparse;
    const K_geom_sparse = this.geomEngine.assembleGlobalGeometricStiffness(
      model,
      dofManager,
      refSol.fields.elementFields
    );

    // 4. Boundary Condition Partitioning into free DOFs
    const dummyF = new Float64Array(dofManager.getTotalDOFCount());
    const partitionMaterial = bcEngine.partitionSystem(K_material_sparse, dummyF, model, dofManager);
    const partitionGeom = bcEngine.partitionSystem(K_geom_sparse, dummyF, model, dofManager);

    const K_ff_dense = partitionMaterial.K_ff.toDense();
    const K_G_ff_dense = partitionGeom.K_ff.toDense();

    // 5. Solve Generalized Eigenvalue Problem: K_ff * phi_f = lambda * K_G_ff * phi_f
    const rawModes = this.eigenSolver.solveGeneralizedEigenvalue(
      K_ff_dense,
      K_G_ff_dense,
      referenceLoad,
      options
    );

    // 6. Reconstruct full nodal mode shapes
    const fullModes: LinearBucklingModeResult[] = [];
    let allModesVerified = true;

    for (const mode of rawModes) {
      const u_free = mode.modeShapeVector;

      // Reconstruct full displacement vector U_full with zeros for constrained DOFs
      const U_full_vec = bcEngine.reconstructFullDisplacement(new Float64Array(u_free), partitionMaterial);
      const U_full = Array.from(U_full_vec);

      // Map U_full to nodes and DOF components
      const modeShapeMap = new Map<string, { [key in DOFComponent]?: number }>();
      for (const nodeId of model.nodes.keys()) {
        const nodeDisp: { [key in DOFComponent]?: number } = {};
        for (const comp of Object.values(DOFComponent)) {
          const dof = dofManager.getDOF(nodeId, comp);
          if (dof) {
            nodeDisp[comp] = U_full[dof.globalId];
          } else {
            nodeDisp[comp] = 0;
          }
        }
        modeShapeMap.set(nodeId, nodeDisp);
      }

      const verified = mode.verificationStatus === "VERIFIED";
      if (!verified) {
        allModesVerified = false;
        rejectionReasons.push(...mode.rejectionReasons);
      }

      fullModes.push({
        ...mode,
        modeShape: modeShapeMap
      });
    }

    const overallStatus = (allModesVerified && fullModes.length > 0)
      ? "QUALIFIED_WITHIN_DECLARED_SCOPE"
      : "FAILED";

    return {
      modelId: "CANONICAL_MODEL",
      referenceLoadCaseId: "REF_LOAD_CASE_1",
      solverStatus: overallStatus,
      modes: fullModes,
      referenceSol: refSol,
      matrixMetrics: {
        totalDOFs: dofManager.getTotalDOFCount(),
        freeDOFs: partitionMaterial.freeDOFs.length,
        constrainedDOFs: partitionMaterial.constrainedDOFs.length,
        K_ff_nnz: partitionMaterial.K_ff.getNNZ(),
        K_G_nnz: partitionGeom.K_ff.getNNZ()
      },
      rejectionReasons
    };
  }
}
