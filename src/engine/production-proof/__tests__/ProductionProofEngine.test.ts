import { describe, it, expect, beforeEach } from 'vitest';
import { ProductionProofEngine } from '../ProductionProofEngine';

describe('Production Proof Engine Test Suite', () => {
  let engine: ProductionProofEngine;

  beforeEach(() => {
    engine = ProductionProofEngine.getInstance();
  });

  it('should explicitly maintain the rule: ENGINEERING CLOSURE ≠ PRODUCTION PROOF', () => {
    const closure = engine.checkEngineeringClosure();
    expect(closure.isEngineeringClosureAchieved).toBe(true);

    // Initial check of closure alone does NOT grant FIELD PROVEN
    // An engineering closure without running P0-P12 and Gates A-E does not equal FIELD PROVEN
    expect(closure).toHaveProperty('edgeVertexPickingClosed', true);
    expect(closure).toHaveProperty('professionalViewportClosed', true);
    expect(closure).toHaveProperty('workbenchOwnershipClosed', true);
    expect(closure).toHaveProperty('invalidationContractClosed', true);
    expect(closure).toHaveProperty('capabilityIntegrationClosed', true);
  });

  it('should execute P0 through P12 production qualification sequence and calculate SECP-PPS', () => {
    const report = engine.executeProductionQualificationSequence();

    expect(report.pStageResults).toHaveLength(13); // P0 to P12
    expect(report.secpPPS).toBeGreaterThanOrEqual(980);
    expect(report.criticalFailureOccurred).toBe(false);
    expect(report.finalVerdict).toBe('FIELD_PROVEN');
    expect(report.overallFieldProven).toBe(true);
    expect(report.merkleProofHash).not.toBe('');
  });

  it('should enforce the Critical Failure Rule: Override SECP-PPS to 0 and set verdict to CRITICAL_FAILURE_REJECTED', () => {
    const report = engine.executeProductionQualificationSequence('P2');

    expect(report.criticalFailureOccurred).toBe(true);
    expect(report.criticalFailureStageId).toBe('P2');
    expect(report.secpPPS).toBe(0);
    expect(report.finalVerdict).toBe('CRITICAL_FAILURE_REJECTED');
    expect(report.overallFieldProven).toBe(false);
  });

  it('should verify Gates A through E in order and ensure Gate E confers FIELD PROVEN status', () => {
    const report = engine.executeProductionQualificationSequence();

    const gateA = report.gateResults.find(g => g.gateId === 'GATE_A');
    const gateB = report.gateResults.find(g => g.gateId === 'GATE_B');
    const gateC = report.gateResults.find(g => g.gateId === 'GATE_C');
    const gateD = report.gateResults.find(g => g.gateId === 'GATE_D');
    const gateE = report.gateResults.find(g => g.gateId === 'GATE_E');

    expect(gateA?.status).toBe('PASSED');
    expect(gateB?.status).toBe('PASSED');
    expect(gateC?.status).toBe('PASSED');
    expect(gateD?.status).toBe('PASSED');
    expect(gateE?.status).toBe('PASSED');
  });
});
