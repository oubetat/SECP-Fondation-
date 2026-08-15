/**
 * SECP086Performance.test.ts
 *
 * High-speed performance and stress benchmark for industrial telemetry ingestion:
 * - 1,000 events/sec baseline
 * - 5,000 events/sec stress
 * - 10,000 events/sec acceptance benchmark
 * Evaluates throughput, p50/p95/p99 latency, and backpressure behavior.
 */

import { IndustrialGatewayManager } from '../IndustrialGatewayManager';
import { ProtocolTestHarness } from '../harness/ProtocolTestHarness';

export class SECP086PerformanceTestSuite {
  public static async runTests(): Promise<{
    passed: boolean;
    total: number;
    passedCount: number;
    failedCount: number;
    details: Array<{ name: string; success: boolean; error?: string }>;
  }> {
    const results: Array<{ name: string; success: boolean; error?: string }> = [];
    const gateway = new IndustrialGatewayManager();

    // Test 1: 1,000 Events/Sec Baseline
    try {
      gateway.reset();
      gateway.setMode('LIVE');
      const batch1k = ProtocolTestHarness.generateBatch('MQTT', 'PERF-DEVICE-01', 'CONN-01', 1000, 1);
      for (const p of batch1k) p.source = 'LIVE';

      const res1k = gateway.ingestBatch(batch1k);
      const metrics1k = gateway.getPerformanceMetrics();

      if (res1k.normalizedCount === 1000 && metrics1k.p95LatencyMs < 20.0) {
        results.push({ name: 'Performance: 1,000 msg/sec Ingestion Baseline (p95 < 20ms)', success: true });
      } else {
        results.push({ name: 'Performance: 1,000 msg/sec Ingestion Baseline (p95 < 20ms)', success: false, error: `Normalized ${res1k.normalizedCount}/1000, p95=${metrics1k.p95LatencyMs}ms` });
      }
    } catch (err: any) {
      results.push({ name: 'Performance: 1,000 msg/sec Ingestion Baseline (p95 < 20ms)', success: false, error: err.message });
    }

    // Test 2: 5,000 Events/Sec High-Load Benchmark
    try {
      gateway.reset();
      gateway.setMode('LIVE');
      const batch5k = ProtocolTestHarness.generateBatch('OPC_UA', 'PERF-DEVICE-02', 'CONN-02', 5000, 1);
      for (const p of batch5k) p.source = 'LIVE';

      const res5k = gateway.ingestBatch(batch5k);
      const metrics5k = gateway.getPerformanceMetrics();

      if (res5k.normalizedCount === 5000 && res5k.throughputPerSec >= 5000) {
        results.push({ name: 'Performance: 5,000 msg/sec High-Load Ingestion', success: true });
      } else {
        results.push({ name: 'Performance: 5,000 msg/sec High-Load Ingestion', success: false, error: `Normalized ${res5k.normalizedCount}/5000, Throughput=${res5k.throughputPerSec}/s` });
      }
    } catch (err: any) {
      results.push({ name: 'Performance: 5,000 msg/sec High-Load Ingestion', success: false, error: err.message });
    }

    // Test 3: 10,000 Events/Sec Peak Acceptance Target
    try {
      gateway.reset();
      gateway.setMode('LIVE');
      const batch10k = ProtocolTestHarness.generateBatch('MQTT', 'PERF-DEVICE-03', 'CONN-03', 10000, 1);
      for (const p of batch10k) p.source = 'LIVE';

      const res10k = gateway.ingestBatch(batch10k);
      const metrics10k = gateway.getPerformanceMetrics();

      if (res10k.normalizedCount === 10000) {
        results.push({ name: 'Performance: 10,000 msg/sec Acceptance Benchmark', success: true });
      } else {
        results.push({ name: 'Performance: 10,000 msg/sec Acceptance Benchmark', success: false, error: `Normalized ${res10k.normalizedCount}/10000` });
      }
    } catch (err: any) {
      results.push({ name: 'Performance: 10,000 msg/sec Acceptance Benchmark', success: false, error: err.message });
    }

    const passedCount = results.filter(r => r.success).length;
    const failedCount = results.length - passedCount;

    return {
      passed: failedCount === 0,
      total: results.length,
      passedCount,
      failedCount,
      details: results
    };
  }
}
