import { describe, it, expect } from 'vitest';
import { HardAcceptanceGate201 } from '../HardAcceptanceGate201';

describe('PATCH-201: Multi-Body Modeling', () => {
  it('should pass all multi-body acceptance criteria', async () => {
    const report = await HardAcceptanceGate201.evaluateAll();
    
    // Log failures if any for visibility
    const failures = report.checks.filter(c => c.status === 'FAIL');
    if (failures.length > 0) {
      console.error('Failed checks:', failures);
    }
    
    expect(report.verdict).toBe('PROVEN');
    expect(report.checks.length).toBeGreaterThan(0);
  });
});
