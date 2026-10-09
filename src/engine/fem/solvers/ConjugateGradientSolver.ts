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

export class ConjugateGradientSolver implements LinearSolver {
  public readonly name: SolverName = 'ConjugateGradient';

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

    // Check positive definiteness via diagonal positivity
    let isPositiveDefinite = isSymmetric && !isSingular;
    if (isPositiveDefinite) {
      for (let i = 0; i < A.rows; i++) {
        if (A.get(i, i) <= 0) {
          isPositiveDefinite = false;
          break;
        }
      }
    }

    const suitableSolvers: SolverName[] = [];
    if (isSymmetric && isPositiveDefinite) {
      suitableSolvers.push('ConjugateGradient', 'PreconditionedConjugateGradient', 'SparseCholesky');
    } else {
      suitableSolvers.push('GMRES', 'SparseLU');
    }

    let recommendedSolver: SolverName = 'ConjugateGradient';
    if (!isSymmetric || !isPositiveDefinite) {
      recommendedSolver = 'GMRES';
    } else if (A.rows > 1000) {
      recommendedSolver = 'PreconditionedConjugateGradient';
    } else {
      recommendedSolver = 'SparseCholesky';
    }

    let failureReason: string | undefined;
    if (!isSymmetric) {
      failureReason = `Matrix is not symmetric (max diff = ${symCheck.maxDiff.toExponential(3)})`;
    } else if (!isPositiveDefinite) {
      failureReason = `Matrix is not positive-definite`;
    } else if (isSingular) {
      failureReason = `Matrix is singular with ${zeroPivots.length} zero diagonal pivots`;
    }

    return {
      isSymmetric,
      symmetryMaxDiff: symCheck.maxDiff,
      isPositiveDefinite,
      isSingular,
      zeroPivots,
      conditionEstimate: isSingular ? Infinity : 1.0,
      suitableSolvers,
      recommendedSolver,
      failureReason
    };
  }

  public solve(A: SparseMatrix, b: Float64Array, options: LinearSolverOptions = {}): LinearSolverResult {
    const startTime = performance.now();
    const n = A.rows;

    const rtol = options.tolerance?.rtol ?? 1e-8;
    const atol = options.tolerance?.atol ?? 1e-10;
    const maxIter = options.maxIterations ?? Math.max(n * 2, 500);

    const tolerance: SolverTolerance = { atol, rtol };

    // Validation check
    const validation = this.validateSystem(A, b);
    const symCheck = A.isSymmetric();

    // Initialize diagnostics
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

    // Pre-flight check: CG strictly requires SPD
    if (!validation.isSymmetric || !validation.isPositiveDefinite) {
      const reason = `ConjugateGradient solver rejected matrix: ${validation.failureReason ?? 'Matrix is not SPD'}`;
      this.lastDiagnostics.breakdownOccurred = true;
      this.lastDiagnostics.breakdownReason = reason;

      return {
        solution: new Float64Array(0),
        converged: false,
        iterations: 0,
        initialResidual: normB,
        finalResidual: normB,
        relativeResidual: 1.0,
        absoluteResidual: normB,
        tolerance,
        solverName: this.name,
        executionTimeMs: performance.now() - startTime,
        failureReason: reason,
        diagnostics: this.lastDiagnostics,
        convergenceHistory: []
      };
    }

    // Initial guess x0 = 0
    const x = new Float64Array(n);
    const r = new Float64Array(b); // r0 = b - A*0 = b
    const p = new Float64Array(b); // p0 = r0

    let rDotR = 0.0;
    for (let i = 0; i < n; i++) {
      rDotR += r[i] * r[i];
    }

    const initialResidualNorm = Math.sqrt(rDotR);
    this.lastResidual = initialResidualNorm;

    // Record iteration 0
    this.lastConvergenceHistory.push({
      iteration: 0,
      residualNorm: initialResidualNorm,
      relativeResidual: initialResidualNorm / normB,
      stepNorm: 0.0,
      convergenceState: (initialResidualNorm <= atol || initialResidualNorm / normB <= rtol) ? 'CONVERGED' : 'CONVERGING'
    });

    if (initialResidualNorm <= atol || initialResidualNorm / normB <= rtol) {
      return {
        solution: x,
        converged: true,
        iterations: 0,
        initialResidual: initialResidualNorm,
        finalResidual: initialResidualNorm,
        relativeResidual: initialResidualNorm / normB,
        absoluteResidual: initialResidualNorm,
        tolerance,
        solverName: this.name,
        executionTimeMs: performance.now() - startTime,
        diagnostics: this.lastDiagnostics,
        convergenceHistory: this.lastConvergenceHistory
      };
    }

    let iterations = 0;
    let converged = false;
    let failureReason: string | undefined;

    for (let k = 0; k < maxIter; k++) {
      iterations = k + 1;

      // w = A * p
      const w = A.spmv(p);

      // Curvature check: p^T * w
      let pDotW = 0.0;
      let pDotP = 0.0;
      for (let i = 0; i < n; i++) {
        pDotW += p[i] * w[i];
        pDotP += p[i] * p[i];
      }

      // Check breakdown due to non-positive curvature
      if (pDotW <= 1e-20 * pDotP || !Number.isFinite(pDotW)) {
        failureReason = `CG Breakdown: Non-positive curvature detected at iteration ${iterations} (p^T A p = ${pDotW.toExponential(3)})`;
        this.lastDiagnostics.breakdownOccurred = true;
        this.lastDiagnostics.breakdownReason = failureReason;
        break;
      }

      const alpha = rDotR / pDotW;

      // Step norm
      let stepNormSq = 0.0;
      for (let i = 0; i < n; i++) {
        const step = alpha * p[i];
        x[i] += step;
        r[i] -= alpha * w[i];
        stepNormSq += step * step;
      }

      let newRDotR = 0.0;
      for (let i = 0; i < n; i++) {
        newRDotR += r[i] * r[i];
      }

      const resNorm = Math.sqrt(newRDotR);
      const relRes = resNorm / normB;
      const stepNorm = Math.sqrt(stepNormSq);
      this.lastResidual = resNorm;

      // Check numerical stability (NaN/Inf)
      if (!Number.isFinite(resNorm)) {
        failureReason = `Numerical Overflow / NaN detected at iteration ${iterations}`;
        this.lastDiagnostics.breakdownOccurred = true;
        this.lastDiagnostics.breakdownReason = failureReason;
        break;
      }

      const state: IterationEntry['convergenceState'] = 
        (resNorm <= atol || relRes <= rtol) ? 'CONVERGED' : 'CONVERGING';

      this.lastConvergenceHistory.push({
        iteration: iterations,
        residualNorm: resNorm,
        relativeResidual: relRes,
        stepNorm,
        convergenceState: state
      });

      if (resNorm <= atol || relRes <= rtol) {
        converged = true;
        break;
      }

      const beta = newRDotR / rDotR;
      rDotR = newRDotR;

      for (let i = 0; i < n; i++) {
        p[i] = r[i] + beta * p[i];
      }
    }

    if (!converged && !failureReason) {
      failureReason = `CG solver reached max iterations (${maxIter}) without converging to rtol ${rtol}`;
    }

    // Verify final true residual r_true = b - A * x
    const AxFinal = A.spmv(x);
    let trueResSq = 0.0;
    for (let i = 0; i < n; i++) {
      const diff = b[i] - AxFinal[i];
      trueResSq += diff * diff;
    }
    const trueFinalResidual = Math.sqrt(trueResSq);
    const finalRelResidual = trueFinalResidual / normB;

    return {
      solution: converged ? x : new Float64Array(0),
      converged,
      iterations,
      initialResidual: initialResidualNorm,
      finalResidual: trueFinalResidual,
      relativeResidual: finalRelResidual,
      absoluteResidual: trueFinalResidual,
      tolerance,
      solverName: this.name,
      executionTimeMs: performance.now() - startTime,
      failureReason: converged ? undefined : failureReason,
      diagnostics: this.lastDiagnostics,
      convergenceHistory: this.lastConvergenceHistory
    };
  }
}
