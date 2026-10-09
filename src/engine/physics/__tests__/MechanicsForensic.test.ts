import { describe, it, expect } from 'vitest';
import { AnalyticalMechanicsBenchmarkSuite } from '../AnalyticalMechanicsBenchmarkSuite';

describe('MechanicsForensic — Analytical Mechanics V&V Audit', () => {
  it('FORENSIC: Should verify Lamé Cylinder stress using an independent calculation path', () => {
    // Independent path: manual implementation of the formula in the test
    const a = 100;
    const b = 200;
    const Pi = 10;
    const independentValue = (Pi * (a * a + b * b)) / (b * b - a * a);

    const suiteResult = AnalyticalMechanicsBenchmarkSuite.evaluateLameCylinder(16.6667);
    
    expect(suiteResult.analyticalValue).toBeCloseTo(independentValue, 5);
    expect(suiteResult.passed).toBe(true);
  });

  it('ADVERSARIAL: Should fail benchmark when error exceeds tolerance', () => {
    // Tolerance is 0.5%. 18.0 is ~8% error.
    const res = AnalyticalMechanicsBenchmarkSuite.evaluateLameCylinder(18.0);
    expect(res.passed).toBe(false);
    expect(res.relativeErrorPercent).toBeGreaterThan(0.5);
  });
});
