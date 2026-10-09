/**
 * SECP Industrial OS v2 — GCS Benchmark Battery Vitest Suite
 * Phase 15 (PATCH-173)
 */

import { describe, it, expect } from 'vitest';
import { GCSBenchmarkBattery } from '../GCSBenchmarkBattery';
import { HardAcceptanceGate173 } from '../HardAcceptanceGate173';
import { GCSBenchmarkCaseRegistry } from '../GCSBenchmarkCaseRegistry';
import { GCSIndependentGeometricOracle } from '../GCSIndependentGeometricOracle';
import { GCSIndependentGraphAuditor } from '../GCSIndependentGraphAuditor';
import { GCSDeterminismAuditor } from '../GCSDeterminismAuditor';
import { GCSMutationEngine } from '../GCSMutationEngine';
import { ConstraintResiduals } from '../../../sketch/gcs/ConstraintResidual';

describe('PATCH-173: Geometric Constraint Solver (GCS) Benchmark Battery', () => {
  it('01: Case Registry contains all 9 required categories', () => {
    const cases = GCSBenchmarkCaseRegistry.getAllCases();
    expect(cases.length).toBeGreaterThanOrEqual(15);

    const categories = new Set(cases.map(c => c.category));
    expect(categories.has('A_BASIC_SOLVER')).toBe(true);
    expect(categories.has('B_DOF_QUALIFICATION')).toBe(true);
    expect(categories.has('C_OVER_CONSTRAINED')).toBe(true);
    expect(categories.has('D_CONTRADICTORY_CONSTRAINTS')).toBe(true);
    expect(categories.has('E_REDUNDANT_CONSTRAINTS')).toBe(true);
    expect(categories.has('F_NUMERICAL_STABILITY')).toBe(true);
    expect(categories.has('G_CONSTRAINT_GRAPH_PROPAGATION')).toBe(true);
    expect(categories.has('H_PARAMETRIC_REGENERATION')).toBe(true);
    expect(categories.has('I_ADVERSARIAL_CHAINS')).toBe(true);
  });

  it('02: Independent Geometric Oracle accurately detects invalid geometry', () => {
    const rectangleCase = GCSBenchmarkCaseRegistry.getAllCases().find(c => c.id === 'GCS-A03-RECTANGLE')!;
    const { sketch } = rectangleCase.generator();

    // Corrupt one coordinate
    const tampered = JSON.parse(JSON.stringify(sketch));
    tampered.entities['p2'].y = 99.0;

    const result = GCSIndependentGeometricOracle.verifySketch(tampered, 1e-4);
    expect(result.satisfied).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
  });

  it('03: Graph Auditor computes node counts and connected components', () => {
    const rectCase = GCSBenchmarkCaseRegistry.getAllCases().find(c => c.id === 'GCS-A03-RECTANGLE')!;
    const { sketch } = rectCase.generator();

    const graphResult = GCSIndependentGraphAuditor.auditGraph(sketch);
    expect(graphResult.nodeCount).toBeGreaterThan(0);
    expect(graphResult.isGraphValid).toBe(true);
    expect(graphResult.connectedComponents).toBeGreaterThanOrEqual(1);
  });

  it('04: Determinism Auditor confirms 0% numerical drift across runs', () => {
    const lineCase = GCSBenchmarkCaseRegistry.getAllCases().find(c => c.id === 'GCS-A01-HORIZ-LINE')!;
    const { sketch } = lineCase.generator();

    const detResult = GCSDeterminismAuditor.auditDeterminism(sketch, 3);
    expect(detResult.isDeterministic).toBe(true);
    expect(detResult.driftCount).toBe(0);
  });

  it('05: Mutation Engine detects 100% of injected corruptions', async () => {
    const mutationReport = await GCSMutationEngine.runMutationBattery();
    expect(mutationReport.mutationsInjected).toBe(6);
    expect(mutationReport.mutationsDetected).toBe(6);
    expect(mutationReport.falseAcceptanceCount).toBe(0);
    expect(mutationReport.detectionRatePercent).toBe(100);
  });

  it('06: Full GCS Benchmark Battery executes and passes Hard Acceptance Gate 173', async () => {
    const report = await GCSBenchmarkBattery.runFullBattery();
    expect(report.overallVerdict).toBe('PASS');
    expect(report.passedCount).toBe(report.totalCases);
    expect(report.failedCount).toBe(0);

    const gateReport = HardAcceptanceGate173.evaluateGate(report);
    expect(gateReport.overallPassed).toBe(true);
    expect(gateReport.checks.length).toBe(8);
    expect(gateReport.checks.every(c => c.passed)).toBe(true);
  });

  it('07: Degenerate geometry adversarial test (Section E): zero-length lines rejected', () => {
    // Degenerate zero-length line from (10, 10) to (10, 10)
    const degenSketch = {
      entities: {
        'p1': { id: 'p1', type: 'POINT', x: 10, y: 10 },
        'p2': { id: 'p2', type: 'POINT', x: 10, y: 10 },
        'l1': { id: 'l1', type: 'LINE', startPointId: 'p1', endPointId: 'p2' }
      },
      constraints: {
        'c-h': { id: 'c-h', type: 'HORIZONTAL', entityIds: ['l1'] },
        'c-v': { id: 'c-v', type: 'VERTICAL', entityIds: ['l1'] }
      }
    };

    const oracleResult = GCSIndependentGeometricOracle.verifySketch(degenSketch);
    expect(oracleResult.satisfied).toBe(false);
    expect(oracleResult.violations.some(v => v.includes('Degeneracy Violation'))).toBe(true);

    // Verify residual formulation produces non-zero penalty for zero-length lines
    const resH = ConstraintResiduals.horizontal({ x: 5, y: 5 }, { x: 5, y: 5 });
    const resV = ConstraintResiduals.vertical({ x: 5, y: 5 }, { x: 5, y: 5 });
    const resPar = ConstraintResiduals.parallel({ x: 0, y: 0 }, { x: 1, y: 0 });
    const resPerp = ConstraintResiduals.perpendicular({ x: 0, y: 0 }, { x: 0, y: 1 });

    expect(resH).toBeGreaterThan(0);
    expect(resV).toBeGreaterThan(0);
    expect(resPar).toBeGreaterThan(0);
    expect(resPerp).toBeGreaterThan(0);
  });

  it('08: Gate Anti-Fabrication & Anti-Tamper mutation test (Section I)', async () => {
    const genuineReport = await GCSBenchmarkBattery.runFullBattery();
    const genuineGate = HardAcceptanceGate173.evaluateGate(genuineReport);
    expect(genuineGate.overallPassed).toBe(true);

    // Mutation 1: Corrupt geometric validation on solved case
    const mutatedReport1 = JSON.parse(JSON.stringify(genuineReport));
    mutatedReport1.evidenceLedger[0].geometricValidation.satisfied = false;
    const gate1 = HardAcceptanceGate173.evaluateGate(mutatedReport1);
    expect(gate1.overallPassed).toBe(false);
    expect(gate1.verdict).toBe('FAIL');

    // Mutation 2: Invalidate determinism
    const mutatedReport2 = JSON.parse(JSON.stringify(genuineReport));
    mutatedReport2.nonDeterministicCount = 1;
    const gate2 = HardAcceptanceGate173.evaluateGate(mutatedReport2);
    expect(gate2.overallPassed).toBe(false);
    expect(gate2.verdict).toBe('FAIL');

    // Mutation 3: Invalidate mutation false acceptance
    const mutatedReport3 = JSON.parse(JSON.stringify(genuineReport));
    mutatedReport3.mutationReport.falseAcceptanceCount = 1;
    const gate3 = HardAcceptanceGate173.evaluateGate(mutatedReport3);
    expect(gate3.overallPassed).toBe(false);
    expect(gate3.verdict).toBe('FAIL');
  });

  it('09: Gate fails closed on missing, undefined, or malformed input (Section J)', () => {
    const gateNull = HardAcceptanceGate173.evaluateGate(null as any);
    expect(gateNull.overallPassed).toBe(false);
    expect(gateNull.verdict).toBe('FAIL');

    const gateUndefined = HardAcceptanceGate173.evaluateGate(undefined as any);
    expect(gateUndefined.overallPassed).toBe(false);
    expect(gateUndefined.verdict).toBe('FAIL');

    const gateMalformed = HardAcceptanceGate173.evaluateGate({} as any);
    expect(gateMalformed.overallPassed).toBe(false);
    expect(gateMalformed.verdict).toBe('FAIL');
  });
});
