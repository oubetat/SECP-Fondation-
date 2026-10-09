import { SparseMatrix } from "../sparse/SparseMatrix";
import { JacobiPreconditioner, IncompleteCholeskyPreconditioner, IPreconditioner } from "../sparse/Preconditioner";
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

export class PreconditionedConjugateGradientSolver implements LinearSolver {
  public readonly name: SolverName = 'PreconditionedConjugateGradient';

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

    const suitableSolvers: SolverName[] = ['PreconditionedConjugateGradient', 'ConjugateGradient', 'SparseCholesky'];
    const recommendedSolver: SolverName = isSymmetric && isPositiveDefinite ? 'PreconditionedConjugateGradient' : 'GMRES';

    let failureReason: string | undefined;
    if (!isSymmetric) failureReason = `Matrix is not symmetric`;
    else if (!isPositiveDefinite) failureReason = `Matrix is not positive-definite`;

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
    const precondType = options.preconditionerType ?? 'JACOBI';

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

    if (!validation.isSymmetric || !validation.isPositiveDefinite) {
      const reason = `PCG solver rejected matrix: ${validation.failureReason ?? 'Matrix is not SPD'}`;
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
        solverName: `${this.name} (${precondType})`,
        executionTimeMs: performance.now() - startTime,
        failureReason: reason,
        diagnostics: this.lastDiagnostics,
        convergenceHistory: []
      };
    }

    // Initialize Preconditioner M
    let M: IPreconditioner;
    if (precondType === 'INCOMPLETE_CHOLESKY') {
      M = new IncompleteCholeskyPreconditioner(A);
    } else {
      M = new JacobiPreconditioner(A);
    }

    const x = new Float64Array(n);
    const r = new Float64Array(b); // r0 = b - A*0 = b
    const z = M.apply(r);          // z0 = M^-1 * r0
    const p = new Float64Array(z); // p0 = z0

    let rDotZ = 0.0;
    for (let i = 0; i < n; i++) {
      rDotZ += r[i] * z[i];
    }

    const initialResidualNorm = Math.hypot(...r);
    this.lastResidual = initialResidualNorm;

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
        solverName: `${this.name} (${precondType})`,
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

      let pDotW = 0.0;
      let pDotP = 0.0;
      for (let i = 0; i < n; i++) {
        pDotW += p[i] * w[i];
        pDotP += p[i] * p[i];
      }

      if (pDotW <= 1e-20 * pDotP || !Number.isFinite(pDotW)) {
        failureReason = `PCG Breakdown: Non-positive curvature detected at iteration ${iterations} (p^T A p = ${pDotW.toExponential(3)})`;
        this.lastDiagnostics.breakdownOccurred = true;
        this.lastDiagnostics.breakdownReason = failureReason;
        break;
      }

      const alpha = rDotZ / pDotW;

      let stepNormSq = 0.0;
      for (let i = 0; i < n; i++) {
        const step = alpha * p[i];
        x[i] += step;
        r[i] -= alpha * w[i];
        stepNormSq += step * step;
      }

      const resNorm = Math.hypot(...r);
      const relRes = resNorm / normB;
      const stepNorm = Math.sqrt(stepNormSq);
      this.lastResidual = resNorm;

      if (!Number.isFinite(resNorm)) {
        failureReason = `Numerical Overflow / NaN in PCG at iteration ${iterations}`;
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

      // z = M^-1 * r
      const zNew = M.apply(r);

      let newRDotZ = 0.0;
      for (let i = 0; i < n; i++) {
        newRDotZ += r[i] * zNew[i];
      }

      const beta = newRDotZ / rDotZ;
      rDotZ = newRDotZ;

      for (let i = 0; i < n; i++) {
        p[i] = zNew[i] + beta * p[i];
      }
    }

    if (!converged && !failureReason) {
      failureReason = `PCG solver reached max iterations (${maxIter}) without converging to rtol ${rtol}`;
    }

    // Verify true residual r_true = b - A * x
    const AxFinal = A.spmv(x);
    let trueResSq = 0.0;
    for (let i = 0; i < n; i++) {
      const diff = b[i] - AxFinal[i];
      trueResSq += diff * diff;
    }
    const trueFinalResidual = Math.sqrt(trueResSq);

    return {
      solution: converged ? x : new Float64Array(0),
      converged,
      iterations,
      initialResidual: initialResidualNorm,
      finalResidual: trueFinalResidual,
      relativeResidual: trueFinalResidual / normB,
      absoluteResidual: trueFinalResidual,
      tolerance,
      solverName: `${this.name} (${precondType})`,
      executionTimeMs: performance.now() - startTime,
      failureReason: converged ? undefined : failureReason,
      diagnostics: this.lastDiagnostics,
      convergenceHistory: this.lastConvergenceHistory
    };
  }
}
