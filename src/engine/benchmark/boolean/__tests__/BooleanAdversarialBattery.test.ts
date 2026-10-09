/**
 * SECP Industrial OS v2 — Unit Tests for Boolean Adversarial Battery (PATCH-172)
 */

import { describe, it, expect } from 'vitest';
import { BooleanAdversarialBattery } from '../BooleanAdversarialBattery';
import { HardAcceptanceGate172 } from '../HardAcceptanceGate172';
import { AdversarialSolidFactory } from '../AdversarialSolidFactory';
import { IndependentTopologyVerifier } from '../IndependentTopologyVerifier';
import { IndependentGeometricOracle } from '../IndependentGeometricOracle';
import { AdversarialMutationEngine } from '../AdversarialMutationEngine';

describe('PATCH-172 — Boolean Adversarial Qualification Battery', () => {
  it('should generate valid solid primitives from AdversarialSolidFactory', () => {
    const box = AdversarialSolidFactory.createBox('box_test', 0, 0, 0, 10, 10, 10);
    expect(box).toBeDefined();
    expect(box.shapeType).toBe('SOLID');
    expect(box.outerShell.orientedFaces.length).toBe(6);

    const cyl = AdversarialSolidFactory.createFacetedCylinder('cyl_test', 5, 5, 0, 3, 10, 16);
    expect(cyl).toBeDefined();
    expect(cyl.outerShell.orientedFaces.length).toBe(18); // 16 sides + top + bottom

    const sph = AdversarialSolidFactory.createFacetedSphere('sph_test', 0, 0, 0, 5, 8, 12);
    expect(sph).toBeDefined();
    expect(sph.outerShell.orientedFaces.length).toBe(96); // 8 x 12 quads
  });

  it('should verify volume and manifold topology with Independent Geometric & Topology Oracles', () => {
    const box = AdversarialSolidFactory.createBox('box_test2', 0, 0, 0, 10, 10, 10);
    const vol = IndependentGeometricOracle.computeVolume(box);
    expect(vol).toBeCloseTo(1000, 2);

    const area = IndependentGeometricOracle.computeSurfaceArea(box);
    expect(area).toBeCloseTo(600, 2);

    const topoRes = IndependentTopologyVerifier.verify(box);
    expect(topoRes.isClosedShell).toBe(true);
    expect(topoRes.isManifold).toBe(true);
    expect(topoRes.eulerCharacteristic).toBe(2);
    expect(topoRes.orphanEdgeCount).toBe(0);
    expect(topoRes.nonManifoldEdgeCount).toBe(0);
  });

  it('should detect 100% of injected adversarial mutations', () => {
    const mutRes = AdversarialMutationEngine.runMutationSuite();
    expect(mutRes.mutationsInjected).toBe(6);
    expect(mutRes.mutationsDetected).toBe(6);
    expect(mutRes.falseAcceptanceCount).toBe(0);
    expect(mutRes.detectionRatePercent).toBe(100);
  });

  it('should execute full Boolean Adversarial Battery across all 8 categories with bit-exact determinism', () => {
    const batteryReport = BooleanAdversarialBattery.runAll();
    expect(batteryReport.totalCases).toBeGreaterThanOrEqual(20);
    expect(batteryReport.failedCount).toBe(0);
    expect(batteryReport.determinismScore).toBe(1.0);
    expect(batteryReport.topologyIntegrityScore).toBe(1.0);
    expect(batteryReport.geometricInvariantScore).toBe(1.0);
    expect(batteryReport.overallVerdict).toBe('PASS');
  }, 60000);

  it('should pass Hard Acceptance Gate 172 with complete certification', () => {
    const gateReport = HardAcceptanceGate172.evaluate();
    expect(gateReport.allPassed).toBe(true);
    expect(gateReport.finalVerdict).toBe('PASS');
    expect(gateReport.checks.length).toBeGreaterThanOrEqual(8);
    for (const check of gateReport.checks) {
      expect(check.passed).toBe(true);
      expect(check.status).toBe('PASS');
    }
  }, 60000);
});
