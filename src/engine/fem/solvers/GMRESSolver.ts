import { SparseMatrix } from "../sparse/SparseMatrix";
import {
  LinearSolver,
  SolverName,
  LinearSolverOptions,
  LinearSolverResult,
  SolverValidationResult,
  SolverDiagnostics,
  IterationEntry,
  SolverTolerance
} from "./LinearSolverTypes";

export class GMRESSolver implements LinearSolver {
  public readonly name: SolverName = 'GMRES';

  private lastDiagnostics: SolverDiagnostics | null = null;
  private lastConvergenceHistory: IterationEntry[] = [];
  private lastResidual: number = Infinity;

  public getDiagnostics(): SolverDiagnostics | null {
    return this.lastDiagnostics;
  }

  public getConvergenceHistory(): IterationEntry[] {
    return this.lastConvergenceHistory;
  }

  public getResidual(): number {
    return this.lastResidual;
  }

  public validateSystem(A: SparseMatrix, b: Float64Array): SolverValidationResult {
    const symCheck = A.isSymmetric();
    const isSymmetric = symCheck.isSymmetric;
    const zeroPivots: number[] = [];

    let isSingular = false;
    for (let i = 0; i < A.rows; i++) {
      const diagVal = A.get(i, i);
      if (Math.abs(diagVal) < 1e-14) {
        zeroPivots.push(i);
        isSingular = true;
      }
    }

    let isPositiveDefinite = isSymmetric && !isSingular;
    if (isPositiveDefinite) {
      for (let i = 0; i < A.rows; i++) {
        if (A.get(i, i) <= 0) {
          isPositiveDefinite = false;
          break;
        }
      }
    }

    const suitableSolvers: SolverName[] = ['GMRES', 'SparseLU'];
    if (isSymmetric && isPositiveDefinite) {
      suitableSolvers.push('ConjugateGradient', 'PreconditionedConjugateGradient', 'SparseCholesky');
    }

    return {
      isSymmetric,
      symmetryMaxDiff: symCheck.maxDiff,
      isPositiveDefinite,
      isSingular,
      zeroPivots,
      conditionEstimate: isSingular ? Infinity : 1.0,
      suitableSolvers,
      recommendedSolver: 'GMRES',
      failureReason: isSingular ? `Matrix has ${zeroPivots.length} zero diagonal entries` : undefined
    };
  }

  public solve(A: SparseMatrix, b: Float64Array, options: LinearSolverOptions = {}): LinearSolverResult {
    const startTime = performance.now();
    const n = A.rows;

    const rtol = options.tolerance?.rtol ?? 1e-8;
    const atol = options.tolerance?.atol ?? 1e-10;
    const maxIter = options.maxIterations ?? Math.max(n * 2, 500);
    const m = options.restartDimension ?? Math.min(n, 20);

    const tolerance: SolverTolerance = { atol, rtol };

    const validation = this.validateSystem(A, b);
    const rhsNorm = Math.hypot(...b);
    const normB = rhsNorm > 0 ? rhsNorm : 1.0;

    this.lastDiagnostics = {
      isSymmetric: validation.isSymmetric,
      symmetryMaxDiff: validation.symmetryMaxDiff,
      isPositiveDefinite: validation.isPositiveDefinite,
      isSingular: validation.isSingular,
      zeroPivotCount: validation.zeroPivots.length,
      conditionEstimate: validation.conditionEstimate,
      matrixNorm: A.frobeniusNorm(),
      rhsNorm,
      originalNNZ: A.nnz,
      breakdownOccurred: false
    };

    this.lastConvergenceHistory = [];

    const x = new Float64Array(n);
    let totalIterations = 0;
    let converged = false;
    let failureReason: string | undefined;

    // Check initial residual
    const r0 = new Float64Array(b); // r0 = b - A*0
    let beta = Math.hypot(...r0);
    this.lastResidual = beta;

    this.lastConvergenceHistory.push({
      iteration: 0,
      residualNorm: beta,
      relativeResidual: beta / normB,
      stepNorm: 0.0,
      convergenceState: (beta <= atol || beta / normB <= rtol) ? 'CONVERGED' : 'CONVERGING'
    });

    if (beta <= atol || beta / normB <= rtol) {
      return {
        solution: x,
        converged: true,
        iterations: 0,
        initialResidual: beta,
        finalResidual: beta,
        relativeResidual: beta / normB,
        absoluteResidual: beta,
        tolerance,
        solverName: `${this.name}(${m})`,
        executionTimeMs: performance.now() - startTime,
        diagnostics: this.lastDiagnostics,
        convergenceHistory: this.lastConvergenceHistory
      };
    }

    const initialResidual = beta;

    // Outer GMRES(m) restart loop
    while (totalIterations < maxIter && !converged) {
      // Calculate current residual r = b - A*x
      const Ax = A.spmv(x);
      const r = new Float64Array(n);
      for (let i = 0; i < n; i++) r[i] = b[i] - Ax[i];
      beta = Math.hypot(...r);

      if (beta <= atol || beta / normB <= rtol) {
        converged = true;
        break;
      }

      // Krylov basis V: (m+1) vectors of length n
      const V: Float64Array[] = Array.from({ length: m + 1 }, () => new Float64Array(n));
      for (let i = 0; i < n; i++) V[0][i] = r[i] / beta;

      // Upper Hessenberg H: (m+1) x m
      const H: number[][] = Array.from({ length: m + 1 }, () => new Array(m).fill(0.0));

      // Givens rotations
      const cs = new Float64Array(m);
      const sn = new Float64Array(m);

      // RHS vector for least squares system g = [beta, 0, ..., 0]^T
      const g = new Float64Array(m + 1);
      g[0] = beta;

      let kStep = 0;
      for (let k = 0; k < m && totalIterations < maxIter; k++) {
        kStep = k;
        totalIterations++;

        // w = A * V[k]
        const w = A.spmv(V[k]);

        // Modified Gram-Schmidt orthogonalization
        for (let i = 0; i <= k; i++) {
          let dot = 0.0;
          for (let d = 0; d < n; d++) dot += w[d] * V[i][d];
          H[i][k] = dot;
          for (let d = 0; d < n; d++) w[d] -= dot * V[i][d];
        }

        const hNext = Math.hypot(...w);
        H[k + 1][k] = hNext;

        // Apply previous Givens rotations to column k of H
        for (let i = 0; i < k; i++) {
          const temp = cs[i] * H[i][k] + sn[i] * H[i + 1][k];
          H[i + 1][k] = -sn[i] * H[i][k] + cs[i] * H[i + 1][k];
          H[i][k] = temp;
        }

        // Check Arnoldi breakdown or exact convergence
        if (Math.abs(hNext) > 1e-15) {
          for (let d = 0; d < n; d++) V[k + 1][d] = w[d] / hNext;
        }

        // Compute new Givens rotation for (H[k][k], H[k+1][k])
        const hkk = H[k][k];
        const hk1k = H[k + 1][k];
        const gamma = Math.hypot(hkk, hk1k);

        if (gamma < 1e-20) {
          cs[k] = 1.0;
          sn[k] = 0.0;
        } else {
          cs[k] = hkk / gamma;
          sn[k] = hk1k / gamma;
        }

        H[k][k] = cs[k] * hkk + sn[k] * hk1k;
        H[k + 1][k] = 0.0;

        // Update g vector
        g[k + 1] = -sn[k] * g[k];
        g[k] = cs[k] * g[k];

        const estResidual = Math.abs(g[k + 1]);
        const relRes = estResidual / normB;
        this.lastResidual = estResidual;

        const state: IterationEntry['convergenceState'] = 
          (estResidual <= atol || relRes <= rtol) ? 'CONVERGED' : 'CONVERGING';

        this.lastConvergenceHistory.push({
          iteration: totalIterations,
          residualNorm: estResidual,
          relativeResidual: relRes,
          stepNorm: 0.0,
          convergenceState: state
        });

        if (estResidual <= atol || relRes <= rtol) {
          converged = true;
          break;
        }

        if (Math.abs(hNext) < 1e-15) {
          // Arnoldi breakdown (exact sub-Krylov space invariant)
          break;
        }
      }

      // Solve upper triangular system H_{0..kStep, 0..kStep} * y = g_{0..kStep}
      const kDim = converged || Math.abs(H[kStep + 1][kStep]) < 1e-15 ? kStep + 1 : kStep + 1;
      const y = new Float64Array(kDim);
      for (let i = kDim - 1; i >= 0; i--) {
        let sum = g[i];
        for (let j = i + 1; j < kDim; j++) {
          sum -= H[i][j] * y[j];
        }
        y[i] = Math.abs(H[i][i]) > 1e-20 ? sum / H[i][i] : 0.0;
      }

      // Update solution x = x + V_{0..kDim-1} * y
      for (let i = 0; i < kDim; i++) {
        for (let d = 0; d < n; d++) {
          x[d] += y[i] * V[i][d];
        }
      }

      // Verify true residual after restart block
      const AxCheck = A.spmv(x);
      let trueResSq = 0.0;
      for (let d = 0; d < n; d++) {
        const diff = b[d] - AxCheck[d];
        trueResSq += diff * diff;
      }
      const trueRes = Math.sqrt(trueResSq);

      if (trueRes <= atol || trueRes / normB <= rtol) {
        converged = true;
        break;
      }
    }

    if (!converged && !failureReason) {
      failureReason = `GMRES(${m}) reached max iterations (${maxIter}) without converging to rtol ${rtol}`;
    }

    // Final true residual
    const AxFinal = A.spmv(x);
    let trueResSq = 0.0;
    for (let d = 0; d < n; d++) {
      const diff = b[d] - AxFinal[d];
      trueResSq += diff * diff;
    }
    const trueFinalResidual = Math.sqrt(trueResSq);

    return {
      solution: converged ? x : (totalIterations > 0 ? x : new Float64Array(0)),
      converged,
      iterations: totalIterations,
      initialResidual,
      finalResidual: trueFinalResidual,
      relativeResidual: trueFinalResidual / normB,
      absoluteResidual: trueFinalResidual,
      tolerance,
      solverName: `${this.name}(${m})`,
      executionTimeMs: performance.now() - startTime,
      failureReason: converged ? undefined : failureReason,
      diagnostics: this.lastDiagnostics,
      convergenceHistory: this.lastConvergenceHistory
    };
  }
}
