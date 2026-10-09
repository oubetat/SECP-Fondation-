/**
 * PATCH-171 — Determinism Benchmark Tests
 */

import { describe, it, expect } from 'vitest';
import { CADBenchmarkBattery } from '../CADBenchmarkBattery';
import { BenchmarkCategory, BenchmarkVerdict } from '../types';

describe('PATCH-171: Determinism Benchmark', () => {
  it('guarantees 100% bit-exact hash invariance across sequential execution runs', async () => {
    const results = await CADBenchmarkBattery.runCategory(BenchmarkCategory.DETERMINISM);
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].verdict).toBe(BenchmarkVerdict.PROVEN);
  });
});
