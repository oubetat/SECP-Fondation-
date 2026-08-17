/**
 * PATCH-SECP-085: WebAssembly Performance Benchmark Test Suite
 *
 * Runs full HPC benchmark harness across FEA, CFD, and 5-Axis CAM measuring execution speedup ratios.
 */

import { describe, test, expect } from 'vitest';
import { HpcBenchmarkHarness } from '../benchmarks/HpcBenchmarkHarness';

export function runPerformanceTests(): { name: string; passed: boolean; details: string }[] {
  const results: { name: string; passed: boolean; details: string }[] = [];

  try {
    const benchmarks = HpcBenchmarkHarness.runFullBenchmarkSuite();
    const passedCount = benchmarks.length;

    results.push({
      name: 'HPC Benchmark Harness Execution',
      passed: passedCount > 0,
      details: `Successfully executed ${passedCount} benchmark workloads across Small, Medium, Large, and Stress scales`
    });

    // Check speedup ratio positive
    const allPositiveSpeedup = benchmarks.every(b => b.speedupRatio >= 1.0);
    results.push({
      name: 'WASM Runtime Speedup Ratio Verification',
      passed: allPositiveSpeedup,
      details: allPositiveSpeedup ? 'All WASM workloads achieved positive speedup over TS reference' : 'Some WASM workloads failed speedup check'
    });

  } catch (err: any) {
    results.push({ name: 'HPC Benchmark Harness Execution', passed: false, details: err.message });
  }

  return results;
}

describe('SECP085 Performance Test Suite', () => {
  const results = runPerformanceTests();
  for (const r of results) {
    test(r.name, () => {
      expect(r.passed).toBe(true);
    });
  }
});
