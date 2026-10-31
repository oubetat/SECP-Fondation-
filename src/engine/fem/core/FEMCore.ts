/**
 * SECP Industrial OS — Engineering Truth OS
 * FEMCore.ts
 * 
 * Authoritative point of entry for the SECP FEM Structural Physics Engine.
 * Upgraded to support:
 * 1. Sparse Storage & Assembly via SparseMatrix (CSR/DOK).
 * 2. Iterative Preconditioned Conjugate Gradient (PCG) solver directly on sparse systems.
 * 3. Exact Boundary Condition Partitioning (Direct Elimination) to prevent penalty ill-conditioning.
 * 4. 2D Euler-Bernoulli Beam (BEAM_2D) and 2D Frame (FRAME_2D) element formulations with rotational DOFs (RZ).
 * 5. Comprehensive numerical failure diagnosis (non-SPD, divergence, singularities).
 * 6. Complete backward compatibility with existing SECP verification gates and evidence engines.
 */

import { FEMModel, DOFComponent, StructuralFieldRecovery } from "./FEMTypes";
import { FEMElementFormulation } from "./FEMElementFormulation";
import { FEMDOFManager } from "./FEMDOFManager";
import { GlobalAssemblyEngine, SparseAssemblyResult } from "./GlobalAssemblyEngine";
import { BoundaryConditionEngine, PartitionedSystem, PenaltySystem } from "./BoundaryConditionEngine";
import { LinearSystemEngine } from "./LinearSystemEngine";
import { FieldRecoveryEngine } from "./FieldRecoveryEngine";
import { FEMVerificationEngine } from "./FEMVerificationEngine";
import { Bar1DFormulation } from "./Bar1DFormulation";
import { CST2DFormulation } from "./CST2DFormulation";
import { Beam2DFormulation } from "./Beam2DFormulation";
import { Frame2DFormulation } from "./Frame2DFormulation";
import { T62DFormulation } from "./T62DFormulation";
import { Q42DFormulation } from "./Q42DFormulation";
import { TET43DFormulation } from "./TET43DFormulation";
import { SparseMatrix } from "./SparseMatrix";
import { PCGOptions, PCGDiagnostics } from "./SparsePCGSolver";
import { Matrix } from "./MathUtils";
import { Truss2DFormulation } from "./Truss2DFormulation";
import { TET4PlasticFormulation } from "./TET4PlasticFormulation";
import { TET4LargeDeformationFormulation } from "./TET4LargeDeformationFormulation";
import { TET4LargeDeformationPlasticFormulation } from "./TET4LargeDeformationPlasticFormulation";
import { NonlinearAnalysisResult, NonlinearEquilibriumSolver, NonlinearSolverOptions } from "./NonlinearEquilibriumSolver";
import { GeometryMaterialValidator } from "./GeometryMaterialValidator";
import { FemToCoreBinding } from "../../crossdomain/CanonicalDomainBinding";
import { CanonicalDomainBindingEngine } from "../../crossdomain/CanonicalDomainBindingEngine";

export interface FEMSolveOptions {
  /**
   * Linear solver to use.
   * - 'SPARSE_PCG': Preconditioned Conjugate Gradient operating directly on CSR SparseMatrix.
   * - 'DIRECT_DENSE': Legacy LU decomposition with partial pivoting on dense matrix.
   * - 'DIRECT_PARTITIONED': Direct LU solver on the partitioned K_ff submatrix.
   * - 'AUTO': Automatically selects based on system dimension (default).
   */
  solverType?: 'SPARSE_PCG' | 'DIRECT_DENSE' | 'DIRECT_PARTITIONED' | 'AUTO';

  /**
   * Boundary condition enforcement method.
   * - 'DIRECT_ELIMINATION': Exact equation partitioning into free and constrained DOFs (recommended).
   * - 'PENALTY': Legacy penalty method.
   */
  bcMethod?: 'DIRECT_ELIMINATION' | 'PENALTY';

  /**
   * Options for Sparse PCG solver.
   */
  pcgOptions?: PCGOptions;

  /**
   * Penalty stiffness (only used if bcMethod === 'PENALTY').
   */
  customPenalty?: number;

  /**
   * Equilibrium verification tolerance.
   */
  equilibriumTolerance?: number;

  /**
   * Energy verification tolerance.
   */
  energyTolerance?: number;
}

export interface FEMSolveResult {
  U: number[];
  displacements: Map<string, { [key in DOFComponent]?: number }>;
  reactions: number[];
  K_global: Matrix;
  K_sparse: SparseMatrix;
  F_global: number[];
  trace: readonly any[];
  equilibrium: { ok: boolean; sumFx: number; sumFy: number; sumFz: number; residualNorm: number; error?: string };
  energy: { ok: boolean; strainEnergy: number; externalWork: number; diff: number };
  solverTypeUsed: 'SPARSE_PCG' | 'DIRECT_DENSE' | 'DIRECT_PARTITIONED';
  bcMethodUsed: 'DIRECT_ELIMINATION' | 'PENALTY';
  solverMetrics?: any;
  sparseMetrics: {
    totalDOFs: number;
    nnz: number;
    sparsityRatio: number;
  };
  solverDiagnostics?: PCGDiagnostics;
  fields: StructuralFieldRecovery;
}

export class FEMCore {
  private dofManager = new FEMDOFManager();
  private assemblyEngine = new GlobalAssemblyEngine();
  private bcEngine = new BoundaryConditionEngine();
  private solver = new LinearSystemEngine();
  private recoveryEngine = new FieldRecoveryEngine();
  private verificationEngine = new FEMVerificationEngine();
  private formulations = new Map<string, FEMElementFormulation>();

  constructor() {
    this.formulations.set("BAR_1D", new Bar1DFormulation());
    this.formulations.set("CST_2D", new CST2DFormulation());
    this.formulations.set("BEAM_2D", new Beam2DFormulation());
    this.formulations.set("FRAME_2D", new Frame2DFormulation());
    this.formulations.set("T6_2D", new T62DFormulation());
    this.formulations.set("Q4_2D", new Q42DFormulation());
    this.formulations.set("TET4_3D", new TET43DFormulation());
    this.formulations.set("TRUSS_2D_NL", new Truss2DFormulation());
    this.formulations.set("TET4_PLASTIC", new TET4PlasticFormulation());
    const largeDeformFormulation = new TET4LargeDeformationFormulation();
    this.formulations.set("TET4_LARGE_DEFORM", largeDeformFormulation);
    this.formulations.set("TET4_HYPERELASTIC", largeDeformFormulation);
    this.formulations.set("TET4_LARGE_DEFORM_PLASTIC", new TET4LargeDeformationPlasticFormulation());
  }

  public registerFormulation(id: string, formulation: FEMElementFormulation): void {
    this.formulations.set(id, formulation);
  }

  public solve(binding: FemToCoreBinding, options: FEMSolveOptions = {}): FEMSolveResult {
    // 0. GATING: Verify simulation authority seal (Fail-Closed)
    if (!CanonicalDomainBindingEngine.validateBinding(binding)) {
      throw new Error(`[AUTHORITY_GATE_REJECTION] FEM Solver execution denied: Invalid or non-authoritative simulation seal.`);
    }

    const model = binding.payload;

    // 0b. Pre-flight verification of geometry-material assignments
    GeometryMaterialValidator.preFlightCheck(model);

    // 1. Determine and Build DOFs dynamically per node
    this.dofManager.buildDOFs(model, this.formulations);
    const totalDOFs = this.dofManager.getTotalDOFCount();

    if (totalDOFs === 0) {
      throw new Error(`[EMPTY_MODEL_ERROR] No degrees of freedom registered in model.`);
    }

    // 2. Sparse Global Assembly (Zero dense allocation during assembly)
    const assembly: SparseAssemblyResult = this.assemblyEngine.assembleSparse(
      model,
      this.dofManager,
      this.formulations
    );

    const K_sparse = assembly.K_sparse;
    const F_global = Array.from(assembly.F);

    // Determine Solver and BC strategy
    const requestedSolver = options.solverType ?? 'AUTO';
    const requestedBC = options.bcMethod ?? (requestedSolver === 'DIRECT_DENSE' ? 'PENALTY' : 'DIRECT_ELIMINATION');

    let effectiveSolver: 'SPARSE_PCG' | 'DIRECT_DENSE' | 'DIRECT_PARTITIONED';
    if (requestedSolver === 'AUTO') {
      // For small benchmark models (< 40 DOFs), direct partitioned solve is exact and instant.
      // For larger meshes, sparse PCG scales linearly in O(nnz).
      effectiveSolver = totalDOFs > 40 ? 'SPARSE_PCG' : 'DIRECT_PARTITIONED';
    } else {
      effectiveSolver = requestedSolver;
    }

    let U_vec: Float64Array | number[];
    let pcgDiag: PCGDiagnostics | undefined;

    // 3. Execution branch based on BC method and solver
    if (requestedBC === 'DIRECT_ELIMINATION') {
      // Direct Elimination / Equation Partitioning
      const partition: PartitionedSystem = this.bcEngine.partitionSystem(
        K_sparse,
        assembly.F,
        model,
        this.dofManager
      );

      if (partition.freeDOFs.length === 0) {
        // Fully prescribed system - all displacements are known exactly from boundary conditions
        U_vec = this.bcEngine.reconstructFullDisplacement(new Float64Array(0), partition);
      } else if (effectiveSolver === 'SPARSE_PCG') {
        const pcgResult = this.solver.solveSparsePCG(
          partition.K_ff,
          partition.F_f_effective,
          options.pcgOptions
        );
        pcgDiag = pcgResult.diagnostics;
        U_vec = this.bcEngine.reconstructFullDisplacement(pcgResult.x, partition);
      } else {
        // Direct partitioned solve
        const u_f = this.solver.solveDirectSparse(partition.K_ff, partition.F_f_effective);
        U_vec = this.bcEngine.reconstructFullDisplacement(u_f, partition);
        effectiveSolver = 'DIRECT_PARTITIONED';
      }
    } else {
      // Legacy Penalty Method
      const K_dense = K_sparse.toDense();
      const penaltySys: PenaltySystem = this.bcEngine.applyConstraints(
        K_dense,
        F_global,
        model,
        this.dofManager,
        options.customPenalty
      );

      const u_dense = this.solver.solve(penaltySys.modifiedK, penaltySys.modifiedF);
      U_vec = u_dense;
      effectiveSolver = 'DIRECT_DENSE';
    }

    const U = Array.from(U_vec);

    // 4. Recover Displacements, Reactions, and Stress/Strain Fields
    const displacements = this.recoveryEngine.recoverDisplacements(U_vec, model, this.dofManager);
    const reactionsFloat = this.recoveryEngine.computeReactions(K_sparse, U_vec, assembly.F, this.dofManager);
    const reactions = Array.from(reactionsFloat);

    // 4b. Recover Stress & Strain Tensors across all elements and nodes
    const fields = this.recoveryEngine.recoverFullStructuralFields(
      U_vec,
      model,
      this.dofManager,
      this.formulations
    );

    // 5. Verification: Equilibrium & Energy Conservation
    const eqTol = options.equilibriumTolerance ?? 1e-4;
    const enTol = options.energyTolerance ?? 1e-4;

    const eqStatus = this.verificationEngine.verifyEquilibrium(assembly.F, reactionsFloat, this.dofManager, eqTol);
    if (!eqStatus.ok) {
      throw new Error(`[EQUILIBRIUM_VERIFICATION_FAILURE] ${eqStatus.error}`);
    }

    const enStatus = this.verificationEngine.verifyEnergy(K_sparse, U_vec, assembly.F, reactionsFloat, enTol);

    // Compute sparse metrics
    const nnz = K_sparse.getNNZ();
    const totalPossible = totalDOFs * totalDOFs;
    const sparsityRatio = totalPossible > 0 ? 1.0 - (nnz / totalPossible) : 0;

    return {
      U,
      displacements,
      reactions,
      K_global: K_sparse.toDense(), // Provided for full backward compatibility with legacy gate inspectors
      K_sparse,
      F_global,
      trace: assembly.trace,
      equilibrium: eqStatus,
      energy: enStatus,
      solverTypeUsed: effectiveSolver,
      bcMethodUsed: requestedBC,
      sparseMetrics: {
        totalDOFs,
        nnz,
        sparsityRatio
      },
      solverDiagnostics: pcgDiag,
      fields
    };
  }

  public async solveNonlinear(model: FEMModel, options: NonlinearSolverOptions = {}): Promise<NonlinearAnalysisResult & { fields: StructuralFieldRecovery, reactions: number[], equilibrium: any }> {
    this.dofManager.buildDOFs(model, this.formulations);
    const solver = new NonlinearEquilibriumSolver();
    const result = await solver.solve(model, this.dofManager, this.formulations, options);

    // 1. Recover fields for the final converged state
    const fields = this.recoveryEngine.recoverFullStructuralFields(
      result.U,
      model,
      this.dofManager,
      this.formulations
    );

    // Add plastic fields to the recovery if state manager exists
    // (This is a simplified extension of FieldRecoveryEngine logic)
    for (const [elemId, states] of result.stateManager["committedState"].elementStates.entries()) {
      const field = fields.elementFields.get(elemId);
      if (field) {
        // @ts-ignore
        field.equivalentPlasticStrain = states[0].equivalentPlasticStrain;
        // @ts-ignore
        field.plasticStrain = states[0].plasticStrain;
      }
    }

    // 2. Recover Reactions from internal forces: R = Fint - Fext
    const totalDOFs = this.dofManager.getTotalDOFCount();
    const F_total = new Float64Array(totalDOFs);
    for (const load of model.loads) {
      const dof = this.dofManager.getDOF(load.nodeId, load.dof);
      if (dof) F_total[dof.globalId] += load.value;
    }

    const reactions = new Float64Array(totalDOFs);
    for (let i = 0; i < totalDOFs; i++) {
      reactions[i] = result.Fint[i] - F_total[i];
    }

    // 3. Verify Equilibrium
    const eqStatus = this.verificationEngine.verifyEquilibrium(F_total, reactions, this.dofManager);

    return {
      ...result,
      fields,
      reactions: Array.from(reactions),
      equilibrium: eqStatus
    };
  }

  public getDOFManager(): FEMDOFManager {
    return this.dofManager;
  }

  public getBoundaryConditionEngine(): BoundaryConditionEngine {
    return this.bcEngine;
  }

  public getAssemblyEngine(): GlobalAssemblyEngine {
    return this.assemblyEngine;
  }
}
