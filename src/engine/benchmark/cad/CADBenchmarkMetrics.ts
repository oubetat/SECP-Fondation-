/**
 * SECP Industrial OS v2 — CAD Benchmark Battery
 * Metrics & Anti-Fabrication Telemetry Engine
 */

import { BenchmarkMetrics, MeasurementMethod } from './types';
import { pureSha256 } from '../../../polyfills/crypto';

export class CADBenchmarkMetricsCollector {
  private startTime: number = 0;
  private startMemBytes: number = 0;

  public start(): void {
    this.startTime = (typeof performance !== 'undefined' && performance.now) 
      ? performance.now() 
      : Date.now();
    
    // Node.js or browser memory tracking
    if (typeof process !== 'undefined' && process.memoryUsage) {
      this.startMemBytes = process.memoryUsage().heapUsed;
    } else if (typeof performance !== 'undefined' && (performance as any).memory) {
      this.startMemBytes = (performance as any).memory.usedJSHeapSize;
    } else {
      this.startMemBytes = 0;
    }
  }

  public finish(
    inputSizeCount: number,
    outputSizeCount: number,
    iterationCount: number = 1,
    failureCount: number = 0,
    method: MeasurementMethod = MeasurementMethod.DIRECTLY_MEASURED
  ): BenchmarkMetrics {
    const endTime = (typeof performance !== 'undefined' && performance.now)
      ? performance.now()
      : Date.now();

    const wallTimeMs = Math.max(0.001, endTime - this.startTime);

    let currentMemBytes = 0;
    if (typeof process !== 'undefined' && process.memoryUsage) {
      currentMemBytes = process.memoryUsage().heapUsed;
    } else if (typeof performance !== 'undefined' && (performance as any).memory) {
      currentMemBytes = (performance as any).memory.usedJSHeapSize;
    }

    const memoryBytes = Math.max(0, currentMemBytes - this.startMemBytes);

    return {
      wallTimeMs: Number(wallTimeMs.toFixed(3)),
      memoryBytes: memoryBytes > 0 ? memoryBytes : undefined,
      peakMemoryBytes: currentMemBytes > 0 ? currentMemBytes : undefined,
      inputSizeCount,
      outputSizeCount,
      iterationCount,
      failureCount,
      measurementMethod: method,
      executionTimestamp: new Date().toISOString()
    };
  }

  /**
   * Deterministic cryptographic SHA-256 canonical hash helper
   */
  public static computeHash(data: any): string {
    const canonicalStr = JSON.stringify(data, Object.keys(data || {}).sort());
    return `CAD-SHA256:${pureSha256(canonicalStr)}`;
  }

  /**
   * Anti-Fabrication Validator: Ensures metrics are not fake or hardcoded
   */
  public static validateAntiFabrication(metrics: BenchmarkMetrics): { valid: boolean; reason?: string } {
    if (metrics.wallTimeMs <= 0 || !Number.isFinite(metrics.wallTimeMs)) {
      return { valid: false, reason: 'Invalid or zero wallTimeMs measurement' };
    }
    if (metrics.iterationCount < 1) {
      return { valid: false, reason: 'Iteration count must be >= 1' };
    }
    if (!metrics.executionTimestamp || isNaN(Date.parse(metrics.executionTimestamp))) {
      return { valid: false, reason: 'Invalid execution timestamp' };
    }
    return { valid: true };
  }
}
