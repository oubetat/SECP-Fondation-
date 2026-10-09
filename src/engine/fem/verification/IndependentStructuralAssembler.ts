export class IndependentStructuralAssembler {
  /**
   * Independently assembles 1D axial bar stiffness matrix K (n x n) from node coordinates, element connectivity, A, E.
   */
  public static assembleBarStiffnessMatrix(
    nodeCoordsX: number[],
    elements: [number, number][],
    A: number,
    E: number
  ): number[][] {
    const numNodes = nodeCoordsX.length;
    const K: number[][] = Array.from({ length: numNodes }, () => new Array(numNodes).fill(0));

    for (const [n1, n2] of elements) {
      const L = Math.abs(nodeCoordsX[n2] - nodeCoordsX[n1]);
      const k = (A * E) / L;

      K[n1][n1] += k;
      K[n1][n2] -= k;
      K[n2][n1] -= k;
      K[n2][n2] += k;
    }

    return K;
  }

  /**
   * Independently solves linear system Ku = F with prescribed Dirichlet boundary conditions using Gaussian elimination.
   */
  public static solveSystem(
    K_orig: number[][],
    F_orig: number[],
    fixedDofs: number[],
    prescribedVals: number[]
  ): number[] {
    const n = F_orig.length;
    const K = K_orig.map(row => [...row]);
    const F = [...F_orig];

    // Apply Dirichlet boundary conditions (penalty or row elimination method)
    for (let i = 0; i < fixedDofs.length; i++) {
      const dof = fixedDofs[i];
      const val = prescribedVals[i] || 0;

      for (let j = 0; j < n; j++) {
        K[dof][j] = 0;
      }
      K[dof][dof] = 1.0;
      F[dof] = val;
    }

    // Gaussian Elimination with Partial Pivoting
    const x = new Array(n).fill(0);
    const A = K.map((row, i) => [...row, F[i]]);

    for (let i = 0; i < n; i++) {
      let maxRow = i;
      for (let k = i + 1; k < n; k++) {
        if (Math.abs(A[k][i]) > Math.abs(A[maxRow][i])) {
          maxRow = k;
        }
      }

      const temp = A[i];
      A[i] = A[maxRow];
      A[maxRow] = temp;

      if (Math.abs(A[i][i]) < 1e-15) {
        throw new Error("INDEPENDENT_VERIFICATION_FAILURE: Singular matrix encountered in independent solver");
      }

      for (let k = i + 1; k < n; k++) {
        const c = -A[k][i] / A[i][i];
        for (let j = i; j <= n; j++) {
          if (i === j) {
            A[k][j] = 0;
          } else {
            A[k][j] += c * A[i][j];
          }
        }
      }
    }

    // Back Substitution
    for (let i = n - 1; i >= 0; i--) {
      x[i] = A[i][n] / A[i][i];
      for (let k = i - 1; k >= 0; k--) {
        A[k][n] -= A[k][i] * x[i];
      }
    }

    return x;
  }

  /**
   * Independently recomputes support reactions R = K_orig * u - F_orig at fixed DOFs.
   */
  public static computeIndependentReactions(
    K_orig: number[][],
    u: number[],
    F_orig: number[],
    fixedDofs: number[]
  ): number[] {
    const reactions = new Array(fixedDofs.length).fill(0);

    for (let idx = 0; idx < fixedDofs.length; idx++) {
      const dof = fixedDofs[idx];
      let Ku_i = 0;
      for (let j = 0; j < K_orig.length; j++) {
        Ku_i += K_orig[dof][j] * u[j];
      }
      reactions[idx] = Ku_i - F_orig[dof];
    }

    return reactions;
  }
}
