/**
 * SECP Industrial OS — Engineering Truth Platform
 * PATCH-241: Hard Acceptance Gate 241 Test Suite
 */

import { describe, it, expect } from 'vitest';
import { HardAcceptanceGate241 } from '../HardAcceptanceGate241';

describe('PATCH-241: HardAcceptanceGate241 Suite', () => {
  it('runs complete HardAcceptanceGate241 suite with 5/5 PASS verdict', () => {
    const report = HardAcceptanceGate241.runSuite();
    expect(report.gateId).toBe('HardAcceptanceGate241');
    expect(report.overallVerdict).toBe('PASS');
    expect(report.testsPassed).toBe(5);
    expect(report.testsTotal).toBe(5);

    // Verify individual test assertions
    report.testReports.forEach(t => {
      expect(t.success).toBe(true);
      expect(t.assertionsPassed).toBe(t.assertionsTotal);
    });
  });

  it('verifies Gauss divergence area vector closure in Test 01', () => {
    const report = HardAcceptanceGate241.runSuite();
    const test1 = report.testReports[0];
    expect(test1.name).toContain('Tetrahedral');
    expect(test1.details.volume).toBeCloseTo(1 / 6, 6);
    expect(test1.details.areaClosureResidual).toBeLessThan(1e-5);
    expect(test1.details.faceCount).toBe(4);
  });

  it('verifies reciprocal multi-cell adjacency in Test 02', () => {
    const report = HardAcceptanceGate241.runSuite();
    const test2 = report.testReports[1];
    expect(test2.name).toContain('Adjacency');
    expect(test2.details.isBoundary).toBe(false);
    expect(['c1', 'c2']).toContain(test2.details.owner);
    expect(['c1', 'c2']).toContain(test2.details.neighbour);
  });

  it('verifies bidirectional patch binding in Test 03', () => {
    const report = HardAcceptanceGate241.runSuite();
    const test3 = report.testReports[2];
    expect(test3.details.patchId).toBe('PATCH_INLET');
    expect(test3.details.isBoundary).toBe(true);
    expect(test3.details.patchType).toBe('INLET');
  });

  it('verifies dual negative and zero volume detection in Test 04', () => {
    const report = HardAcceptanceGate241.runSuite();
    const test4 = report.testReports[3];
    expect(test4.details.invertedVolume).toBeLessThan(-1e-6);
    expect(Math.abs(test4.details.degenerateVolume)).toBeLessThan(1e-12);
  });

  it('verifies 3-case hash determinism and sensitivity in Test 05', () => {
    const report = HardAcceptanceGate241.runSuite();
    const test5 = report.testReports[4];
    expect(test5.details.isPermutationInvariant).toBe(true);
    expect(test5.details.isPerturbationSensitive).toBe(true);
    expect(test5.details.isTopologyDistinct).toBe(true);
    expect(test5.details.h1_base).toBe(test5.details.h2_permuted);
    expect(test5.details.h1_base).not.toBe(test5.details.h3_perturbed);
    expect(test5.details.h1_base).not.toBe(test5.details.h4_distinct);
  });
});
