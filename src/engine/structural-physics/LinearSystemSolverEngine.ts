/**
 * PATCH-SECP-073: Linear System Solver Engine
 * Solves the structural system equations [K] * {u} = {F} under boundary condition partitions.
 */

export class LinearSystemSolverEngine {
  /**
   * Solves for displacements using Gaussian Elimination on active (unconstrained) DOFs.
   */
  public static solve(
    K: number[][],
    F: number[],
    activeDOFs: boolean[]
  ): number[] {
    const n = K.length;
    const displacements = Array(n).fill(0);

    // Filter active (unconstrained) indices
    const activeIndices: number[] = [];
    activeDOFs.forEach((active, idx) => {
      if (active) activeIndices.push(idx);
    });

    const m = activeIndices.length;
    if (m === 0) return displacements;

    // Create partitioned system K_sub * u_sub = F_sub
    const K_sub: number[][] = Array.from({ length: m }, () => Array(m).fill(0));
    const F_sub: number[] = Array(m).fill(0);

    for (let i = 0; i < m; i++) {
      const gI = activeIndices[i];
      F_sub[i] = F[gI];
      for (let j = 0; j < m; j++) {
        const gJ = activeIndices[j];
        K_sub[i][j] = K[gI][gJ];
      }
    }

    // Solve K_sub * u_sub = F_sub using Gaussian Elimination
    const u_sub = this.solveGaussian(K_sub, F_sub);

    // Map back to global displacement vector
    for (let i = 0; i < m; i++) {
      displacements[activeIndices[i]] = u_sub[i];
    }

    return displacements;
  }

  private static solveGaussian(A: number[][], b: number[]): number[] {
    const n = A.length;
    
    // Deep clone system
    const M: number[][] = A.map(row => [...row]);
    const r = [...b];

    for (let i = 0; i < n; i++) {
      // Find pivot
      let maxEl = Math.abs(M[i][i]);
      let maxRow = i;
      for (let k = i + 1; k < n; k++) {
        if (Math.abs(M[k][i]) > maxEl) {
          maxEl = Math.abs(M[k][i]);
          maxRow = k;
        }
      }

      // Swap rows
      const tmpRow = M[maxRow];
      M[maxRow] = M[i];
      M[i] = tmpRow;

      const tmpB = r[maxRow];
      r[maxRow] = r[i];
      r[i] = tmpB;

      // Handle singular matrix
      if (Math.abs(M[i][i]) < 1e-12) {
        M[i][i] = 1e-12; // Numerical safety ridge
      }

      // Forward elimination
      for (let k = i + 1; k < n; k++) {
        const c = -M[k][i] / M[i][i];
        for (let j = i; j < n; j++) {
          if (i === j) {
            M[k][j] = 0;
          } else {
            M[k][j] += c * M[i][j];
          }
        }
        r[k] += c * r[i];
      }
    }

    // Back substitution
    const x = Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      let sum = 0;
      for (let j = i + 1; j < n; j++) {
        sum += M[i][j] * x[j];
      }
      x[i] = (r[i] - sum) / M[i][i];
    }

    return x;
  }
}
