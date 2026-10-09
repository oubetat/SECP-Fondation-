export class MathUtils321A {
  /**
   * Gaussian elimination with partial pivoting for solving Ax = b
   */
  public static solveLinearSystem(A: number[][], b: number[]): number[] | null {
    const n = b.length;
    const M = A.map((row, i) => [...row, b[i]]);

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

      if (maxEl < 1e-9) {
        return null; // Singular matrix
      }

      // Swap rows
      if (maxRow !== i) {
        const tmp = M[maxRow];
        M[maxRow] = M[i];
        M[i] = tmp;
      }

      // Make all rows below this one 0 in current column
      for (let k = i + 1; k < n; k++) {
        const c = -M[k][i] / M[i][i];
        for (let j = i; j < n + 1; j++) {
          if (i === j) {
            M[k][j] = 0;
          } else {
            M[k][j] += c * M[i][j];
          }
        }
      }
    }

    // Solve equation Ax=b for an upper triangular matrix M
    const x = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      x[i] = M[i][n] / M[i][i];
      for (let k = i - 1; k >= 0; k--) {
        M[k][n] -= M[k][i] * x[i];
      }
    }
    return x;
  }

  /**
   * Solve A^T A x = A^T b (Least Squares)
   */
  public static solveLeastSquares(A: number[][], b: number[]): number[] | null {
    const rows = A.length;
    const cols = A[0].length;
    
    // A^T
    const At: number[][] = Array(cols).fill(0).map(() => Array(rows).fill(0));
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        At[j][i] = A[i][j];
      }
    }

    // A^T A
    const AtA: number[][] = Array(cols).fill(0).map(() => Array(cols).fill(0));
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < cols; j++) {
        for (let k = 0; k < rows; k++) {
          AtA[i][j] += At[i][k] * A[k][j];
        }
      }
    }

    // A^T b
    const Atb: number[] = Array(cols).fill(0);
    for (let i = 0; i < cols; i++) {
      for (let k = 0; k < rows; k++) {
        Atb[i] += At[i][k] * b[k];
      }
    }

    return this.solveLinearSystem(AtA, Atb);
  }

  /**
   * Jacobi eigenvalue algorithm for 3x3 real symmetric matrix
   * Returns { eigenvalues, eigenvectors } where eigenvectors are columns
   */
  public static eigenDecomposition3x3(matrix: number[][]): { eigenvalues: number[], eigenvectors: number[][] } {
    const A = [
      [matrix[0][0], matrix[0][1], matrix[0][2]],
      [matrix[1][0], matrix[1][1], matrix[1][2]],
      [matrix[2][0], matrix[2][1], matrix[2][2]]
    ];
    const V = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1]
    ];

    const maxIters = 50;
    const eps = 1e-9;

    for (let iter = 0; iter < maxIters; iter++) {
      // Find max off-diagonal element
      let p = 0, q = 1;
      let maxVal = Math.abs(A[0][1]);
      
      if (Math.abs(A[0][2]) > maxVal) { maxVal = Math.abs(A[0][2]); p = 0; q = 2; }
      if (Math.abs(A[1][2]) > maxVal) { maxVal = Math.abs(A[1][2]); p = 1; q = 2; }

      if (maxVal < eps) break;

      const app = A[p][p];
      const aqq = A[q][q];
      const apq = A[p][q];

      let t: number;
      const theta = (aqq - app) / (2 * apq);
      if (theta >= 0) {
        t = 1 / (theta + Math.sqrt(theta * theta + 1));
      } else {
        t = -1 / (-theta + Math.sqrt(theta * theta + 1));
      }

      const c = 1 / Math.sqrt(t * t + 1);
      const s = t * c;

      // Rotate A
      A[p][p] = app - t * apq;
      A[q][q] = aqq + t * apq;
      A[p][q] = 0;
      A[q][p] = 0;

      for (let i = 0; i < 3; i++) {
        if (i !== p && i !== q) {
          const api = A[p][i];
          const aqi = A[q][i];
          A[p][i] = c * api - s * aqi;
          A[i][p] = A[p][i];
          A[q][i] = s * api + c * aqi;
          A[i][q] = A[q][i];
        }
        // Rotate V
        const vip = V[i][p];
        const viq = V[i][q];
        V[i][p] = c * vip - s * viq;
        V[i][q] = s * vip + c * viq;
      }
    }

    return {
      eigenvalues: [A[0][0], A[1][1], A[2][2]],
      eigenvectors: V
    };
  }

  public static crossProduct(a: [number, number, number] | number[], b: [number, number, number] | number[]): [number, number, number] {
    return [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0]
    ];
  }

  public static dotProduct(a: [number, number, number] | number[], b: [number, number, number] | number[]): number {
    return a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
  }

  public static normalize(a: [number, number, number] | number[]): [number, number, number] {
    const len = Math.sqrt(this.dotProduct(a, a));
    if (len < 1e-9) return [0, 0, 0];
    return [a[0]/len, a[1]/len, a[2]/len];
  }

  public static distancePointToLine(p: [number, number, number] | number[], lineOrigin: [number, number, number] | number[], lineDir: [number, number, number] | number[]): number {
    const v: [number, number, number] = [p[0] - lineOrigin[0], p[1] - lineOrigin[1], p[2] - lineOrigin[2]];
    const cross = this.crossProduct(v, lineDir);
    return Math.sqrt(this.dotProduct(cross, cross)); // assuming lineDir is normalized
  }

  public static findOrthogonalBasis(n: [number, number, number] | number[]): [[number, number, number], [number, number, number]] {
    let u: [number, number, number];
    if (Math.abs(n[0]) > 0.9) {
      u = [0, 1, 0];
    } else {
      u = [1, 0, 0];
    }
    const v = this.normalize(this.crossProduct(n, u));
    const u_ortho = this.normalize(this.crossProduct(v, n));
    return [u_ortho, v];
  }
}
