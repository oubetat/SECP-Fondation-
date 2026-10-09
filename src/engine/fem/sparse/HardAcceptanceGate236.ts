import { SparseMatrixBenchmarks, BenchmarkTestResult } from "./benchmarks/SparseMatrixBenchmarks";
import { ParallelismBoundary, ParallelismVerdict } from "./ParallelismBoundary";

export interface Gate236Evaluation {
  patchId: 'PATCH-236';
  patchName: 'Sparse Matrix Backend';
  verdict: 'PROVEN' | 'NOT_PROVEN';
  overallScore: number;
  totalTests: number;
  passCount: number;
  failCount: number;
  tests: BenchmarkTestResult[];
  parallelismVerdicts: ParallelismVerdict[];
  timestamp: string;
  summary: string;
}

export class HardAcceptanceGate236 {
  /**
   * Runs all 16 Hard Acceptance Gate tests for PATCH-236
   */
  static runGate(): Gate236Evaluation {
    const tests: BenchmarkTestResult[] = [
      SparseMatrixBenchmarks.runTest01(),
      SparseMatrixBenchmarks.runTest02(),
      SparseMatrixBenchmarks.runTest03(),
      SparseMatrixBenchmarks.runTest04(),
      SparseMatrixBenchmarks.runTest05(),
      SparseMatrixBenchmarks.runTest06(),
      SparseMatrixBenchmarks.runTest07(),
      SparseMatrixBenchmarks.runTest08(),
      SparseMatrixBenchmarks.runTest09(),
      SparseMatrixBenchmarks.runTest10(),
      SparseMatrixBenchmarks.runTest11(),
      SparseMatrixBenchmarks.runTest12(),
      SparseMatrixBenchmarks.runTest13(),
      SparseMatrixBenchmarks.runTest14(),
      SparseMatrixBenchmarks.runTest15(),
      SparseMatrixBenchmarks.runTest16()
    ];

    const passCount = tests.filter(t => t.passed).length;
    const failCount = tests.length - passCount;
    const overallScore = Math.round((passCount / tests.length) * 100);
    const verdict: 'PROVEN' | 'NOT_PROVEN' = passCount === tests.length ? 'PROVEN' : 'NOT_PROVEN';

    const parallelismVerdicts: ParallelismVerdict[] = [
      ParallelismBoundary.inspectBackend('CPU_SINGLE_THREAD'),
      ParallelismBoundary.inspectBackend('WEBGPU'),
      ParallelismBoundary.inspectBackend('WASM_SIMD')
    ];

    const summary = verdict === 'PROVEN'
      ? `GATE 236 PROVEN (100%): All 16 verification tests passed. Production-grade Sparse Matrix Backend (CSR/CSC/COO) fully operational with Direct & Preconditioned Iterative Solvers, real residual diagnostics, and full integration with PATCH-235 BC Engine.`
      : `GATE 236 NOT PROVEN (${passCount}/${tests.length} passed): ${failCount} tests failed verification.`;

    return {
      patchId: 'PATCH-236',
      patchName: 'Sparse Matrix Backend',
      verdict,
      overallScore,
      totalTests: tests.length,
      passCount,
      failCount,
      tests,
      parallelismVerdicts,
      timestamp: new Date().toISOString(),
      summary
    };
  }
}
