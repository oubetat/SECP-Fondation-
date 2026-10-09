import { describe, it, expect } from 'vitest';
import { HardAcceptanceGate203 } from '../HardAcceptanceGate203';

describe('PATCH-203: NURBS Surface Editing (Phase 18 — Professional Modeling)', () => {
  it('should pass all 25 mandatory HAG-203 acceptance checks with verdict PROVEN', async () => {
    const report = await HardAcceptanceGate203.evaluateAll();

    const failures = report.checks.filter(c => c.status === 'FAIL');
    if (failures.length > 0) {
      console.error('Failed checks:', failures);
    }

    expect(report.verdict).toBe('PROVEN');
    expect(report.checks.length).toBe(25);
    expect(failures.length).toBe(0);
  });
});
