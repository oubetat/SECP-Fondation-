import { SparseMatrix } from "./SparseMatrix";
import { IPreconditioner, IdentityPreconditioner } from "./Preconditioner";

export interface IterativeSolverOptions {
  maxIterations?: number;
  tolerance?: number;
  preconditioner?: IPreconditioner;
}

export interface IterativeSolverResult {
  success: boolean;
  solution: Float64Array;
  iterations: number;
  initialResidualNorm: number;
  finalResidualNorm: number;
  relativeResidual: number;
  solverType: 'CG' | 'PCG' | 'GMRES';
  preconditionerType: string;
  errorMessage?: string;
}

export class ConjugateGradientSolver {
  /**
   * Preconditioned Conjugate Gradient Solver (PCG) for SPD sparse systems.
   * Directly operates on Sparse Matrix storage with O(nnz) SpMV per iteration.
   */
  static solve(
    A: SparseMatrix,
    b: Float64Array,
    options: IterativeSolverOptions = {}
  ): IterativeSolverResult {
    const n = A.rows;
    const maxIter = options.maxIterations ?? Math.max(1000, 2 * n);
    const tol = options.tolerance ?? 1e-10;
    const M = options.preconditioner ?? new IdentityPreconditioner();

    const x = new Float64Array(n); // Initial guess x = 0

    // r_0 = b - A * x_0 = b
    const r = new Float64Array(b);
    const z = M.apply(r); // z_0 = M^-1 * r_0
    const p = new Float64Array(z); // p_0 = z_0

    let rNormSq = 0;
    let bNormSq = 0;
    for (let i = 0; i < n; i++) {
      rNormSq += r[i] * r[i];
      bNormSq += b[i] * b[i];
    }

    const initialResidualNorm = Math.sqrt(rNormSq);
    const bNorm = Math.sqrt(bNormSq);

    if (initialResidualNorm <= 1e-15 || bNorm <= 1e-15) {
      return {
        success: true,
        solution: x,
        iterations: 0,
        initialResidualNorm: 0,
        finalResidualNorm: 0,
        relativeResidual: 0,
        solverType: M.type === 'NONE' ? 'CG' : 'PCG',
        preconditionerType: M.type
      };
    }

    let rzOld = 0;
    for (let i = 0; i < n; i++) {
      rzOld += r[i] * z[i];
    }

    const Ap = new Float64Array(n);

    for (let iter = 1; iter <= maxIter; iter++) {
      // Ap = A * p
      A.spmv(p, Ap);

      let pAp = 0;
      for (let i = 0; i < n; i++) {
        pAp += p[i] * Ap[i];
      }

      if (pAp <= 0 || Number.isNaN(pAp) || !Number.isFinite(pAp)) {
        return {
          success: false,
          solution: x,
          iterations: iter,
          initialResidualNorm,
          finalResidualNorm: Math.sqrt(rNormSq),
          relativeResidual: Math.sqrt(rNormSq) / (bNorm > 0 ? bNorm : 1),
          solverType: M.type === 'NONE' ? 'CG' : 'PCG',
          preconditionerType: M.type,
          errorMessage: `Breakdown in Conjugate Gradient: non-positive curvature p^T A p = ${pAp}`
        };
      }

      const alpha = rzOld / pAp;

      for (let i = 0; i < n; i++) {
        x[i] += alpha * p[i];
        r[i] -= alpha * Ap[i];
      }

      let currentRNormSq = 0;
      for (let i = 0; i < n; i++) {
        currentRNormSq += r[i] * r[i];
      }
      const currentRNorm = Math.sqrt(currentRNormSq);
      const relRes = bNorm > 0 ? currentRNorm / bNorm : currentRNorm;

      if (relRes <= tol || currentRNorm <= tol) {
        return {
          success: true,
          solution: x,
          iterations: iter,
          initialResidualNorm,
          finalResidualNorm: currentRNorm,
          relativeResidual: relRes,
          solverType: M.type === 'NONE' ? 'CG' : 'PCG',
          preconditionerType: M.type
        };
      }

      // z_new = M^-1 * r_new
      M.apply(r, z);

      let rzNew = 0;
      for (let i = 0; i < n; i++) {
        rzNew += r[i] * z[i];
      }

      const beta = rzNew / rzOld;

      for (let i = 0; i < n; i++) {
        p[i] = z[i] + beta * p[i];
      }

      rzOld = rzNew;
    }

    // Compute final true residual r_final = b - A * x
    const Ax = A.spmv(x);
    let finalRSq = 0;
    for (let i = 0; i < n; i++) {
      const diff = b[i] - Ax[i];
      finalRSq += diff * diff;
    }
    const finalNorm = Math.sqrt(finalRSq);
    const relRes = bNorm > 0 ? finalNorm / bNorm : finalNorm;

    return {
      success: relRes <= tol * 10,
      solution: x,
      iterations: maxIter,
      initialResidualNorm,
      finalResidualNorm: finalNorm,
      relativeResidual: relRes,
      solverType: M.type === 'NONE' ? 'CG' : 'PCG',
      preconditionerType: M.type,
      errorMessage: relRes > tol * 10 ? `CG did not converge within ${maxIter} iterations` : undefined
    };
  }
}

export class GMRESSolver {
  /**
   * Restarted GMRES Solver for general asymmetric sparse linear systems.
   */
  static solve(
    A: SparseMatrix,
    b: Float64Array,
    options: IterativeSolverOptions & { restart?: number } = {}
  ): IterativeSolverResult {
    const n = A.rows;
    const maxIter = options.maxIterations ?? Math.max(500, n);
    const m = options.restart ?? Math.min(30, n);
    const tol = options.tolerance ?? 1e-10;

    const x = new Float64Array(n);
    const bNorm = Math.sqrt(b.reduce((s, v) => s + v * v, 0));

    if (bNorm === 0) {
      return {
        success: true,
        solution: x,
        iterations: 0,
        initialResidualNorm: 0,
        finalResidualNorm: 0,
        relativeResidual: 0,
        solverType: 'GMRES',
        preconditionerType: 'NONE'
      };
    }

    let totalIter = 0;

    while (totalIter < maxIter) {
      const Ax = A.spmv(x);
      const r = new Float64Array(n);
      for (let i = 0; i < n; i++) r[i] = b[i] - Ax[i];

      const rNorm = Math.sqrt(r.reduce((s, v) => s + v * v, 0));
      if (rNorm / bNorm <= tol) {
        return {
          success: true,
          solution: x,
          iterations: totalIter,
          initialResidualNorm: bNorm,
          finalResidualNorm: rNorm,
          relativeResidual: rNorm / bNorm,
          solverType: 'GMRES',
          preconditionerType: 'NONE'
        };
      }

      // Arnoldi basis vectors V and Hessenberg matrix H
      const V: Float64Array[] = [new Float64Array(n)];
      for (let i = 0; i < n; i++) V[0][i] = r[i] / rNorm;

      const H = Array.from({ length: m + 1 }, () => new Float64Array(m));
      const g = new Float64Array(m + 1);
      g[0] = rNorm;

      const c = new Float64Array(m);
      const s = new Float64Array(m);

      let innerK = 0;

      for (let k = 0; k < m && totalIter < maxIter; k++) {
        totalIter++;
        innerK = k + 1;

        const w = A.spmv(V[k]);

        // Gram-Schmidt orthogonalization
        for (let i = 0; i <= k; i++) {
          let hVal = 0;
          for (let j = 0; j < n; j++) hVal += w[j] * V[i][j];
          H[i][k] = hVal;
          for (let j = 0; j < n; j++) w[j] -= hVal * V[i][j];
        }

        const wNorm = Math.sqrt(w.reduce((sum, v) => sum + v * v, 0));
        H[k + 1][k] = wNorm;

        if (wNorm > 1e-15) {
          const vNext = new Float64Array(n);
          for (let j = 0; j < n; j++) vNext[j] = w[j] / wNorm;
          V.push(vNext);
        }

        // Apply previous Givens rotations to column k of H
        for (let i = 0; i < k; i++) {
          const h1 = H[i][k];
          const h2 = H[i + 1][k];
          H[i][k] = c[i] * h1 + s[i] * h2;
          H[i + 1][k] = -s[i] * h1 + c[i] * h2;
        }

        // Compute current Givens rotation for row k and k+1
        const aVal = H[k][k];
        const bVal = H[k + 1][k];
        const rotNorm = Math.hypot(aVal, bVal);

        if (rotNorm > 1e-15) {
          c[k] = aVal / rotNorm;
          s[k] = bVal / rotNorm;
          H[k][k] = rotNorm;
          H[k + 1][k] = 0;

          const g1 = g[k];
          g[k] = c[k] * g1;
          g[k + 1] = -s[k] * g1;
        }

        if (Math.abs(g[k + 1]) / bNorm <= tol) {
          break;
        }
      }

      // Solve upper triangular system H_k * y = g_k
      const y = new Float64Array(innerK);
      for (let i = innerK - 1; i >= 0; i--) {
        let sum = g[i];
        for (let j = i + 1; j < innerK; j++) {
          sum -= H[i][j] * y[j];
        }
        y[i] = H[i][i] !== 0 ? sum / H[i][i] : 0;
      }

      // Update solution x += V_k * y
      for (let j = 0; j < innerK; j++) {
        for (let i = 0; i < n; i++) {
          x[i] += V[j][i] * y[j];
        }
      }

      const finalAx = A.spmv(x);
      let resSq = 0;
      for (let i = 0; i < n; i++) {
        const diff = b[i] - finalAx[i];
        resSq += diff * diff;
      }
      const currentRes = Math.sqrt(resSq);

      if (currentRes / bNorm <= tol) {
        return {
          success: true,
          solution: x,
          iterations: totalIter,
          initialResidualNorm: bNorm,
          finalResidualNorm: currentRes,
          relativeResidual: currentRes / bNorm,
          solverType: 'GMRES',
          preconditionerType: 'NONE'
        };
      }
    }

    const finalAx = A.spmv(x);
    let resSq = 0;
    for (let i = 0; i < n; i++) {
      const diff = b[i] - finalAx[i];
      resSq += diff * diff;
    }
    const finalRes = Math.sqrt(resSq);

    return {
      success: finalRes / bNorm <= tol * 10,
      solution: x,
      iterations: totalIter,
      initialResidualNorm: bNorm,
      finalResidualNorm: finalRes,
      relativeResidual: finalRes / bNorm,
      solverType: 'GMRES',
      preconditionerType: 'NONE',
      errorMessage: finalRes / bNorm > tol * 10 ? `GMRES failed to converge in ${maxIter} iterations` : undefined
    };
  }
}
