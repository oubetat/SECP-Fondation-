import { SparseMatrix } from "../sparse/SparseMatrix";
import { LinearSolverSelector } from "./LinearSolverSelector";
import { SolverName, LinearSolverResult } from "./LinearSolverTypes";

export interface BenchmarkRunResult {
  solverName: string;
  matrixSize: number;
  nnz: number;
  iterations: number;
  executionTimeMs: number;
  finalResidual: number;
  relativeResidual: number;
  converged: boolean;
  memoryBytes: number;
}

export interface ComparativeBenchmarkReport {
  timestamp: string;
  matrixSize: number;
  nnz: number;
  sparsityRatio: number;
  runs: BenchmarkRunResult[];
  fastestSolver: string;
  mostAccurateSolver: string;
}

export class LinearSolverBenchmark {
  /**
   * Runs side-by-side benchmark comparing solvers on a given sparse matrix system A * x = b
   */
  static runComparativeBenchmark(A: SparseMatrix, b: Float64Array): ComparativeBenchmarkReport {
    const solversToTest: Array<{ name: SolverName; precond?: 'JACOBI' | 'INCOMPLETE_CHOLESKY'; restart?: number }> = [
      { name: 'SparseCholesky' },
      { name: 'ConjugateGradient' },
      { name: 'PreconditionedConjugateGradient', precond: 'JACOBI' },
      { name: 'PreconditionedConjugateGradient', precond: 'INCOMPLETE_CHOLESKY' },
      { name: 'GMRES', restart: 10 },
      { name: 'GMRES', restart: 20 },
      { name: 'GMRES', restart: 50 }
    ];

    const runs: BenchmarkRunResult[] = [];

    for (const item of solversToTest) {
      try {
        const solver = LinearSolverSelector.getSolver(item.name, A, b);
        const res = solver.solve(A, b, {
          tolerance: { atol: 1e-10, rtol: 1e-8 },
          maxIterations: 1000,
          preconditionerType: item.precond,
          restartDimension: item.restart
        });

        runs.push({
          solverName: res.solverName,
          matrixSize: A.rows,
          nnz: A.nnz,
          iterations: res.iterations,
          executionTimeMs: res.executionTimeMs,
          finalResidual: res.finalResidual,
          relativeResidual: res.relativeResidual,
          converged: res.converged,
          memoryBytes: (A.nnz * 12) + (res.memoryProfile?.factorNNZ ?? 0) * 12
        });
      } catch (err) {
        // Skip incompatible solvers gracefully
      }
    }

    const successfulRuns = runs.filter(r => r.converged);

    let fastestSolver = 'None';
    let minTime = Infinity;
    for (const r of successfulRuns) {
      if (r.executionTimeMs < minTime) {
        minTime = r.executionTimeMs;
        fastestSolver = r.solverName;
      }
    }

    let mostAccurateSolver = 'None';
    let minRes = Infinity;
    for (const r of successfulRuns) {
      if (r.finalResidual < minRes) {
        minRes = r.finalResidual;
        mostAccurateSolver = r.solverName;
      }
    }

    return {
      timestamp: new Date().toISOString(),
      matrixSize: A.rows,
      nnz: A.nnz,
      sparsityRatio: A.sparsityRatio,
      runs,
      fastestSolver,
      mostAccurateSolver
    };
  }
}
