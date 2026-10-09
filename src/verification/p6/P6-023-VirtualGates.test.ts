import { describe, it, expect } from 'vitest';
import { IndependentEvidenceIntegrityVerifier } from '../../engine/evidence/integrity/IndependentEvidenceIntegrityVerifier';
import { CanonicalEvidenceRecord } from '../../engine/evidence/integrity/EvidenceIntegrityTypes';

describe('P6-023 — VIRTUAL GATES', () => {
  it('P6-023-A — Virtual / UI-only gate lacking cryptographic execution reference is rejected', () => {
    const evidence: CanonicalEvidenceRecord = {
      evidenceId: 'EVD-VIRTUAL-GATE',
      evidenceType: 'UI_GATE',
      domain: 'CAD',
      documentId: 'DOC-1',
      documentRevision: 1,
      actionId: 'EVAL',
      executionId: 'VIRTUAL', // Missing real execution reference
      capabilityId: 'UI_GATE',
      featureId: 'GATE-1',
      sourceRevision: 1,
      resultRevision: 1,
      generatorVersion: 'SECP-UI',
      evaluatorVersion: 'SECP-UI-EVAL',
      kernelVersion: 'UI-SIMULATED',
      integrityHash: 'FORGED',
      state: 'VALID',
      canonicalPayload: {}, // Empty payload missing core data
      sourceOrigin: 'PREVIEW', // UI origin
      resultReference: { resultId: '', resultHash: '' },
      validationReference: { validationId: '', validationPassed: true },
      verificationReference: { verificationId: '', verifierIdentity: '', verdict: 'PASS' },
      topologyReferences: [],
      dependencyReferences: [],
      lineage: { upstreamEvidenceIds: [], stage: 'UI' },
      createdAt: ''
    };

    const result = IndependentEvidenceIntegrityVerifier.verifyEvidence(evidence);
    expect(result.passed).toBe(false);
    expect(result.failureReasons).toContain('Invalid source origin: PREVIEW cannot produce engineering evidence');
    expect(result.failureReasons).toContain('Evidence is not bound to an engineering result');
  });
});

