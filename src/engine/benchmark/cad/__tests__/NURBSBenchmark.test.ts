/**
 * PATCH-171 — NURBS & B-Rep Benchmark Tests
 */

import { describe, it, expect } from 'vitest';
import { CADBenchmarkBattery } from '../CADBenchmarkBattery';
import { BenchmarkCategory, BenchmarkVerdict } from '../types';

describe('PATCH-171: NURBS Benchmark', () => {
  it('evaluates exact circular arcs and handles extreme weights gracefully', async () => {
    const results = await CADBenchmarkBattery.runCategory(BenchmarkCategory.NURBS);
    expect(results.length).toBeGreaterThanOrEqual(2);
    expect(results.every(r => r.verdict === BenchmarkVerdict.PROVEN || r.verdict === BenchmarkVerdict.PASS)).toBe(true);
  });
});
