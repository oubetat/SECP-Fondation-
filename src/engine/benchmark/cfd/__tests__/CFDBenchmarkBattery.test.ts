/**
 * SECP Industrial OS v2 — CFD Benchmark Battery & Gate 174 Automated Tests
 * Phase 15 (PATCH-174)
 */

import { describe, it, expect } from 'vitest';
import { CFDBenchmarkBattery } from '../CFDBenchmarkBattery';
import { HardAcceptanceGate174 } from '../HardAcceptanceGate174';
import { CFDIndependentOracles } from '../CFDIndependentOracles';
import { CFDAdversarialEngine } from '../CFDAdversarialEngine';
import { CFDDeterminismAuditor } from '../CFDDeterminismAuditor';
import { Fvm3DMeshGenerator } from '../../../cfd3d/Fvm3DMeshGenerator';
import { FluidProperties3D, SolverConfig3D } from '../../../cfd3d/Fvm3DTypes';

describe('PATCH-174: CFD Benchmark Battery & Physics Qualification', () => {
  it('should compute exact analytical Poiseuille channel flow properties', () => {
    const analytical = CFDIndependentOracles.getPoiseuilleAnalytical(1.0, 0.1, 0.1, 0.5, 0.001, 1000);
    expect(analytical.reynoldsNumber).toBe(50000);
    // Delta P = 12 * mu * L * U / h^2 = 12 * 0.001 * 1.0 * 0.5 / (0.01) = 0.6 Pa
    expect(analytical.exactPressureDropPa).toBeCloseTo(0.6, 4);
    expect(analytical.velocityAtHeight(0.05)).toBeCloseTo(0.75, 4); // Max velocity = 1.5 * Uavg = 0.75
  });

  it('should compute exact analytical Couette shear flow properties', () => {
    const couette = CFDIndependentOracles.getCouetteAnalytical(0.05, 2.0, 0.001, 1.225);
    expect(couette.exactPressureGradientPaM).toBe(0.0);
    expect(couette.exactWallShearStressPa).toBeCloseTo(0.04, 4); // tau = mu * U / h = 0.001 * 2 / 0.05 = 0.04
    expect(couette.velocityAtHeight(0.025)).toBeCloseTo(1.0, 4); // Half height = half wall velocity
  });

  it('should detect 100% of injected adversarial pathologies', () => {
    const advReport = CFDAdversarialEngine.runAdversarialBattery();
    expect(advReport.testsInjected).toBeGreaterThan(5);
    expect(advReport.detectionRatePercent).toBe(100);
    expect(advReport.falseAcceptanceCount).toBe(0);
  });

  it('should verify bit-exact determinism across repeat runs', () => {
    const fluid: FluidProperties3D = { densityKgM3: 1.225, viscosityPaS: 0.001 };
    const config: SolverConfig3D = {
      maxIterations: 10,
      continuityTol: 1e-3,
      momentumTol: 1e-3,
      underRelaxationVelocity: 0.7,
      underRelaxationPressure: 0.3,
      useTurbulenceModel: false,
      turbulenceScheme: 'LAMINAR',
      upwindScheme: 'FIRST_ORDER_UPWIND'
    };

    const det = CFDDeterminismAuditor.verifyDeterminism(
      () => Fvm3DMeshGenerator.generate3DBlockMesh('det_test', 0.2, 0.02, 0.02, 4, 2, 2),
      fluid,
      config,
      2
    );

    expect(det.isDeterministic).toBe(true);
    expect(det.driftCount).toBe(0);
  });

  it('should execute the complete CFD Benchmark Battery and achieve passing verdict', () => {
    const report = CFDBenchmarkBattery.runCompleteBattery();
    expect(report.totalCases).toBeGreaterThanOrEqual(10);
    expect(report.failedCount).toBe(0);
    expect(report.unprovenCount).toBeGreaterThanOrEqual(1); // Honest UNPROVEN for energy
    expect(report.overallVerdict).toBe('PASS');
  }, 180000);

  it('should pass all 8 checks of Hard Acceptance Gate 174', () => {
    const gate = HardAcceptanceGate174.evaluateGate();
    expect(gate.passed).toBe(true);
    expect(gate.verdict).toBe('PASS');
    expect(gate.checks.length).toBe(8);
    for (const check of gate.checks) {
      expect(check.passed).toBe(true);
    }
  }, 180000);
});
