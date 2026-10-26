/**
 * SECP Industrial OS — FEM Core Numerical Upgrade (SECP-FEM-UPGRADE-001)
 * SparsePCGSolver.ts
 * 
 * Iterative Preconditioned Conjugate Gradient (PCG) solver operating directly
 * on SparseMatrix (CSR) without any dense conversion.
 * 
 * Capabilities:
 * - Jacobi (diagonal scaling) and Identity preconditioners.
 * - Strict dual-norm convergence criteria (relative and absolute).
 * - Curvature check: Immediate detection of non-SPD / indefinite systems (p^T A p <= 0).
 * - Zero pivot and non-positive diagonal guards.
 * - Comprehensive diagnostic telemetry (iterations, residual history, norms).
 * - Fail-closed: Explicit error reporting when convergence criteria cannot be met.
 */

import { SparseMatrix } from "./SparseMatrix";

export interface PCGOptions {
  readonly relativeTolerance?: number;
  readonly absoluteTolerance?: number;
  readonly maxIterations?: number;
  readonly preconditioner?: 'JACOBI' | 'IDENTITY';
  readonly initialGuess?: Float64Array | number[];
}

export interface PCGDiagnostics {
  readonly converged: boolean;
  readonly iterations: number;
  readonly initialResidualNorm: number;
  readonly finalResidualNorm: number;
  readonly relativeResidual: number;
  readonly executionTimeMs: number;
  readonly preconditionerUsed: 'JACOBI' | 'IDENTITY';
  readonly reason: string;
}

export interface PCGResult {
  readonly x: Float64Array;
  readonly diagnostics: PCGDiagnostics;
}

export class SparsePCGSolver {
  /**
   * Solves A * x = b using Preconditioned Conjugate Gradient on SparseMatrix.
   */
  public static solve(
    A: SparseMatrix,
    b: number[] | Float64Array,
    options: PCGOptions = {}
  ): PCGResult {
    const startTime = performance.now();
    const n = A.rows;

    if (A.rows !== A.cols) {
      throw new Error(`[PCG_DIM_MISMATCH] PCG solver requires a square matrix: rows=${A.rows}, cols=${A.cols}`);
    }

    if (b.length !== n) {
      throw new Error(`[PCG_VEC_MISMATCH] RHS vector length (${b.length}) does not match matrix dimension (${n})`);
    }

    const relTol = options.relativeTolerance ?? 1e-9;
    const absTol = options.absoluteTolerance ?? 1e-12;
    const maxIter = options.maxIterations ?? Math.max(100, Math.min(10000, 2 * n));
    const precondType = options.preconditioner ?? 'JACOBI';

    // 1. Setup Preconditioner M^-1
    const diag = A.getDiagonal();
    const invDiag = new Float64Array(n);

    if (precondType === 'JACOBI') {
      for (let i = 0; i < n; i++) {
        const d = diag[i];
        if (d <= 1e-25 || !Number.isFinite(d)) {
          throw new Error(
            `[PCG_NON_SPD_DIAGONAL] Matrix is not strictly positive-definite. Diagonal entry at index ${i} is non-positive or non-finite: ${d}`
          );
        }
        invDiag[i] = 1.0 / d;
      }
    } else {
      invDiag.fill(1.0);
    }

    // 2. Initialize Solution Vector x_0 and Residual r_0 = b - A * x_0
    const x = new Float64Array(n);
    if (options.initialGuess) {
      for (let i = 0; i < n; i++) x[i] = options.initialGuess[i];
    }

    // SpMV: Ax = A * x
    const Ax = A.multiplyVector(x);
    const r = new Float64Array(n);
    let r0NormSq = 0;

    for (let i = 0; i < n; i++) {
      r[i] = b[i] - Ax[i];
      r0NormSq += r[i] * r[i];
    }

    const initialResidualNorm = Math.sqrt(r0NormSq);

    // If initial guess already satisfies absolute tolerance:
    if (initialResidualNorm <= absTol) {
      const endTime = performance.now();
      return {
        x,
        diagnostics: {
          converged: true,
          iterations: 0,
          initialResidualNorm,
          finalResidualNorm: initialResidualNorm,
          relativeResidual: 0,
          executionTimeMs: endTime - startTime,
          preconditionerUsed: precondType,
          reason: 'Initial guess already satisfied absolute tolerance'
        }
      };
    }

    // 3. z_0 = M^-1 * r_0
    const z = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      z[i] = invDiag[i] * r[i];
    }

    // 4. p_0 = z_0
    const p = new Float64Array(n);
    p.set(z);

    // rz_old = r^T * z
    let rz_old = 0;
    for (let i = 0; i < n; i++) {
      rz_old += r[i] * z[i];
    }

    let iterations = 0;
    let finalResidualNorm = initialResidualNorm;

    // 5. Main PCG Iteration Loop
    while (iterations < maxIter) {
      iterations++;

      // Ap = A * p
      const Ap = A.multiplyVector(p);

      // Curvature check: p^T * A * p
      let pAp = 0;
      for (let i = 0; i < n; i++) {
        pAp += p[i] * Ap[i];
      }

      // Check SPD condition: p^T A p must be strictly positive
      if (pAp <= 1e-25 || !Number.isFinite(pAp)) {
        throw new Error(
          `[PCG_NON_SPD_CURVATURE] System failed positive-definite test at iteration ${iterations}. p^T A p = ${pAp}`
        );
      }

      // Step length: alpha = (r^T * z) / (p^T * A * p)
      const alpha = rz_old / pAp;

      // Update solution: x_{k+1} = x_k + alpha * p_k
      // Update residual: r_{k+1} = r_k - alpha * A * p_k
      let rNormSq = 0;
      for (let i = 0; i < n; i++) {
        x[i] += alpha * p[i];
        r[i] -= alpha * Ap[i];
        rNormSq += r[i] * r[i];
      }

      finalResidualNorm = Math.sqrt(rNormSq);
      const relRes = finalResidualNorm / initialResidualNorm;

      // Convergence Check
      if (finalResidualNorm <= absTol || relRes <= relTol) {
        const endTime = performance.now();
        return {
          x,
          diagnostics: {
            converged: true,
            iterations,
            initialResidualNorm,
            finalResidualNorm,
            relativeResidual: relRes,
            executionTimeMs: endTime - startTime,
            preconditionerUsed: precondType,
            reason: `CONVERGED (finalRes=${finalResidualNorm.toExponential(4)}, relRes=${relRes.toExponential(4)})`
          }
        };
      }

      // Apply Preconditioner: z_{k+1} = M^-1 * r_{k+1}
      for (let i = 0; i < n; i++) {
        z[i] = invDiag[i] * r[i];
      }

      // rz_new = r_{k+1}^T * z_{k+1}
      let rz_new = 0;
      for (let i = 0; i < n; i++) {
        rz_new += r[i] * z[i];
      }

      // Direction update factor: beta = (r_{k+1}^T * z_{k+1}) / (r_k^T * z_k)
      const beta = rz_new / rz_old;
      rz_old = rz_new;

      // Update search direction: p_{k+1} = z_{k+1} + beta * p_k
      for (let i = 0; i < n; i++) {
        p[i] = z[i] + beta * p[i];
      }
    }

    // Reached max iterations without convergence
    const endTime = performance.now();
    const relRes = finalResidualNorm / initialResidualNorm;
    throw new Error(
      `[PCG_CONVERGENCE_FAILURE] PCG solver failed to converge within ${maxIter} iterations. ` +
      `Initial residual norm = ${initialResidualNorm.toExponential(4)}, Final residual norm = ${finalResidualNorm.toExponential(4)}, Relative residual = ${relRes.toExponential(4)}`
    );
  }
}
