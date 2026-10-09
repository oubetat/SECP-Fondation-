import { describe, it, expect } from 'vitest';
import { HardAcceptanceGate018 } from '../predicates/HardAcceptanceGate018';

describe('PATCH-018: Hard Acceptance Gate 018', () => {
  it('should evaluate all 25 qualification checks and pass completely', () => {
    const report = HardAcceptanceGate018.evaluateAll();

    expect(report.gate).toBe('HARD_ACCEPTANCE_GATE_018');
    expect(report.passed).toBe(true);
    expect(report.totalChecks).toBe(25);
    expect(report.passedChecks).toBe(25);
    expect(report.failedChecks).toBe(0);
    expect(typeof report.canonicalHash).toBe('string');
    expect(report.canonicalHash.length).toBe(64);

    // Verify individual checks
    for (const check of report.checks) {
      expect(check.passed).toBe(true);
    }
  });
});
