/**
 * SECP CAD Kernel — GCS Linear Algebra Utilities
 * Phase 2 (PATCH-025)
 */

export class LinearAlgebra {
  /**
   * Solves Ax = b using Gaussian elimination with pivoting.
   * Only for square matrices.
   */
  public static solve(A: number[][], b: number[]): number[] {
    const n = b.length;
    const mat = A.map((row, i) => [...row, b[i]]);

    for (let i = 0; i < n; i++) {
      // Pivot
      let maxRow = i;
      for (let k = i + 1; k < n; k++) {
        if (Math.abs(mat[k][i]) > Math.abs(mat[maxRow][i])) {
          maxRow = k;
        }
      }
      [mat[i], mat[maxRow]] = [mat[maxRow], mat[i]];

      // Eliminate
      const pivot = mat[i][i];
      if (Math.abs(pivot) < 1e-15) {
        throw new Error('Matrix is singular');
      }

      for (let k = i + 1; k < n; k++) {
        const factor = mat[k][i] / pivot;
        for (let j = i; j <= n; j++) {
          mat[k][j] -= factor * mat[i][j];
        }
      }
    }

    // Back substitute
    const x = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      let sum = mat[i][n];
      for (let j = i + 1; j < n; j++) {
        sum -= mat[i][j] * x[j];
      }
      x[i] = sum / mat[i][i];
    }

    return x;
  }

  /**
   * Computes A^T * A
   */
  public static multiplyAtA(A: number[][]): number[][] {
    const m = A.length;
    const n = A[0]?.length || 0;
    const res: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        let sum = 0;
        for (let k = 0; k < m; k++) {
          sum += A[k][i] * A[k][j];
        }
        res[i][j] = sum;
      }
    }
    return res;
  }

  /**
   * Computes A^T * b
   */
  public static multiplyAtb(A: number[][], b: number[]): number[] {
    const m = A.length;
    const n = A[0]?.length || 0;
    const res: number[] = new Array(n).fill(0);

    for (let j = 0; j < n; j++) {
      let sum = 0;
      for (let k = 0; k < m; k++) {
        sum += A[k][j] * b[k];
      }
      res[j] = sum;
    }
    return res;
  }

  public static addDiagonal(A: number[][], lambda: number): number[][] {
    const n = A.length;
    const res = A.map(row => [...row]);
    for (let i = 0; i < n; i++) {
      res[i][i] += lambda;
    }
    return res;
  }

  public static norm(v: number[]): number {
    return Math.sqrt(v.reduce((sum, val) => sum + val * val, 0));
  }
}
