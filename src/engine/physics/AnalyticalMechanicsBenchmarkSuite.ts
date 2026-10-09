/**
 * SECP Physics Engine — Classical Continuum Mechanics Analytical Benchmark Suite
 *
 * Implements 5 classical closed-form continuum mechanics solutions to verify FEA/CFD accuracy:
 * 1. Lamé Thick-Walled Cylinder under Internal Pressure (Solid Elasticity)
 * 2. Kirsch Infinite Plate with Circular Hole in Tension (Stress Concentration)
 * 3. Timoshenko Cantilever Beam under Tip Load (Bending + Shear Deflection)
 * 4. Hagen-Poiseuille Channel Flow (Viscous Fluid Mechanics)
 * 5. NAFEMS LE10 Elliptical Membrane Benchmark (NAFEMS FEA Standard)
 */

export interface BenchmarkCaseResult {
  benchmarkId: string;
  name: string;
  domain: 'SOLID_MECHANICS' | 'FLUID_DYNAMICS' | 'NAFEMS';
  analyticalValue: number;
  numericalValue: number;
  relativeErrorPercent: number;
  passed: boolean;
  tolerancePercent: number;
  details: string;
}

export interface AnalyticalBenchmarkReport {
  suiteTitle: string;
  timestamp: string;
  overallPassed: boolean;
  cases: BenchmarkCaseResult[];
  summary: { total: number; passed: number; failed: number };
}

export class AnalyticalMechanicsBenchmarkSuite {

  /**
   * Evaluates Lamé Thick-Walled Cylinder closed-form solution:
   * Inner radius a = 100mm, Outer radius b = 200mm, Internal Pressure Pi = 10 MPa.
   * Analytical hoop stress at inner wall r = a:
   *  sigma_theta(a) = Pi * (a^2 + b^2) / (b^2 - a^2) = 10 * (100^2 + 200^2) / (200^2 - 100^2) = 16.6667 MPa.
   */
  public static evaluateLameCylinder(numericalHoopStressAtInnerWall: number): BenchmarkCaseResult {
    const a = 100; // mm
    const b = 200; // mm
    const Pi = 10; // MPa

    const analyticalHoopStress = Pi * (a * a + b * b) / (b * b - a * a); // 16.666666666666668 MPa
    const relErr = Math.abs(numericalHoopStressAtInnerWall - analyticalHoopStress) / analyticalHoopStress * 100;
    const passed = relErr <= 0.5;

    return {
      benchmarkId: 'BMK-001',
      name: 'Lamé Thick-Walled Cylinder Hoop Stress at Inner Wall',
      domain: 'SOLID_MECHANICS',
      analyticalValue: analyticalHoopStress,
      numericalValue: numericalHoopStressAtInnerWall,
      relativeErrorPercent: relErr,
      passed,
      tolerancePercent: 0.5,
      details: `Analytical sigma_theta(a) = ${analyticalHoopStress.toFixed(4)} MPa, Numerical = ${numericalHoopStressAtInnerWall.toFixed(4)} MPa (Error: ${relErr.toFixed(3)}%)`
    };
  }

  /**
   * Evaluates Kirsch Plate with Circular Hole in Tension:
   * Theoretical stress concentration factor Kt = sigma_max / sigma_nominal = 3.00.
   */
  public static evaluateKirschPlate(numericalKt: number): BenchmarkCaseResult {
    const analyticalKt = 3.000;
    const relErr = Math.abs(numericalKt - analyticalKt) / analyticalKt * 100;
    const passed = relErr <= 0.5;

    return {
      benchmarkId: 'BMK-002',
      name: 'Kirsch Plate Circular Hole Stress Concentration Factor (Kt)',
      domain: 'SOLID_MECHANICS',
      analyticalValue: analyticalKt,
      numericalValue: numericalKt,
      relativeErrorPercent: relErr,
      passed,
      tolerancePercent: 0.5,
      details: `Analytical Kt = ${analyticalKt.toFixed(3)}, Numerical Kt = ${numericalKt.toFixed(3)} (Error: ${relErr.toFixed(3)}%)`
    };
  }

  /**
   * Evaluates Timoshenko Cantilever Beam Tip Deflection:
   * Length L = 1000mm, Force P = 1000N, E = 200 GPa, I = 8.333e4 mm4, G = 76.92 GPa, A = 1000 mm2, kappa = 5/6.
   * Analytical w_tip = P*L^3 / (3*E*I) + P*L / (kappa * A * G).
   */
  public static evaluateTimoshenkoBeam(numericalTipDeflection: number): BenchmarkCaseResult {
    const L = 1000; // mm
    const P = 1000; // N
    const E = 200000; // MPa
    const I = 83333.3333; // mm4
    const G = 76923.0769; // MPa
    const A = 1000; // mm2
    const kappa = 5.0 / 6.0;

    const wBending = (P * Math.pow(L, 3)) / (3 * E * I); // 20.00 mm
    const wShear = (P * L) / (kappa * A * G); // 0.0156 mm
    const analyticalDeflection = wBending + wShear; // 20.0156 mm

    const relErr = Math.abs(numericalTipDeflection - analyticalDeflection) / analyticalDeflection * 100;
    const passed = relErr <= 0.5;

    return {
      benchmarkId: 'BMK-003',
      name: 'Timoshenko Cantilever Beam Tip Deflection (Bending + Shear)',
      domain: 'SOLID_MECHANICS',
      analyticalValue: analyticalDeflection,
      numericalValue: numericalTipDeflection,
      relativeErrorPercent: relErr,
      passed,
      tolerancePercent: 0.5,
      details: `Analytical w_tip = ${analyticalDeflection.toFixed(4)} mm, Numerical = ${numericalTipDeflection.toFixed(4)} mm (Error: ${relErr.toFixed(3)}%)`
    };
  }

  /**
   * Evaluates Hagen-Poiseuille Viscous Channel Centerline Velocity:
   * Channel half-width H = 10mm, Pressure Gradient dP/dx = -100 Pa/m, Viscosity mu = 0.001 Pa.s.
   * Analytical u_max = (H^2 / 2*mu) * (-dP/dx).
   */
  public static evaluatePoiseuilleFlow(numericalMaxVelocity: number): BenchmarkCaseResult {
    const H = 0.01; // m
    const dPdx = 100; // Pa/m
    const mu = 0.001; // Pa.s

    const analyticalMaxU = (H * H * dPdx) / (2 * mu); // 5.00 m/s
    const relErr = Math.abs(numericalMaxVelocity - analyticalMaxU) / analyticalMaxU * 100;
    const passed = relErr <= 0.5;

    return {
      benchmarkId: 'BMK-004',
      name: 'Hagen-Poiseuille Viscous Channel Centerline Peak Velocity',
      domain: 'FLUID_DYNAMICS',
      analyticalValue: analyticalMaxU,
      numericalValue: numericalMaxVelocity,
      relativeErrorPercent: relErr,
      passed,
      tolerancePercent: 0.5,
      details: `Analytical u_max = ${analyticalMaxU.toFixed(4)} m/s, Numerical = ${numericalMaxVelocity.toFixed(4)} m/s (Error: ${relErr.toFixed(3)}%)`
    };
  }

  /**
   * Evaluates NAFEMS LE10 Elliptical Membrane Stress Benchmark:
   * Target tangential stress at Point D: sigma_y = 5.38 MPa.
   */
  public static evaluateNafemsLE10(numericalStressAtD: number): BenchmarkCaseResult {
    const analyticalStressAtD = 5.380; // MPa
    const relErr = Math.abs(numericalStressAtD - analyticalStressAtD) / analyticalStressAtD * 100;
    const passed = relErr <= 1.0; // NAFEMS standard tolerance 1%

    return {
      benchmarkId: 'BMK-005',
      name: 'NAFEMS LE10 Elliptical Membrane Tangential Stress at Point D',
      domain: 'NAFEMS',
      analyticalValue: analyticalStressAtD,
      numericalValue: numericalStressAtD,
      relativeErrorPercent: relErr,
      passed,
      tolerancePercent: 1.0,
      details: `NAFEMS Reference sigma_y = ${analyticalStressAtD.toFixed(3)} MPa, Numerical = ${numericalStressAtD.toFixed(3)} MPa (Error: ${relErr.toFixed(3)}%)`
    };
  }

  /**
   * Runs the full suite against given numerical outputs.
   */
  public static executeFullSuite(inputs: {
    lameInnerHoopStress: number;
    kirschKt: number;
    timoshenkoBeamDeflection: number;
    poiseuilleMaxVelocity: number;
    nafemsLE10Stress: number;
  }): AnalyticalBenchmarkReport {
    const cases = [
      this.evaluateLameCylinder(inputs.lameInnerHoopStress),
      this.evaluateKirschPlate(inputs.kirschKt),
      this.evaluateTimoshenkoBeam(inputs.timoshenkoBeamDeflection),
      this.evaluatePoiseuilleFlow(inputs.poiseuilleMaxVelocity),
      this.evaluateNafemsLE10(inputs.nafemsLE10Stress)
    ];

    const passedCount = cases.filter(c => c.passed).length;
    const overallPassed = passedCount === cases.length;

    return {
      suiteTitle: 'SECP Classical Continuum Mechanics Analytical Benchmark Suite',
      timestamp: new Date().toISOString(),
      overallPassed,
      cases,
      summary: { total: cases.length, passed: passedCount, failed: cases.length - passedCount }
    };
  }
}
