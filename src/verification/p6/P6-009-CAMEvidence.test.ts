import { describe, it, expect, beforeEach } from 'vitest';
import { EvidenceIntegrityEngine } from '../../engine/evidence/integrity/EvidenceIntegrityEngine';
import { EngineeringResultRecord } from '../../engine/evidence/integrity/EvidenceIntegrityTypes';

describe('P6-009 — CAM EVIDENCE', () => {
  beforeEach(() => {
    EvidenceIntegrityEngine.clearRegistry();
  });

  const buildResult = (overrides?: any): EngineeringResultRecord => ({
    resultId: 'RES-CAM-001',
    domain: 'CAM' as const,
    executionId: 'EXEC-CAM-001',
    actionId: 'TOOLPATH_GENERATE',
    documentId: 'P6-CAD-CAM-1',
    documentRevision: 1,
    featureId: 'CAM_OP_1',
    outputMetrics: {
      toolpathHash: overrides?.toolpathHash || 'TP-HASH-123',
      gCodeHash: overrides?.gCodeHash || 'GCODE-HASH-123',
      toolNumber: 1,
      toolGeometry: 'ENDMILL-FLAT-10MM',
      controller: 'FANUC_OIM',
      machiningTimeSec: 125,
      ...overrides?.metrics
    },
    rawResultSummary: 'G-Code generated',
    producedByKernel: 'SECP-CAM',
    kernelVersion: '1.2.0',
    isFabricated: false
  });

  it('P6-009-A — CAM evidence bounds to CAD revision, tool configuration, and G-Code', () => {
    const result = buildResult();
    
    const evidence = EvidenceIntegrityEngine.generateEvidence({
      domain: 'CAM',
      documentId: 'P6-CAD-CAM-1',
      documentRevision: 1,
      actionId: 'TOOLPATH_GENERATE',
      executionId: 'EXEC-CAM-001',
      capabilityId: 'CAM_PROCESSOR',
      featureId: 'CAM_OP_1',
      result,
      validation: { validationId: 'V1', passed: true, checks: [] },
      verification: { verificationId: 'VR1', verifierIdentity: 'SYS', independentVerdict: 'PASS' },
      sourceOrigin: 'REAL_KERNEL'
    });

    expect(evidence.state).toBe('VALID');
    expect(evidence.canonicalPayload.metrics.toolpathHash).toBe('TP-HASH-123');
    expect(evidence.canonicalPayload.metrics.gCodeHash).toBe('GCODE-HASH-123');
    expect(evidence.canonicalPayload.metrics.toolNumber).toBe(1);
    expect(evidence.canonicalPayload.metrics.controller).toBe('FANUC_OIM');
  });

  it('P6-009-B — Changing tool parameter produces new evidence ID (stale comparison)', () => {
    const resultA = buildResult();
    const resultB = buildResult({
      toolpathHash: 'TP-HASH-456',
      gCodeHash: 'GCODE-HASH-456',
      metrics: { toolGeometry: 'ENDMILL-BALL-10MM' }
    });

    const evA = EvidenceIntegrityEngine.generateEvidence({
      domain: 'CAM', documentId: 'P6-CAD-CAM-1', documentRevision: 1,
      actionId: 'TOOLPATH_GENERATE', executionId: 'EXEC-CAM-001', capabilityId: 'CAM_PROCESSOR', featureId: 'CAM_OP_1',
      result: resultA,
      validation: { validationId: 'V1', passed: true, checks: [] },
      verification: { verificationId: 'VR1', verifierIdentity: 'SYS', independentVerdict: 'PASS' },
      sourceOrigin: 'REAL_KERNEL'
    });

    const evB = EvidenceIntegrityEngine.generateEvidence({
      domain: 'CAM', documentId: 'P6-CAD-CAM-1', documentRevision: 1, // Same CAD rev
      actionId: 'TOOLPATH_GENERATE', executionId: 'EXEC-CAM-002', capabilityId: 'CAM_PROCESSOR', featureId: 'CAM_OP_1',
      result: resultB,
      validation: { validationId: 'V2', passed: true, checks: [] },
      verification: { verificationId: 'VR2', verifierIdentity: 'SYS', independentVerdict: 'PASS' },
      sourceOrigin: 'REAL_KERNEL'
    });

    expect(evA.evidenceId).not.toBe(evB.evidenceId);
    expect(evA.canonicalPayload.metrics.toolGeometry).toBe('ENDMILL-FLAT-10MM');
    expect(evB.canonicalPayload.metrics.toolGeometry).toBe('ENDMILL-BALL-10MM');
  });
});
