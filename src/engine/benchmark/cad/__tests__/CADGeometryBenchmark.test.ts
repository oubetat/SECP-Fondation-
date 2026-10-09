/**
 * PATCH-171 — CAD Geometry Benchmark Tests
 */

import { describe, it, expect } from 'vitest';
import { CADBenchmarkBattery } from '../CADBenchmarkBattery';
import { BenchmarkCategory, BenchmarkVerdict } from '../types';

describe('PATCH-171: CAD Geometry Benchmark', () => {
  it('verifies exact solid primitive volume, surface area, and mass properties', async () => {
    const results = await CADBenchmarkBattery.runCategory(BenchmarkCategory.GEOMETRY_CREATION);
    expect(results.length).toBeGreaterThanOrEqual(4);
    for (const r of results) {
      expect(r.verdict).toBe(BenchmarkVerdict.PROVEN);
      expect(r.comparison.oracleMatch).toBe(true);
    }
  });
});
