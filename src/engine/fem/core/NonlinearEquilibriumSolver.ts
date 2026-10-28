/**
 * SECP Industrial OS — Geometrically Nonlinear Mechanics (SECP-FEM-UPGRADE-009)
 * NonlinearEquilibriumSolver.ts
 * 
 * Implements the Newton-Raphson method for structural equilibrium.
 * Features:
 * - Sparse assembly and tangent stiffness updates.
 * - Load stepping with automatic cutback support.
 * - Multi-criteria convergence (Residual, Displacement).
 * - Direct elimination of constrained DOFs.
 */

import { FEMModel, FEMDOFManager, DOFComponent } from "./FEMTypes";
import { FEMElementFormulation } from "./FEMElementFormulation";
import { SparseMatrix } from "./SparseMatrix";
import { SparsePCGSolver } from "./SparsePCGSolver";
import { BoundaryConditionEngine } from "./BoundaryConditionEngine";
import { LinearSystemEngine } from "./LinearSystemEngine";
import { GlobalAssemblyEngine } from "./GlobalAssemblyEngine";
import { MaterialStateManager } from "./MaterialStateManager";
import { ConstitutiveModel } from "./ConstitutiveModel";

export interface NonlinearSolverOptions {
  relativeTolerance?: number; // Convergence tolerance for residual
  displacementTolerance?: number; // Convergence tolerance for displacement increment
  maxIterations?: number;
  maxLoadSteps?: number;
  initialLoadFactor?: number;
  minLoadFactor?: number;
  materialModel?: ConstitutiveModel; // Optional material law
  nodalTemperatures?: Map<string, number>; // [C]
  onIteration?: (step: number, iteration: number, residualNorm: number) => void;
}

export interface NonlinearAnalysisResult {
  U: Float64Array;
  converged: boolean;
  steps: number;
  iterations: number;
  residualHistory: number[];
  Fint: Float64Array; // Final internal force vector for reaction recovery
  stateManager: MaterialStateManager; // For field recovery
}

export class NonlinearEquilibriumSolver {
  private bcEngine = new BoundaryConditionEngine();
  private assemblyEngine = new GlobalAssemblyEngine();
  private stateManager = new MaterialStateManager();

  public async solve(
    model: FEMModel,
    dofManager: FEMDOFManager,
    formulations: Map<string, FEMElementFormulation>,
    options: NonlinearSolverOptions = {}
  ): Promise<NonlinearAnalysisResult> {
    const totalDOFs = dofManager.getTotalDOFCount();
    let U = new Float64Array(totalDOFs); // Total displacement
    
    const relTol = options.relativeTolerance ?? 1e-6;
    const dispTol = options.displacementTolerance ?? 1e-6;
    const maxIterations = options.maxIterations ?? 20;
    const maxSteps = options.maxLoadSteps ?? 10;
    let loadFactor = options.initialLoadFactor ?? (1.0 / maxSteps);
    const minLoadFactor = options.minLoadFactor ?? 1e-4;

    let currentLoadFactor = 0;
    let totalSteps = 0;
    let totalIterations = 0;
    const residualHistory: number[] = [];

    // Pre-calculate full external force vector F_total
    const F_total = new Float64Array(totalDOFs);
    for (const load of model.loads) {
      const dof = dofManager.getDOF(load.nodeId, load.dof);
      if (dof) F_total[dof.globalId] += load.value;
    }

    // Initialize state for each element
    if (options.materialModel) {
      const initialState = options.materialModel.getInitialState();
      for (const [elemId, element] of model.elements.entries()) {
        const numPoints = element.formulationId === "TRUSS_2D_NL" ? 1 : 4; 
        this.stateManager.initializeElement(elemId, numPoints, initialState);
      }
    }

    while (currentLoadFactor < 1.0) {
      const stepSize = Math.min(loadFactor, 1.0 - currentLoadFactor);
      const targetLoadFactor = currentLoadFactor + stepSize;
      const F_ext = F_total.map(val => val * targetLoadFactor);

      let stepConverged = false;
      let iteration = 0;
      let U_prev_step = new Float64Array(U);

      while (iteration < maxIterations && !stepConverged) {
        iteration++;
        totalIterations++;

        // Reset trial state to the last committed state at the beginning of each equilibrium iteration
        this.stateManager.resetTrial();

        // 1. Assemble Tangent Stiffness Kt and Internal Force Fint using GlobalAssemblyEngine
        const { Kt: Kt_global, Fint: Fint_global } = this.assemblyEngine.assembleNonlinear(
          model, 
          dofManager, 
          formulations, 
          U, 
          this.stateManager, 
          options.materialModel
        );

        // 2. Compute Residual R = F_ext - Fint
        const R = new Float64Array(totalDOFs);
        let resNormSq = 0;
        for (let i = 0; i < totalDOFs; i++) {
          R[i] = F_ext[i] - Fint_global[i];
        }

        // Identify constrained DOFs (they don't contribute to residual norm check usually, or they should be zero)
        const constrainedDOFs = new Set<number>();
        for (const bc of model.boundaryConditions) {
          const dof = dofManager.getDOF(bc.nodeId, bc.dof);
          if (dof) constrainedDOFs.add(dof.globalId);
        }

        for (let i = 0; i < totalDOFs; i++) {
          if (!constrainedDOFs.has(i)) {
            resNormSq += R[i] * R[i];
          } else {
            // For constrained DOFs, we force residual to 0 for the linear solve
            R[i] = 0;
          }
        }
        const resNorm = Math.sqrt(resNormSq);
        residualHistory.push(resNorm);

        if (options.onIteration) options.onIteration(totalSteps + 1, iteration, resNorm);

        // 3. Check Convergence
        // Relative to external load norm? Or absolute?
        let fextNormSq = 0;
        for (let i = 0; i < totalDOFs; i++) if (!constrainedDOFs.has(i)) fextNormSq += F_ext[i] * F_ext[i];
        const fextNorm = Math.sqrt(fextNormSq);
        
        const convergenceCriteria = resNorm <= relTol * Math.max(fextNorm, 1.0);

        if (convergenceCriteria && iteration > 0) {
          stepConverged = true;
          break;
        }

        // 4. Solve Kt * dU = R
        // Handle BCs by partitioning
        const partition = this.bcEngine.partitionSystem(Kt_global, R, model, dofManager);
        
        let dU_f: Float64Array;
        try {
          // Attempt Sparse PCG first
          const pcgResult = SparsePCGSolver.solve(partition.K_ff, partition.F_f_effective, {
            relativeTolerance: 1e-10,
            absoluteTolerance: 1e-15,
            maxIterations: 1000
          });
          dU_f = pcgResult.x;
        } catch (pcgErr) {
          // Fallback to direct solver if system is non-SPD or PCG fails
          const directSolver = new LinearSystemEngine();
          dU_f = directSolver.solveDirectSparse(partition.K_ff, partition.F_f_effective);
        }
        
        // Reconstruct dU
        const dU = new Float64Array(totalDOFs);
        for (let i = 0; i < partition.freeDOFs.length; i++) {
          dU[partition.freeDOFs[i]] = dU_f[i];
        }
        // dU for constrained DOFs is 0.

        // Check displacement convergence
        let dUNormSq = 0;
        for (let i = 0; i < totalDOFs; i++) dUNormSq += dU[i] * dU[i];
        const dUNorm = Math.sqrt(dUNormSq);

        // Update total displacement
        for (let i = 0; i < totalDOFs; i++) {
          U[i] += dU[i];
        }

        if (dUNorm < dispTol && iteration > 1) {
          stepConverged = true;
        }
      }

      if (stepConverged) {
        currentLoadFactor = targetLoadFactor;
        totalSteps++;
        this.stateManager.commit(); // Converged step -> Permanently commit material history
        // Increase step size if it converged fast? (Adaptive)
        if (iteration < 5) loadFactor *= 1.5;
      } else {
        // Cutback
        loadFactor /= 2.0;
        U = new Float64Array(U_prev_step); // Reset U to start of step
        this.stateManager.rollback(); // Discard un-converged state changes
        if (loadFactor < minLoadFactor) {
          return {
            U,
            converged: false,
            steps: totalSteps,
            iterations: totalIterations,
            residualHistory,
            Fint: new Float64Array(totalDOFs), // Not truly converged
            stateManager: this.stateManager
          };
        }
      }
    }

    // Final re-assembly to get the truly final Fint at equilibrium
    const finalAssembly = this.assemblyEngine.assembleNonlinear(model, dofManager, formulations, U, this.stateManager, options.materialModel);

    return {
      U,
      converged: true,
      steps: totalSteps,
      iterations: totalIterations,
      residualHistory,
      Fint: finalAssembly.Fint,
      stateManager: this.stateManager
    };
  }
}
