/**
 * SECP Industrial OS v3 — Real CAM Kernel
 * PATCH-262 — Hard Acceptance Gate 262
 * 
 * Verifies mathematical determinism, controller dialect adherence,
 * machine limit compliance, and generates the cryptographic Gate 262 certificate.
 */

import { PostBenchmarks, BenchmarkResult } from './PostBenchmarks';
import { generateDeterministicHash } from '../../../lib/hash';

export interface Gate262Report {
  gateId: 'GATE-262-POST-PROCESSOR';
  gateName: 'Real CAM Post Processor & NC Generation Hard Acceptance Gate';
  passed: boolean;
  timestamp: number;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  benchmarksPassed: boolean;
  adversarialPassed: boolean;
  deterministicPassed: boolean;
  testResults: BenchmarkResult[];
  complianceCertificateDigestSha256: string;
}

export class HardAcceptanceGate262 {
  public static async executeGate(): Promise<Gate262Report> {
    const timestamp = Date.now();
    const testResults = await PostBenchmarks.runAllBenchmarks();

    const totalTests = testResults.length;
    const passedTests = testResults.filter(t => t.passed).length;
    const failedTests = totalTests - passedTests;

    const benchmarks = testResults.filter(t => t.category === 'BENCHMARK_REFERENCE');
    const adversarial = testResults.filter(t => t.category === 'NEGATIVE_ADVERSARIAL');
    const deterministic = testResults.filter(t => t.category === 'DETERMINISTIC_HASH');

    const benchmarksPassed = benchmarks.length > 0 && benchmarks.every(t => t.passed);
    const adversarialPassed = adversarial.length > 0 && adversarial.every(t => t.passed);
    const deterministicPassed = deterministic.length > 0 && deterministic.every(t => t.passed);

    const passed = failedTests === 0 && benchmarksPassed && adversarialPassed && deterministicPassed;

    const certificatePayload = {
      gateId: 'GATE-262-POST-PROCESSOR',
      timestamp,
      totalTests,
      passedTests,
      failedTests,
      summary: testResults.map(r => `${r.benchmarkId}:${r.passed ? 'PASS' : 'FAIL'}`)
    };

    const digest = await generateDeterministicHash(certificatePayload);

    return {
      gateId: 'GATE-262-POST-PROCESSOR',
      gateName: 'Real CAM Post Processor & NC Generation Hard Acceptance Gate',
      passed,
      timestamp,
      totalTests,
      passedTests,
      failedTests,
      benchmarksPassed,
      adversarialPassed,
      deterministicPassed,
      testResults,
      complianceCertificateDigestSha256: digest
    };
  }
}
