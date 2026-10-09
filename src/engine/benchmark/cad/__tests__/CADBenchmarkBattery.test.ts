/**
 * PATCH-171 — CAD Benchmark Battery Comprehensive Test Suite
 */

import { describe, it, expect } from 'vitest';
import { CADBenchmarkBattery } from '../CADBenchmarkBattery';
import { HardAcceptanceGate171 } from '../HardAcceptanceGate171';
import { BenchmarkCategory, BenchmarkVerdict } from '../types';

describe('PATCH-171: CAD Benchmark Battery Core Suite', () => {
  it('executes full 20-category benchmark battery without exceptions', async () => {
    const report = await CADBenchmarkBattery.runFullBattery();
    expect(report.totalCases).toBeGreaterThanOrEqual(20);
    expect(report.passedCount).toBeGreaterThan(0);
    expect(report.failedCount).toBe(0);
    expect(report.overallVerdict).toBe(BenchmarkVerdict.PROVEN);
  });

  it('passes Hard Acceptance Gate 171 evaluation', async () => {
    const gateReport = await HardAcceptanceGate171.evaluate();
    expect(gateReport.verdict).toBe('PASS');
    expect(gateReport.checks.length).toBe(7);
    expect(gateReport.checks.every(c => c.passed)).toBe(true);
  });
});
