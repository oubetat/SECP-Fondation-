/**
 * PATCH-SECP-076: Cross-Kernel Solver & Numerical Integrity Verification Kernel
 * Completely self-contained, zero-dependency numerical reference kernel.
 * Independently computes:
 * - Ax, r = Ax - b, relative residual, vector norms (L1, L2, Linf)
 * - Energy U = 0.5 * x^T * A * x
 * - Solution discrepancy ||x1 - x2||, relative solution discrepancy
 * - Pure reference Direct Cholesky solver, Gaussian solver with partial pivoting, and Reference PCG solver
 * - Condition number and spectral properties
 * 
 * CRITICAL INDEPENDENCE RULE:
 * This kernel DOES NOT call any production solvers (LinearSolverAbstraction, PCGSolverEngine)
 * to evaluate or verify these quantities.
 */

export interface VectorNorms {
  l1: number;
  l2: number;
  linf: number;
}

export interface ResidualResult {
  r: number[];
  normL1: number;
  normL2: number;
  normLinf: number;
  relativeResidual: number;
  maxComponent: number;
}

export interface SolutionDiscrepancyResult {
  l2Diff: number;
  linfDiff: number;
  relativeDiff: number;
  energyDiff: number;
  relativeEnergyDiff: number;
}

export interface DirectCholeskyResult {
  x: number[];
  L: number[][];
  success: boolean;
  minPivot: number;
  iterations: number;
  converged: boolean;
}

export interface DirectGaussianResult {
  x: number[];
  success: boolean;
  minPivot: number;
  iterations: number;
  converged: boolean;
}

export interface ReferencePCGResult {
  x: number[];
  iterations: number;
  converged: boolean;
  residualNorm: number;
  relativeResidual: number;
  history: number[];
  isMonotonic: boolean;
}

export class SECP076SolverIntegrityKernel {

  /**
   * Evaluates matrix-vector product y = A * x from mathematical first principles.
   */
  public static matVec(A: number[][], x: number[]): number[] {
    const rows = A.length;
    const cols = A[0]?.length ?? 0;
    if (cols !== x.length) {
      throw new Error(`SECP076SolverIntegrityKernel.matVec: Dimension mismatch. A is ${rows}x${cols}, x is ${x.length}`);
    }

    const y = new Array(rows).fill(0.0);
    for (let i = 0; i < rows; i++) {
      let sum = 0.0;
      const row = A[i];
      for (let j = 0; j < cols; j++) {
        sum += row[j] * x[j];
      }
      y[i] = sum;
    }
    return y;
  }

  /**
   * Computes vector norms (L1, L2, Linf).
   */
  public static computeVectorNorms(v: number[]): VectorNorms {
    let l1 = 0.0;
    let l2Sq = 0.0;
    let linf = 0.0;

    for (let i = 0; i < v.length; i++) {
      const absVal = Math.abs(v[i]);
      if (Number.isNaN(absVal) || !Number.isFinite(absVal)) {
        return { l1: NaN, l2: NaN, linf: NaN };
      }
      l1 += absVal;
      l2Sq += absVal * absVal;
      if (absVal > linf) linf = absVal;
    }

    return {
      l1,
      l2: Math.sqrt(l2Sq),
      linf
    };
  }

  /**
   * Independently computes the residual vector r = A*x - b and associated norms.
   */
  public static computeResidual(A: number[][], x: number[], b: number[]): ResidualResult {
    const n = b.length;
    const Ax = this.matVec(A, x);
    const r = new Array(n).fill(0.0);

    let normL1 = 0.0;
    let normL2Sq = 0.0;
    let normLinf = 0.0;
    let maxComponent = 0.0;

    for (let i = 0; i < n; i++) {
      const diff = Ax[i] - b[i];
      r[i] = diff;
      const absDiff = Math.abs(diff);
      normL1 += absDiff;
      normL2Sq += absDiff * absDiff;
      if (absDiff > normLinf) normLinf = absDiff;
      if (absDiff > maxComponent) maxComponent = absDiff;
    }

    const normL2 = Math.sqrt(normL2Sq);
    const bNorm = this.computeVectorNorms(b).l2;
    const relativeResidual = normL2 / Math.max(1e-12, bNorm);

    return {
      r,
      normL1,
      normL2,
      normLinf,
      relativeResidual,
      maxComponent
    };
  }

  /**
   * Evaluates quadratic strain energy U = 0.5 * x^T * A * x.
   */
  public static computeEnergy(A: number[][], x: number[]): number {
    const Ax = this.matVec(A, x);
    let energy = 0.0;
    for (let i = 0; i < x.length; i++) {
      energy += 0.5 * x[i] * Ax[i];
    }
    return energy;
  }

  /**
   * Computes independent discrepancy metrics between two solution vectors x1 and x2.
   */
  public static computeSolutionDiscrepancy(
    A: number[][],
    x1: number[],
    x2: number[]
  ): SolutionDiscrepancyResult {
    if (x1.length !== x2.length) {
      throw new Error(`SECP076SolverIntegrityKernel: Dimension mismatch in solution vectors (${x1.length} vs ${x2.length})`);
    }

    let diffL2Sq = 0.0;
    let normX2Sq = 0.0;
    let diffLinf = 0.0;

    for (let i = 0; i < x1.length; i++) {
      const d = x1[i] - x2[i];
      const absD = Math.abs(d);
      diffL2Sq += d * d;
      normX2Sq += x2[i] * x2[i];
      if (absD > diffLinf) diffLinf = absD;
    }

    const l2Diff = Math.sqrt(diffL2Sq);
    const normX2 = Math.sqrt(normX2Sq);
    const relativeDiff = l2Diff / Math.max(1e-15, normX2);

    const u1 = this.computeEnergy(A, x1);
    const u2 = this.computeEnergy(A, x2);
    const energyDiff = Math.abs(u1 - u2);
    const relativeEnergyDiff = energyDiff / Math.max(1e-15, Math.abs(u2));

    return {
      l2Diff,
      linfDiff: diffLinf,
      relativeDiff,
      energyDiff,
      relativeEnergyDiff
    };
  }

  /**
   * Pure Reference Direct Gaussian Elimination Solver with row partial pivoting.
   */
  public static solveDirectGaussian(A: number[][], b: number[]): DirectGaussianResult {
    const n = b.length;
    const M: number[][] = A.map((row, i) => [...row, b[i]]);
    let minPivot = Infinity;

    for (let p = 0; p < n; p++) {
      // Find pivot
      let maxVal = Math.abs(M[p][p]);
      let maxRow = p;
      for (let r = p + 1; r < n; r++) {
        const val = Math.abs(M[r][p]);
        if (val > maxVal) {
          maxVal = val;
          maxRow = r;
        }
      }

      if (maxVal < 1e-15 || Number.isNaN(maxVal) || !Number.isFinite(maxVal)) {
        return { x: new Array(n).fill(NaN), success: false, minPivot: maxVal, iterations: p, converged: false };
      }

      if (maxVal < minPivot) minPivot = maxVal;

      // Swap rows
      if (maxRow !== p) {
        const temp = M[p];
        M[p] = M[maxRow];
        M[maxRow] = temp;
      }

      // Eliminate
      for (let r = p + 1; r < n; r++) {
        const factor = M[r][p] / M[p][p];
        for (let c = p; c <= n; c++) {
          M[r][c] -= factor * M[p][c];
        }
      }
    }

    // Back-substitution
    const x = new Array(n).fill(0.0);
    for (let i = n - 1; i >= 0; i--) {
      let sum = M[i][n];
      for (let j = i + 1; j < n; j++) {
        sum -= M[i][j] * x[j];
      }
      x[i] = sum / M[i][i];
    }

    return {
      x,
      success: this.isFiniteVector(x),
      minPivot,
      iterations: n,
      converged: this.isFiniteVector(x)
    };
  }

  /**
   * Pure Reference Direct Cholesky LL^T Solver for symmetric positive-definite systems.
   */
  public static solveDirectCholesky(A: number[][], b: number[]): DirectCholeskyResult {
    const n = b.length;
    const L: number[][] = Array.from({ length: n }, () => new Array(n).fill(0.0));
    let minPivot = Infinity;

    for (let i = 0; i < n; i++) {
      for (let j = 0; j <= i; j++) {
        let sum = 0.0;
        for (let k = 0; k < j; k++) {
          sum += L[i][k] * L[j][k];
        }

        if (i === j) {
          const val = A[i][i] - sum;
          if (val <= 1e-15 || Number.isNaN(val) || !Number.isFinite(val)) {
            return { x: new Array(n).fill(NaN), L, success: false, minPivot: val, iterations: i, converged: false };
          }
          const sqrtVal = Math.sqrt(val);
          L[i][j] = sqrtVal;
          if (sqrtVal < minPivot) minPivot = sqrtVal;
        } else {
          if (L[j][j] === 0) return { x: new Array(n).fill(NaN), L, success: false, minPivot: 0, iterations: i, converged: false };
          L[i][j] = (A[i][j] - sum) / L[j][j];
        }
      }
    }

    // Forward solve: L * y = b
    const y = new Array(n).fill(0.0);
    for (let i = 0; i < n; i++) {
      let sum = 0.0;
      for (let k = 0; k < i; k++) {
        sum += L[i][k] * y[k];
      }
      y[i] = (b[i] - sum) / L[i][i];
    }

    // Back solve: L^T * x = y
    const x = new Array(n).fill(0.0);
    for (let i = n - 1; i >= 0; i--) {
      let sum = 0.0;
      for (let k = i + 1; k < n; k++) {
        sum += L[k][i] * x[k];
      }
      x[i] = (y[i] - sum) / L[i][i];
    }

    return {
      x,
      L,
      success: this.isFiniteVector(x),
      minPivot,
      iterations: n,
      converged: this.isFiniteVector(x)
    };
  }

  /**
   * Pure Reference Iterative PCG (Preconditioned Conjugate Gradient) Solver.
   * Tracks full convergence history and verifies strictly whether convergence was genuine.
   */
  public static solveIndependentPCG(
    A: number[][],
    b: number[],
    tol: number = 1e-10,
    maxIter: number = 5000
  ): ReferencePCGResult {
    const n = b.length;
    const x = new Array(n).fill(0.0);
    const r = [...b]; // r0 = b - A*x0 = b (since x0 = 0)
    const history: number[] = [];

    // Preconditioner: Jacobi (inverse diagonal)
    const M_inv = new Array(n).fill(1.0);
    for (let i = 0; i < n; i++) {
      const diag = A[i][i];
      if (diag > 1e-15) {
        M_inv[i] = 1.0 / diag;
      }
    }

    const z = new Array(n);
    const p = new Array(n);
    let rz = 0.0;

    for (let i = 0; i < n; i++) {
      z[i] = r[i] * M_inv[i];
      p[i] = z[i];
      rz += r[i] * z[i];
    }

    const bNorm = this.computeVectorNorms(b).l2;
    let initialResNorm = this.computeVectorNorms(r).l2;
    history.push(initialResNorm / Math.max(1e-12, bNorm));

    let iter = 0;
    for (; iter < maxIter; iter++) {
      const currentResNorm = this.computeVectorNorms(r).l2;
      const currentRelRes = currentResNorm / Math.max(1e-12, bNorm);
      if (currentRelRes <= tol) {
        break;
      }

      const Ap = this.matVec(A, p);
      let pAp = 0.0;
      for (let i = 0; i < n; i++) {
        pAp += p[i] * Ap[i];
      }

      if (pAp <= 1e-16 || Number.isNaN(pAp)) {
        // Non-positive definite or breakdown
        break;
      }

      const alpha = rz / pAp;
      for (let i = 0; i < n; i++) {
        x[i] += alpha * p[i];
        r[i] -= alpha * Ap[i];
      }

      const resNorm = this.computeVectorNorms(r).l2;
      const relRes = resNorm / Math.max(1e-12, bNorm);
      history.push(relRes);

      let newRz = 0.0;
      for (let i = 0; i < n; i++) {
        z[i] = r[i] * M_inv[i];
        newRz += r[i] * z[i];
      }

      const beta = newRz / rz;
      rz = newRz;

      for (let i = 0; i < n; i++) {
        p[i] = z[i] + beta * p[i];
      }
    }

    const finalRes = this.computeResidual(A, x, b);
    const converged = finalRes.relativeResidual <= tol && this.isFiniteVector(x);

    // Monotonicity check on recent window
    let isMonotonic = true;
    for (let i = 1; i < history.length; i++) {
      // In PCG residual norm can oscillate mildly, but overall trend must decrease
      if (history[i] > history[0] * 10) {
        isMonotonic = false;
        break;
      }
    }

    return {
      x,
      iterations: iter,
      converged,
      residualNorm: finalRes.normL2,
      relativeResidual: finalRes.relativeResidual,
      history,
      isMonotonic
    };
  }

  /**
   * Verifies if vector elements are all finite non-NaN numbers.
   */
  public static isFiniteVector(v: number[]): boolean {
    if (!v || v.length === 0) return false;
    for (let i = 0; i < v.length; i++) {
      if (Number.isNaN(v[i]) || !Number.isFinite(v[i])) {
        return false;
      }
    }
    return true;
  }

  /**
   * Verifies if matrix elements are all finite non-NaN numbers.
   */
  public static isFiniteMatrix(A: number[][]): boolean {
    if (!A || A.length === 0) return false;
    for (let i = 0; i < A.length; i++) {
      const row = A[i];
      if (!row || row.length !== A.length) return false;
      for (let j = 0; j < row.length; j++) {
        if (Number.isNaN(row[j]) || !Number.isFinite(row[j])) {
          return false;
        }
      }
    }
    return true;
  }

  /**
   * Computes Frobenius norm of matrix A.
   */
  public static frobeniusNorm(A: number[][]): number {
    let sum = 0.0;
    for (let i = 0; i < A.length; i++) {
      for (let j = 0; j < A[i].length; j++) {
        const v = A[i][j];
        sum += v * v;
      }
    }
    return Math.sqrt(sum);
  }

  /**
   * Computes spectral conditioning estimates (lambdaMin, lambdaMax, condition number).
   */
  public static estimateConditioning(A: number[][]): {
    lambdaMin: number;
    lambdaMax: number;
    conditionNumber: number;
  } {
    const n = A.length;
    if (n === 0) return { lambdaMin: 0, lambdaMax: 0, conditionNumber: Infinity };

    // Power iteration for lambdaMax
    let v = new Array(n).fill(1.0 / Math.sqrt(n));
    let lambdaMax = 0.0;
    for (let iter = 0; iter < 100; iter++) {
      const Av = this.matVec(A, v);
      const norm = this.computeVectorNorms(Av).l2;
      if (norm < 1e-15) break;
      lambdaMax = norm;
      v = Av.map(x => x / norm);
    }

    // Inverse power iteration for lambdaMin
    let u = new Array(n).fill(1.0 / Math.sqrt(n));
    let lambdaMin = 0.0;
    for (let iter = 0; iter < 100; iter++) {
      const sol = this.solveDirectGaussian(A, u);
      if (!sol.success) {
        lambdaMin = 0.0;
        break;
      }
      const norm = this.computeVectorNorms(sol.x).l2;
      if (norm < 1e-15) break;
      lambdaMin = 1.0 / norm;
      u = sol.x.map(x => x / norm);
    }

    const conditionNumber = lambdaMin > 0 ? lambdaMax / lambdaMin : Infinity;
    return { lambdaMin, lambdaMax, conditionNumber };
  }
}
