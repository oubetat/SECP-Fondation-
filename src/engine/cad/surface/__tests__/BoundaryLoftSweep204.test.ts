import { describe, it, expect } from 'vitest';
import { HardAcceptanceGate204 } from '../HardAcceptanceGate204';

describe('PATCH-204: Boundary / Loft / Sweep Surface (Phase 18 — Professional Modeling)', () => {
  it('should pass all mandatory HAG-204 acceptance checks with verdict PROVEN', async () => {
    const report = await HardAcceptanceGate204.evaluateAll();

    const failures = report.checks.filter(c => c.status === 'FAIL');
    if (failures.length > 0) {
      console.error('Failed checks:', failures);
    }

    expect(report.verdict).toBe('PROVEN');
    expect(report.checks.length).toBeGreaterThanOrEqual(21);
    expect(failures.length).toBe(0);
  });
});
