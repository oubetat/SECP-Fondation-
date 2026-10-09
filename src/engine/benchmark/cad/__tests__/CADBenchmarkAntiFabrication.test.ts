/**
 * PATCH-171 — Anti-Fabrication Benchmark Tests
 */

import { describe, it, expect } from 'vitest';
import { CADBenchmarkMetricsCollector } from '../CADBenchmarkMetrics';
import { MeasurementMethod } from '../types';

describe('PATCH-171: Anti-Fabrication Telemetry Verification', () => {
  it('validates genuine metrics and rejects synthetic or negative timing metrics', () => {
    const validMetrics = {
      wallTimeMs: 12.45,
      inputSizeCount: 1,
      outputSizeCount: 1,
      iterationCount: 1,
      failureCount: 0,
      measurementMethod: MeasurementMethod.DIRECTLY_MEASURED,
      executionTimestamp: new Date().toISOString()
    };
    expect(CADBenchmarkMetricsCollector.validateAntiFabrication(validMetrics).valid).toBe(true);

    const invalidTiming = {
      ...validMetrics,
      wallTimeMs: -5
    };
    expect(CADBenchmarkMetricsCollector.validateAntiFabrication(invalidTiming).valid).toBe(false);
  });
});
