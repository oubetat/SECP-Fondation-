/**
 * SECP Industrial OS v2 — Conservation Battery Test Suite
 * Phase 15 (PATCH-175)
 */

import { describe, it, expect } from 'vitest';
import { ConservationBattery } from '../ConservationBattery';
import { ConservationVerifier } from '../ConservationVerifier';
import { ConservationAdversarialSuite } from '../ConservationAdversarialSuite';
import { ConservationMeshSensitivity } from '../ConservationMeshSensitivity';
import { HardAcceptanceGate175 } from '../HardAcceptanceGate175';
import { Fvm3DMeshGenerator } from '../../../cfd3d/Fvm3DMeshGenerator';
import { Fvm3DNavierStokesSolver } from '../../../cfd3d/Fvm3DNavierStokesSolver';

describe('PATCH-175: Conservation Battery & Hard Acceptance Gate', () => {
  it('should run full Conservation Battery and achieve passing verdict on canonical cases', () => {
    const report = ConservationBattery.runBattery();
    expect(report.overallVerdict).toBe('PASS');
    expect(report.totalCases).toBeGreaterThanOrEqual(6);
    expect(report.massTestsSummary.passed).toBeGreaterThanOrEqual(6);
    expect(report.massTestsSummary.worstErrorPercent).toBeLessThanOrEqual(0.5);
    expect(report.momentumTestsSummary.passed).toBeGreaterThanOrEqual(6);
    expect(report.momentumTestsSummary.worstErrorPercent).toBeLessThanOrEqual(5.0);
    expect(report.energyTestsSummary.unproven).toBe(report.totalCases);
  });

  it('should independently compute mass conservation accurately on 3D channel flow', () => {
    const mesh = Fvm3DMeshGenerator.generate3DBlockMesh('test_mass', 0.5, 0.05, 0.05, 4, 2, 2);
    const fluid = { densityKgM3: 1.225, viscosityPaS: 0.001 };
    const config = {
      maxIterations: 20,
      continuityTol: 1e-3,
      momentumTol: 1e-3,
      underRelaxationVelocity: 0.7,
      underRelaxationPressure: 0.3,
      useTurbulenceModel: false,
      turbulenceScheme: 'LAMINAR' as const,
      upwindScheme: 'FIRST_ORDER_UPWIND' as const
    };
    const sol = Fvm3DNavierStokesSolver.solve(mesh, fluid, config);
    const massMetrics = ConservationVerifier.computeMassConservation(mesh, sol, fluid, 0.5);

    expect(massMetrics.isConserved).toBe(true);
    expect(massMetrics.relativeErrorPercent).toBeLessThanOrEqual(0.5);
    expect(massMetrics.inflowKgS).toBeGreaterThan(0);
    expect(massMetrics.outflowKgS).toBeGreaterThan(0);
  });

  it('should catch 100% of injected adversarial pathologies', () => {
    const advReport = ConservationAdversarialSuite.runAdversarialBattery();
    expect(advReport.falseAcceptanceCount).toBe(0);
    expect(advReport.detectionRatePercent).toBe(100.0);
  });

  it('should conduct grid sensitivity across 3 refinement levels', () => {
    const meshStudy = ConservationMeshSensitivity.runSensitivityStudy();
    expect(meshStudy.points.length).toBe(3);
    expect(meshStudy.points[0].cellCount).toBeLessThan(meshStudy.points[1].cellCount);
    expect(meshStudy.points[1].cellCount).toBeLessThan(meshStudy.points[2].cellCount);
    meshStudy.points.forEach(pt => {
      expect(pt.massErrorPercent).toBeLessThanOrEqual(0.5);
    });
  });

  it('should pass Hard Acceptance Gate 175 with 100% score', () => {
    const gateReport = HardAcceptanceGate175.evaluate();
    expect(gateReport.overallPassed).toBe(true);
    expect(gateReport.totalScore).toBe(gateReport.maxTotalScore);
    expect(gateReport.criteria.every(c => c.passed)).toBe(true);
  });
});
