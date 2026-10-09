import { describe, it, expect } from 'vitest';
import { EvidenceIntegrityEngine } from '../../engine/evidence/integrity/EvidenceIntegrityEngine';
import { IndependentEvidenceIntegrityVerifier } from '../../engine/evidence/integrity/IndependentEvidenceIntegrityVerifier';
import { CanonicalEvidenceRecord } from '../../engine/evidence/integrity/EvidenceIntegrityTypes';

describe('P6-012 — TAMPER DETECTION', () => {
  const createValidEvidence = (): CanonicalEvidenceRecord => {
    return EvidenceIntegrityEngine.generateEvidence({
      domain: 'FEA',
      documentId: 'P6-DOC-012',
      documentRevision: 1,
      actionId: 'EVAL',
      executionId: 'EXEC-1',
      capabilityId: 'SIM',
      featureId: 'FEA-1',
      result: {
        resultId: 'RES-1', domain: 'FEA', executionId: 'EXEC-1', outputMetrics: { stress: 100 }, bRepHash: 'H', kernelVersion: '1', isFabricated: false, actionId: 'EVAL', documentId: 'P6-DOC-012', documentRevision: 1, featureOrOperationId: 'FEA-1', rawResultSummary: '', producedByKernel: 'SECP'
      },
      validation: { validationId: 'V1', passed: true, checks: [], resultId: 'RES-1', validatorVersion: '1', validatedAt: '' },
      verification: { verificationId: 'VR1', verifierIdentity: 'SYS', independentVerdict: 'PASS', resultId: 'RES-1', validationId: 'V1', verifierVersion: '1', isSelfAttested: false, verificationChecks: [], verifiedAt: '' },
      sourceOrigin: 'REAL_KERNEL'
    });
  };

  it('P6-012-A — Detects canonical payload tampering', () => {
    const evidence = createValidEvidence();
    // Tamper with payload
    const tamperedEvidence: CanonicalEvidenceRecord = { ...evidence, canonicalPayload: { ...evidence.canonicalPayload, executionId: 'FORGED-EXEC' } };

    const result = IndependentEvidenceIntegrityVerifier.verifyEvidence(tamperedEvidence);
    expect(result.passed).toBe(false);
    expect(result.verdict).toBe('INTEGRITY_FAILURE');
    expect(result.failureReasons).toContain('Integrity hash mismatch: payload has been tampered or corrupted');
  });

  it('P6-012-B — Detects integrity hash tampering', () => {
    const evidence = createValidEvidence();
    const tamperedEvidence: CanonicalEvidenceRecord = { ...evidence, integrityHash: 'FORGED-HASH' };

    const result = IndependentEvidenceIntegrityVerifier.verifyEvidence(tamperedEvidence);
    expect(result.passed).toBe(false);
    expect(result.verdict).toBe('INTEGRITY_FAILURE');
    expect(result.failureReasons).toContain('Integrity hash mismatch: payload has been tampered or corrupted');
  });

  it('P6-012-C — Detects missing result reference', () => {
    const evidence = createValidEvidence();
    const tamperedEvidence: CanonicalEvidenceRecord = { ...evidence, resultReference: { resultId: '', resultHash: '' } };

    const result = IndependentEvidenceIntegrityVerifier.verifyEvidence(tamperedEvidence);
    expect(result.passed).toBe(false);
    expect(result.failureReasons).toContain('Evidence is not bound to an engineering result');
  });

  it('P6-012-D — Detects fabricated origin', () => {
    const evidence = createValidEvidence();
    const tamperedEvidence: CanonicalEvidenceRecord = { ...evidence, sourceOrigin: 'PREVIEW' };

    const result = IndependentEvidenceIntegrityVerifier.verifyEvidence(tamperedEvidence);
    expect(result.passed).toBe(false);
    expect(result.failureReasons).toContain('Invalid source origin: PREVIEW cannot produce engineering evidence');
  });
});
