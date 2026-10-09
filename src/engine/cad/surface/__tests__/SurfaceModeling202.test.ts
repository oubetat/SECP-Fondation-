import { describe, it, expect } from 'vitest';
import { HardAcceptanceGate202 } from '../HardAcceptanceGate202';

describe('PATCH-202: Surface Modeling', () => {
  it('should pass all surface modeling acceptance criteria', async () => {
    const report = await HardAcceptanceGate202.evaluateAll();
    
    // Log failures if any for visibility
    const failures = report.checks.filter((c: any) => c.status === 'FAIL');
    if (failures.length > 0) {
      console.error('Failed checks:', failures);
    }
    
    expect(report.verdict).toBe('PROVEN');
    expect(report.checks.length).toBeGreaterThan(0);
  });
});
