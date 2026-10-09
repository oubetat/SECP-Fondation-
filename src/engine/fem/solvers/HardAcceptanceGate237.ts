import { LinearSolverBenchmarks, BenchmarkTestResult } from "./benchmarks/LinearSolverBenchmarks";

export interface Gate237Evaluation {
  patchId: 'PATCH-237';
  patchName: 'Linear Solvers';
  verdict: 'PROVEN' | 'NOT_PROVEN';
  overallScore: number;
  totalTests: number;
  passCount: number;
  failCount: number;
  tests: BenchmarkTestResult[];
  timestamp: string;
  summary: string;
}

export class HardAcceptanceGate237 {
  /**
   * Executes all 18 Hard Acceptance Gate verification tests for PATCH-237
   */
  static runGate(): Gate237Evaluation {
    const tests: BenchmarkTestResult[] = [
      LinearSolverBenchmarks.runTest01(),
      LinearSolverBenchmarks.runTest02(),
      LinearSolverBenchmarks.runTest03(),
      LinearSolverBenchmarks.runTest04(),
      LinearSolverBenchmarks.runTest05(),
      LinearSolverBenchmarks.runTest06(),
      LinearSolverBenchmarks.runTest07(),
      LinearSolverBenchmarks.runTest08(),
      LinearSolverBenchmarks.runTest09(),
      LinearSolverBenchmarks.runTest10(),
      LinearSolverBenchmarks.runTest11(),
      LinearSolverBenchmarks.runTest12(),
      LinearSolverBenchmarks.runTest13(),
      LinearSolverBenchmarks.runTest14(),
      LinearSolverBenchmarks.runTest15(),
      LinearSolverBenchmarks.runTest16(),
      LinearSolverBenchmarks.runTest17(),
      LinearSolverBenchmarks.runTest18()
    ];

    const passCount = tests.filter(t => t.passed).length;
    const failCount = tests.length - passCount;
    const overallScore = Math.round((passCount / tests.length) * 100);
    const verdict: 'PROVEN' | 'NOT_PROVEN' = passCount === tests.length ? 'PROVEN' : 'NOT_PROVEN';

    const summary = verdict === 'PROVEN'
      ? `GATE 237 PROVEN (100%): All 18 verification tests passed. Production-grade Linear Solver Engine fully operational with Conjugate Gradient (CG), Preconditioned CG (PCG), GMRES(m) Restart, Sparse Cholesky, automated matrix selection policy, and full FEM integration.`
      : `GATE 237 NOT PROVEN (${passCount}/${tests.length} passed): ${failCount} tests failed verification.`;

    return {
      patchId: 'PATCH-237',
      patchName: 'Linear Solvers',
      verdict,
      overallScore,
      totalTests: tests.length,
      passCount,
      failCount,
      tests,
      timestamp: new Date().toISOString(),
      summary
    };
  }
}
