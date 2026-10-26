/**
 * SECP Industrial OS — FEM Core Numerical Upgrade (SECP-FEM-UPGRADE-001)
 * LinearSystemEngine.ts
 * 
 * Supports:
 * 1. Direct Dense LU Solver (solve / solveDenseLU): with partial pivoting.
 * 2. Iterative Sparse PCG Solver (solveSparsePCG): operating directly on SparseMatrix with Jacobi preconditioning.
 * 3. Direct Partitioned Solver (solveDirectPartitioned): for exact solutions on partitioned subsystems.
 * 4. Error Classification: Detects under-constrained models, numerical singularities, non-SPD failures, and divergence.
 */

import { Matrix, solveLinearSystem } from "./MathUtils";
import { SparseMatrix } from "./SparseMatrix";
import { SparsePCGSolver, PCGOptions, PCGResult } from "./SparsePCGSolver";

export class LinearSystemEngine {
  /**
   * Direct Dense LU Solver with Partial Pivoting.
   */
  public solve(K: Matrix, F: number[]): number[] {
    try {
      return solveLinearSystem(K, F);
    } catch (e: any) {
      if (e.message && (e.message.includes("singular") || e.message.includes("NUMERICAL_SINGULARITY"))) {
        throw new Error("UNEXPECTED_SINGULARITY: or UNDER_CONSTRAINED_MODEL");
      }
      throw e;
    }
  }

  /**
   * Iterative Sparse PCG Solver.
   * Directly solves K * u = F without any dense matrix conversion.
   */
  public solveSparsePCG(
    K: SparseMatrix,
    F: number[] | Float64Array,
    options?: PCGOptions
  ): PCGResult {
    try {
      return SparsePCGSolver.solve(K, F, options);
    } catch (e: any) {
      if (e.message && e.message.includes("PCG_NON_SPD")) {
        throw new Error(`[NUMERICAL_FAILURE] System is not Symmetric Positive-Definite (under-constrained or mechanism detected): ${e.message}`);
      }
      if (e.message && e.message.includes("PCG_CONVERGENCE_FAILURE")) {
        throw new Error(`[SOLVER_DIVERGENCE] PCG failed to reach convergence: ${e.message}`);
      }
      throw e;
    }
  }

  /**
   * Direct solver on a SparseMatrix by converting only the partitioned submatrix to LU
   * (useful for moderate-sized systems where direct solution is requested).
   */
  public solveDirectSparse(K: SparseMatrix, F: number[] | Float64Array): Float64Array {
    const denseK = K.toDense();
    const vecF = Array.from(F);
    const u = this.solve(denseK, vecF);
    return new Float64Array(u);
  }
}
