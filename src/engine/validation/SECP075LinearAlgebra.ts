/**
 * PATCH-SECP-075.2
 * Forensic Linear Algebra Kernel
 *
 * Provides deterministic numerical verification primitives:
 * - symmetry error
 * - Rayleigh quotient
 * - power iteration
 * - inverse iteration
 * - Cholesky SPD test
 * - condition number estimation
 */

export interface EigenEstimate {
  eigenvalue: number;
  vector: number[];
  iterations: number;
  converged: boolean;
}

export interface SPDResult {
  positiveDefinite: boolean;
  minPivot: number;
  maxPivot: number;
}

export interface ConditioningResult {
  lambdaMin: number;
  lambdaMax: number;
  conditionNumber: number;
  lambdaMinEstimate: EigenEstimate;
  lambdaMaxEstimate: EigenEstimate;
}

export class SECP075LinearAlgebra {

  public static vectorNorm(v: number[]): number {
    let s = 0;

    for (const x of v) {
      s += x * x;
    }

    return Math.sqrt(s);
  }

  public static dot(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vector dimension mismatch');
    }

    let s = 0;

    for (let i = 0; i < a.length; i++) {
      s += a[i] * b[i];
    }

    return s;
  }

  public static matVec(
    A: number[][],
    x: number[]
  ): number[] {

    if (A.length !== x.length) {
      throw new Error('Matrix/vector dimension mismatch');
    }

    return A.map(row => {

      if (row.length !== x.length) {
        throw new Error('Non-square matrix');
      }

      let s = 0;

      for (let j = 0; j < row.length; j++) {
        s += row[j] * x[j];
      }

      return s;
    });
  }

  public static frobeniusNorm(
    A: number[][]
  ): number {

    let s = 0;

    for (const row of A) {
      for (const x of row) {
        s += x * x;
      }
    }

    return Math.sqrt(s);
  }

  public static symmetryError(
    A: number[][]
  ): number {

    const n = A.length;

    let diff = 0;
    let norm = 0;

    for (let i = 0; i < n; i++) {

      if (A[i].length !== n) {
        throw new Error('Matrix must be square');
      }

      for (let j = 0; j < n; j++) {

        const d = A[i][j] - A[j][i];

        diff += d * d;
        norm += A[i][j] * A[i][j];
      }
    }

    return Math.sqrt(diff) /
      Math.max(1, Math.sqrt(norm));
  }

  public static rayleighQuotient(
    A: number[][],
    x: number[]
  ): number {

    const Ax = this.matVec(A, x);

    const xx = this.dot(x, x);

    if (xx <= Number.EPSILON) {
      throw new Error('Zero vector in Rayleigh quotient');
    }

    return this.dot(x, Ax) / xx;
  }

  public static powerIteration(
    A: number[][],
    maxIterations = 500,
    tolerance = 1e-12
  ): EigenEstimate {

    const n = A.length;

    let x = Array.from(
      { length: n },
      (_, i) => 1 + i / Math.max(1, n)
    );

    let norm = this.vectorNorm(x);

    x = x.map(v => v / norm);

    let previous = Number.NaN;

    for (let iteration = 1; iteration <= maxIterations; iteration++) {

      const Ax = this.matVec(A, x);

      const AxNorm = this.vectorNorm(Ax);

      if (!Number.isFinite(AxNorm) || AxNorm <= Number.EPSILON) {
        return {
          eigenvalue: 0,
          vector: x,
          iterations: iteration,
          converged: false
        };
      }

      x = Ax.map(v => v / AxNorm);

      const lambda = this.rayleighQuotient(A, x);

      if (
        Number.isFinite(previous) &&
        Math.abs(lambda - previous) <=
          tolerance * Math.max(1, Math.abs(lambda))
      ) {

        return {
          eigenvalue: lambda,
          vector: x,
          iterations: iteration,
          converged: true
        };
      }

      previous = lambda;
    }

    return {
      eigenvalue: this.rayleighQuotient(A, x),
      vector: x,
      iterations: maxIterations,
      converged: false
    };
  }

  /**
   * Dense Gaussian elimination with partial pivoting.
   */
  public static solveDense(
    AInput: number[][],
    bInput: number[]
  ): number[] {

    const n = AInput.length;

    if (n === 0 || bInput.length !== n) {
      throw new Error('Invalid linear system');
    }

    const A = AInput.map(row => [...row]);
    const b = [...bInput];

    for (let i = 0; i < n; i++) {

      let pivot = i;
      let max = Math.abs(A[i][i]);

      for (let r = i + 1; r < n; r++) {

        const value = Math.abs(A[r][i]);

        if (value > max) {
          max = value;
          pivot = r;
        }
      }

      if (!Number.isFinite(max) || max <= Number.EPSILON) {
        throw new Error(
          `Singular matrix during dense solve at pivot ${i}`
        );
      }

      if (pivot !== i) {
        [A[i], A[pivot]] = [A[pivot], A[i]];
        [b[i], b[pivot]] = [b[pivot], b[i]];
      }

      for (let r = i + 1; r < n; r++) {

        const factor = A[r][i] / A[i][i];

        A[r][i] = 0;

        for (let c = i + 1; c < n; c++) {
          A[r][c] -= factor * A[i][c];
        }

        b[r] -= factor * b[i];
      }
    }

    const x = Array(n).fill(0);

    for (let i = n - 1; i >= 0; i--) {

      let s = b[i];

      for (let j = i + 1; j < n; j++) {
        s -= A[i][j] * x[j];
      }

      x[i] = s / A[i][i];
    }

    return x;
  }

  /**
   * Inverse iteration for the smallest eigenvalue.
   *
   * IMPORTANT:
   * This requires an SPD / nonsingular matrix.
   */
  public static inverseIteration(
    A: number[][],
    maxIterations = 500,
    tolerance = 1e-12
  ): EigenEstimate {

    const n = A.length;

    let x = Array.from(
      { length: n },
      (_, i) => 1 + ((i * 17) % 13) / 13
    );

    let norm = this.vectorNorm(x);

    x = x.map(v => v / norm);

    let previous = Number.NaN;

    for (let iteration = 1; iteration <= maxIterations; iteration++) {

      let y: number[];

      try {
        y = this.solveDense(A, x);
      } catch {
        return {
          eigenvalue: NaN,
          vector: x,
          iterations: iteration,
          converged: false
        };
      }

      const yNorm = this.vectorNorm(y);

      if (!Number.isFinite(yNorm) || yNorm <= Number.EPSILON) {
        return {
          eigenvalue: NaN,
          vector: x,
          iterations: iteration,
          converged: false
        };
      }

      x = y.map(v => v / yNorm);

      const lambda = this.rayleighQuotient(A, x);

      if (
        Number.isFinite(previous) &&
        Math.abs(lambda - previous) <=
          tolerance * Math.max(1, Math.abs(lambda))
      ) {

        return {
          eigenvalue: lambda,
          vector: x,
          iterations: iteration,
          converged: true
        };
      }

      previous = lambda;
    }

    return {
      eigenvalue: this.rayleighQuotient(A, x),
      vector: x,
      iterations: maxIterations,
      converged: false
    };
  }

  /**
   * Cholesky factorization.
   *
   * A is SPD iff all diagonal pivots are strictly positive.
   */
  public static choleskySPD(
    A: number[][],
    tolerance = 1e-14
  ): SPDResult {

    const n = A.length;

    const L = Array.from(
      { length: n },
      () => Array(n).fill(0)
    );

    let minPivot = Infinity;
    let maxPivot = 0;

    for (let i = 0; i < n; i++) {

      let diagonal = A[i][i];

      for (let k = 0; k < i; k++) {
        diagonal -= L[i][k] * L[i][k];
      }

      if (
        !Number.isFinite(diagonal) ||
        diagonal <= tolerance
      ) {
        return {
          positiveDefinite: false,
          minPivot:
            Number.isFinite(minPivot)
              ? minPivot
              : diagonal,
          maxPivot
        };
      }

      L[i][i] = Math.sqrt(diagonal);

      minPivot = Math.min(minPivot, diagonal);
      maxPivot = Math.max(maxPivot, diagonal);

      for (let j = i + 1; j < n; j++) {

        let value = A[j][i];

        for (let k = 0; k < i; k++) {
          value -= L[j][k] * L[i][k];
        }

        L[j][i] = value / L[i][i];
      }
    }

    return {
      positiveDefinite: true,
      minPivot,
      maxPivot
    };
  }

  public static estimateConditioning(
    A: number[][]
  ): ConditioningResult {

    const maxEigen = this.powerIteration(A);
    const minEigen = this.inverseIteration(A);

    const lambdaMax = Math.abs(maxEigen.eigenvalue);
    const lambdaMin = minEigen.eigenvalue;

    const conditionNumber =
      lambdaMin > 0
        ? lambdaMax / lambdaMin
        : Infinity;

    return {
      lambdaMin,
      lambdaMax,
      conditionNumber,
      lambdaMinEstimate: minEigen,
      lambdaMaxEstimate: maxEigen
    };
  }
}
