import { SparseMatrix } from "./SparseMatrix";
import { CSRStorage } from "./CSRStorage";

export interface DirectSolverResult {
  success: boolean;
  solution: Float64Array;
  solverType: 'CHOLESKY' | 'LDL_T' | 'LU';
  residualNorm: number;
  relativeResidual: number;
  errorMessage?: string;
}

export class SparseCholeskySolver {
  /**
   * Direct Sparse Cholesky Solver A = L * L^T for SPD sparse matrices.
   */
  static solve(A: SparseMatrix, b: Float64Array): DirectSolverResult {
    const csr = A.storage.isCanonical ? A.storage : A.storage.canonicalize();
    const n = csr.rows;

    if (n !== b.length) {
      return {
        success: false,
        solution: new Float64Array(0),
        solverType: 'CHOLESKY',
        residualNorm: Infinity,
        relativeResidual: Infinity,
        errorMessage: `Dimension mismatch: Matrix (${n}x${n}) vs RHS vector (${b.length})`
      };
    }

    // Dense workspace for L factorization to ensure exact direct solve
    const L = Array.from({ length: n }, () => new Float64Array(n));

    for (let i = 0; i < n; i++) {
      for (let j = 0; j <= i; j++) {
        let sum = csr.get(i, j);

        for (let k = 0; k < j; k++) {
          sum -= L[i][k] * L[j][k];
        }

        if (i === j) {
          if (sum <= 1e-15 || Number.isNaN(sum) || !Number.isFinite(sum)) {
            return {
              success: false,
              solution: new Float64Array(n),
              solverType: 'CHOLESKY',
              residualNorm: Infinity,
              relativeResidual: Infinity,
              errorMessage: `Matrix is not positive definite or singular at pivot ${i} (sum = ${sum})`
            };
          }
          L[i][j] = Math.sqrt(sum);
        } else {
          L[i][j] = sum / L[j][j];
        }
      }
    }

    // Forward substitution: L * y = b
    const y = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      let sum = b[i];
      for (let k = 0; k < i; k++) {
        sum -= L[i][k] * y[k];
      }
      y[i] = sum / L[i][i];
    }

    // Backward substitution: L^T * x = y
    const x = new Float64Array(n);
    for (let i = n - 1; i >= 0; i--) {
      let sum = y[i];
      for (let k = i + 1; k < n; k++) {
        sum -= L[k][i] * x[k];
      }
      x[i] = sum / L[i][i];
    }

    // Compute residual r = b - A * x
    const Ax = A.spmv(x);
    let rNormSq = 0;
    let bNormSq = 0;
    for (let i = 0; i < n; i++) {
      const diff = b[i] - Ax[i];
      rNormSq += diff * diff;
      bNormSq += b[i] * b[i];
    }
    const residualNorm = Math.sqrt(rNormSq);
    const bNorm = Math.sqrt(bNormSq);
    const relativeResidual = bNorm > 0 ? residualNorm / bNorm : residualNorm;

    return {
      success: true,
      solution: x,
      solverType: 'CHOLESKY',
      residualNorm,
      relativeResidual
    };
  }
}

export class SparseLDLtSolver {
  /**
   * Direct Sparse LDL^T Solver for symmetric indefinite sparse matrices.
   */
  static solve(A: SparseMatrix, b: Float64Array): DirectSolverResult {
    const csr = A.storage.isCanonical ? A.storage : A.storage.canonicalize();
    const n = csr.rows;

    const L = Array.from({ length: n }, () => new Float64Array(n));
    const D = new Float64Array(n);

    for (let i = 0; i < n; i++) {
      L[i][i] = 1.0;
    }

    for (let j = 0; j < n; j++) {
      let sumD = csr.get(j, j);
      for (let k = 0; k < j; k++) {
        sumD -= L[j][k] * L[j][k] * D[k];
      }

      if (Math.abs(sumD) < 1e-15) {
        return {
          success: false,
          solution: new Float64Array(n),
          solverType: 'LDL_T',
          residualNorm: Infinity,
          relativeResidual: Infinity,
          errorMessage: `Zero pivot encountered in LDL^T factorization at column ${j}`
        };
      }
      D[j] = sumD;

      for (let i = j + 1; i < n; i++) {
        let sumL = csr.get(i, j);
        for (let k = 0; k < j; k++) {
          sumL -= L[i][k] * L[j][k] * D[k];
        }
        L[i][j] = sumL / D[j];
      }
    }

    // Solve L * z = b
    const z = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      let sum = b[i];
      for (let k = 0; k < i; k++) {
        sum -= L[i][k] * z[k];
      }
      z[i] = sum;
    }

    // Solve D * y = z
    const y = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      y[i] = z[i] / D[i];
    }

    // Solve L^T * x = y
    const x = new Float64Array(n);
    for (let i = n - 1; i >= 0; i--) {
      let sum = y[i];
      for (let k = i + 1; k < n; k++) {
        sum -= L[k][i] * x[k];
      }
      x[i] = sum;
    }

    const Ax = A.spmv(x);
    let rNormSq = 0;
    let bNormSq = 0;
    for (let i = 0; i < n; i++) {
      const diff = b[i] - Ax[i];
      rNormSq += diff * diff;
      bNormSq += b[i] * b[i];
    }
    const residualNorm = Math.sqrt(rNormSq);
    const bNorm = Math.sqrt(bNormSq);
    const relativeResidual = bNorm > 0 ? residualNorm / bNorm : residualNorm;

    return {
      success: true,
      solution: x,
      solverType: 'LDL_T',
      residualNorm,
      relativeResidual
    };
  }
}

export class SparseLUSolver {
  /**
   * Direct Sparse LU Solver with partial pivoting for general matrices.
   */
  static solve(A: SparseMatrix, b: Float64Array): DirectSolverResult {
    const csr = A.storage.isCanonical ? A.storage : A.storage.canonicalize();
    const n = csr.rows;

    const LU = Array.from({ length: n }, (_, r) => {
      const row = new Float64Array(n);
      for (let c = 0; c < n; c++) {
        row[c] = csr.get(r, c);
      }
      return row;
    });

    const P = new Int32Array(n);
    for (let i = 0; i < n; i++) P[i] = i;

    for (let k = 0; k < n; k++) {
      // Pivot selection
      let maxVal = 0;
      let pivotRow = k;
      for (let i = k; i < n; i++) {
        const val = Math.abs(LU[i][k]);
        if (val > maxVal) {
          maxVal = val;
          pivotRow = i;
        }
      }

      if (maxVal < 1e-15) {
        return {
          success: false,
          solution: new Float64Array(n),
          solverType: 'LU',
          residualNorm: Infinity,
          relativeResidual: Infinity,
          errorMessage: `Matrix is singular or near-singular at pivot step ${k}`
        };
      }

      // Swap rows
      if (pivotRow !== k) {
        const tempRow = LU[k];
        LU[k] = LU[pivotRow];
        LU[pivotRow] = tempRow;

        const tempP = P[k];
        P[k] = P[pivotRow];
        P[pivotRow] = tempP;
      }

      for (let i = k + 1; i < n; i++) {
        LU[i][k] /= LU[k][k];
        for (let j = k + 1; j < n; j++) {
          LU[i][j] -= LU[i][k] * LU[k][j];
        }
      }
    }

    // Permuted RHS vector b_p = P * b
    const pb = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      pb[i] = b[P[i]];
    }

    // Forward substitution L * y = P * b
    const y = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      let sum = pb[i];
      for (let k = 0; k < i; k++) {
        sum -= LU[i][k] * y[k];
      }
      y[i] = sum;
    }

    // Backward substitution U * x = y
    const x = new Float64Array(n);
    for (let i = n - 1; i >= 0; i--) {
      let sum = y[i];
      for (let k = i + 1; k < n; k++) {
        sum -= LU[i][k] * x[k];
      }
      x[i] = sum / LU[i][i];
    }

    const Ax = A.spmv(x);
    let rNormSq = 0;
    let bNormSq = 0;
    for (let i = 0; i < n; i++) {
      const diff = b[i] - Ax[i];
      rNormSq += diff * diff;
      bNormSq += b[i] * b[i];
    }
    const residualNorm = Math.sqrt(rNormSq);
    const bNorm = Math.sqrt(bNormSq);
    const relativeResidual = bNorm > 0 ? residualNorm / bNorm : residualNorm;

    return {
      success: true,
      solution: x,
      solverType: 'LU',
      residualNorm,
      relativeResidual
    };
  }
}
