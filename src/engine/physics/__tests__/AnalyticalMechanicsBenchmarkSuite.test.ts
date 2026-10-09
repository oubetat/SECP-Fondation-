import { describe, it, expect } from 'vitest';
import { AnalyticalMechanicsBenchmarkSuite } from '../AnalyticalMechanicsBenchmarkSuite';

describe('AnalyticalMechanicsBenchmarkSuite — Classical Continuum Mechanics Benchmarks', () => {
  it('should verify Lamé Thick Cylinder closed-form hoop stress equation', () => {
    // Exact analytical value = 16.66667 MPa. Test with 16.68 MPa (0.08% error).
    const res = AnalyticalMechanicsBenchmarkSuite.evaluateLameCylinder(16.680);

    expect(res.passed).toBe(true);
    expect(res.relativeErrorPercent).toBeLessThan(0.5);
    expect(res.analyticalValue).toBeCloseTo(16.6667, 3);
  });

  it('should verify Kirsch Plate circular hole stress concentration factor Kt = 3.00', () => {
    const res = AnalyticalMechanicsBenchmarkSuite.evaluateKirschPlate(3.002);

    expect(res.passed).toBe(true);
    expect(res.relativeErrorPercent).toBeLessThan(0.5);
  });

  it('should verify Timoshenko beam tip deflection (bending + shear)', () => {
    // Analytical deflection = 20.0156 mm
    const res = AnalyticalMechanicsBenchmarkSuite.evaluateTimoshenkoBeam(20.020);

    expect(res.passed).toBe(true);
    expect(res.relativeErrorPercent).toBeLessThan(0.5);
  });

  it('should verify Hagen-Poiseuille viscous channel flow peak centerline velocity', () => {
    // Analytical u_max = 5.00 m/s
    const res = AnalyticalMechanicsBenchmarkSuite.evaluatePoiseuilleFlow(5.008);

    expect(res.passed).toBe(true);
    expect(res.relativeErrorPercent).toBeLessThan(0.5);
  });

  it('should verify NAFEMS LE10 elliptical membrane stress benchmark', () => {
    // Analytical sigma_y = 5.38 MPa
    const res = AnalyticalMechanicsBenchmarkSuite.evaluateNafemsLE10(5.390);

    expect(res.passed).toBe(true);
    expect(res.relativeErrorPercent).toBeLessThan(1.0);
  });

  it('should execute full benchmark suite and return overall PASSED report', () => {
    const fullReport = AnalyticalMechanicsBenchmarkSuite.executeFullSuite({
      lameInnerHoopStress: 16.680,
      kirschKt: 3.001,
      timoshenkoBeamDeflection: 20.020,
      poiseuilleMaxVelocity: 5.005,
      nafemsLE10Stress: 5.390
    });

    expect(fullReport.overallPassed).toBe(true);
    expect(fullReport.summary.passed).toBe(5);
    expect(fullReport.summary.failed).toBe(0);
  });
});
