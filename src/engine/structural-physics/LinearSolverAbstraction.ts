/**
 * PATCH-SECP-073.3: Linear Solver Abstraction Layer
 * Routes matrix problems to the correct solver (PCG, Dense, etc.)
 * based on symmetry, positive-definiteness, and size.
 */

import { SparseMatrix } from './SparseMatrixEngine';
import { PCGSolverEngine } from './PCGSolverEngine';

export class LinearSolverAbstraction {
  /**
   * Solves Ku = F. Automatically selects the optimal solver strategy.
   */
  public static solve(K: SparseMatrix, F: number[]): number[] {
    const size = K.getSize();

    // Heuristics for solver selection
    // In a full commercial code:
    // 1. If Non-Symmetric -> GMRES or BiCGSTAB
    // 2. If Indefinite -> MINRES or Direct Sparse (MUMPS/PARDISO)
    // 3. If SPD and Large -> PCG
    // 4. If Small (< 500) -> Dense Gaussian for numerical robustness

    if (size < 500) {
      return this.solveDense(K, F);
    } else {
      // Assuming SPD for standard static linear elastic FEA with penalty BCs
      const result = PCGSolverEngine.solve(K, F, 1e-8, 5000);
      if (!result.converged) {
        console.warn('PCG Solver failed to converge! Falling back to Dense solver (Warning: High Memory Usage)');
        return this.solveDense(K, F);
      }
      return result.x;
    }
  }

  /**
   * Basic Dense Gaussian Elimination Fallback
   */
  private static solveDense(K: SparseMatrix, F: number[]): number[] {
    const n = K.getSize();
    const A: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
    const b = [...F];

    // Extract dense from sparse
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        A[i][j] = K.get(i, j);
      }
    }

    // Gaussian Elimination
    for (let i = 0; i < n; i++) {
      let maxEl = Math.abs(A[i][i]);
      let maxRow = i;
      for (let k = i + 1; k < n; k++) {
        if (Math.abs(A[k][i]) > maxEl) {
          maxEl = Math.abs(A[k][i]);
          maxRow = k;
        }
      }

      for (let k = i; k < n; k++) {
        const tmp = A[maxRow][k];
        A[maxRow][k] = A[i][k];
        A[i][k] = tmp;
      }
      const tmp = b[maxRow];
      b[maxRow] = b[i];
      b[i] = tmp;

      if (Math.abs(A[i][i]) < 1e-12) {
        throw new Error('Matrix is singular!');
      }

      for (let k = i + 1; k < n; k++) {
        const c = -A[k][i] / A[i][i];
        for (let j = i; j < n; j++) {
          if (i === j) {
            A[k][j] = 0;
          } else {
            A[k][j] += c * A[i][j];
          }
        }
        b[k] += c * b[i];
      }
    }

    const x = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      x[i] = b[i] / A[i][i];
      for (let k = i - 1; k >= 0; k--) {
        b[k] -= A[k][i] * x[i];
      }
    }

    return x;
  }
}
