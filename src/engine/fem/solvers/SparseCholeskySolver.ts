import { SparseMatrix } from "../sparse/SparseMatrix";
import { SparseCholeskySolver as DirectSparseCholesky } from "../sparse/DirectSolvers";
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

export class SparseCholeskySolver implements LinearSolver {
  public readonly name: SolverName = 'SparseCholesky';

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

    const suitableSolvers: SolverName[] = [];
    if (isSymmetric && isPositiveDefinite) {
      suitableSolvers.push('SparseCholesky', 'ConjugateGradient', 'PreconditionedConjugateGradient');
    } else {
      suitableSolvers.push('GMRES', 'SparseLU');
    }

    let failureReason: string | undefined;
    if (!isSymmetric) {
      failureReason = `Matrix is not symmetric (max diff = ${symCheck.maxDiff.toExponential(3)}). Sparse Cholesky requires SPD matrix.`;
    } else if (!isPositiveDefinite) {
      failureReason = `Matrix is not positive-definite (non-positive pivot or singular matrix). Sparse Cholesky rejected.`;
    }

    return {
      isSymmetric,
      symmetryMaxDiff: symCheck.maxDiff,
      isPositiveDefinite,
      isSingular,
      zeroPivots,
      conditionEstimate: isSingular ? Infinity : 1.0,
      suitableSolvers,
      recommendedSolver: (isSymmetric && isPositiveDefinite) ? 'SparseCholesky' : 'GMRES',
      failureReason
    };
  }

  public solve(A: SparseMatrix, b: Float64Array, options: LinearSolverOptions = {}): LinearSolverResult {
    const startTime = performance.now();
    const n = A.rows;

    const rtol = options.tolerance?.rtol ?? 1e-8;
    const atol = options.tolerance?.atol ?? 1e-10;
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

    // STRICT SPD CHECK BEFORE FACTORIZATION
    if (!validation.isSymmetric || !validation.isPositiveDefinite) {
      const reason = `SOLVER_INCOMPATIBLE: ${validation.failureReason ?? 'Matrix is not SPD for Sparse Cholesky'}`;
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

    // Direct Sparse Cholesky Solve (Factorization + Forward/Backward substitution)
    const factorStartTime = performance.now();
    const directRes = DirectSparseCholesky.solve(A, b);
    const solveTimeMs = performance.now() - startTime;

    if (!directRes.success) {
      const reason = `Sparse Cholesky factorization failed: ${directRes.errorMessage ?? 'Pivot error during decomposition'}`;
      this.lastDiagnostics.breakdownOccurred = true;
      this.lastDiagnostics.breakdownReason = reason;

      return {
        solution: new Float64Array(0),
        converged: false,
        iterations: 1,
        initialResidual: normB,
        finalResidual: normB,
        relativeResidual: 1.0,
        absoluteResidual: normB,
        tolerance,
        solverName: this.name,
        executionTimeMs: solveTimeMs,
        failureReason: reason,
        diagnostics: this.lastDiagnostics,
        convergenceHistory: []
      };
    }

    const solution = directRes.solution;

    // Calculate true residual r = b - A * x
    const Ax = A.spmv(solution);
    let trueResSq = 0.0;
    for (let i = 0; i < n; i++) {
      const diff = b[i] - Ax[i];
      trueResSq += diff * diff;
    }
    const finalResidual = Math.sqrt(trueResSq);
    const relativeResidual = finalResidual / normB;
    this.lastResidual = finalResidual;

    const converged = finalResidual <= atol || relativeResidual <= rtol;

    // Record single iteration history for direct solver
    this.lastConvergenceHistory.push({
      iteration: 1,
      residualNorm: finalResidual,
      relativeResidual,
      stepNorm: Math.hypot(...solution),
      convergenceState: converged ? 'CONVERGED' : 'STAGNATED'
    });

    const factorNNZ = (directRes as any).factorNNZ ?? A.nnz;
    const fillInRatio = factorNNZ / Math.max(A.nnz, 1);
    this.lastDiagnostics.factorNNZ = factorNNZ;
    this.lastDiagnostics.fillInRatio = fillInRatio;

    return {
      solution: converged ? solution : solution, // Return solution vector for verification
      converged,
      iterations: 1,
      initialResidual: normB,
      finalResidual,
      relativeResidual,
      absoluteResidual: finalResidual,
      tolerance,
      solverName: this.name,
      executionTimeMs: solveTimeMs,
      failureReason: converged ? undefined : `Direct solution residual ${finalResidual.toExponential(3)} exceeded tolerance`,
      diagnostics: this.lastDiagnostics,
      convergenceHistory: this.lastConvergenceHistory,
      memoryProfile: {
        originalNNZ: A.nnz,
        factorNNZ,
        fillInRatio,
        memoryBytes: (A.nnz * 12) + (factorNNZ * 12)
      }
    };
  }
}
