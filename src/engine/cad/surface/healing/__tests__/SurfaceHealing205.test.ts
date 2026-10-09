import { describe, it, expect } from 'vitest';
import { HardAcceptanceGate205 } from '../HardAcceptanceGate205';

describe('PATCH-205: Surface Healing (Phase 18 — Professional Modeling)', () => {
  it('should pass all mandatory HAG-205 acceptance checks with verdict PROVEN', async () => {
    const report = await HardAcceptanceGate205.evaluateAll();

    if (report.verdict !== 'PROVEN') {
      const failures = report.checks.filter((c) => !c.passed);
      console.error('Failed checks:', failures);
    }

    expect(report.verdict).toBe('PROVEN');
    expect(report.checks.length).toBeGreaterThanOrEqual(39);
    expect(report.failedChecks).toBe(0);
  });
});
