import { describe, it, expect } from 'vitest';
import { EvidenceIntegrityEngine } from '../../engine/evidence/integrity/EvidenceIntegrityEngine';
import { CanonicalEvidenceRecord } from '../../engine/evidence/integrity/EvidenceIntegrityTypes';

describe('P6-025 — CANONICAL REPLAY', () => {
  it('P6-025-A — Re-run of identical execution produces identical deterministic evidence without duplication', () => {
    EvidenceIntegrityEngine.clearRegistry();

    const generate = (): CanonicalEvidenceRecord => {
      return EvidenceIntegrityEngine.generateEvidence({
        domain: 'CAD', documentId: 'P6-DOC', documentRevision: 1, actionId: 'EVAL', executionId: 'EXEC-1', capabilityId: 'CAP', featureId: 'FEA1',
        result: { resultId: 'RES-1', domain: 'CAD', executionId: 'EXEC-1', outputMetrics: { v: 100 }, bRepHash: 'H', kernelVersion: '1', isFabricated: false, actionId: 'EVAL', documentId: 'DOC', documentRevision: 1, featureOrOperationId: 'F', rawResultSummary: '', producedByKernel: 'S' },
        validation: { validationId: 'V1', passed: true, checks: [], resultId: 'RES-1', validatorVersion: '1', validatedAt: '' },
        verification: { verificationId: 'VR1', verifierIdentity: 'SYS', independentVerdict: 'PASS', resultId: 'RES-1', validationId: 'V1', verifierVersion: '1', isSelfAttested: false, verificationChecks: [], verifiedAt: '' },
        sourceOrigin: 'REAL_KERNEL'
      });
    };

    const evidence1 = generate();
    const evidence2 = generate();

    expect(evidence1.evidenceId).toBe(evidence2.evidenceId);
    expect(evidence1.integrityHash).toBe(evidence2.integrityHash);
    
    // Registry should not duplicate entries, should have exactly 1 record for this ID
    // Note: generateEvidence sets it in the registry using evidenceId as key.
    // If we call it twice, it overwrites the same key.
    const evidenceFromRegistry = EvidenceIntegrityEngine.getEvidence(evidence1.evidenceId);
    expect(evidenceFromRegistry).toBeDefined();
    expect(evidenceFromRegistry?.evidenceId).toBe(evidence1.evidenceId);
  });
});
