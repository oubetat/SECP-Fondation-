/**
 * PATCH-171 — Geometric Predicates Benchmark Tests
 */

import { describe, it, expect } from 'vitest';
import { CADBenchmarkBattery } from '../CADBenchmarkBattery';
import { BenchmarkCategory, BenchmarkVerdict } from '../types';

describe('PATCH-171: Geometric Predicates Benchmark', () => {
  it('evaluates barycentric containment and point-to-plane distance against exact formulas', async () => {
    const results = await CADBenchmarkBattery.runCategory(BenchmarkCategory.GEOMETRIC_PREDICATES);
    expect(results.length).toBeGreaterThanOrEqual(2);
    expect(results.every(r => r.verdict === BenchmarkVerdict.PROVEN)).toBe(true);
  });
});
