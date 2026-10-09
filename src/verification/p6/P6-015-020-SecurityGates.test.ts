import { describe, it, expect } from 'vitest';
import { EvidenceIntegrityEngine } from '../../engine/evidence/integrity/EvidenceIntegrityEngine';
import { IndependentEvidenceIntegrityVerifier } from '../../engine/evidence/integrity/IndependentEvidenceIntegrityVerifier';
import { CanonicalEvidenceRecord } from '../../engine/evidence/integrity/EvidenceIntegrityTypes';

describe('P6-015 to P6-020 — SECURITY GATES', () => {
  const createBaseEvidence = (overrides?: any): CanonicalEvidenceRecord => {
    return EvidenceIntegrityEngine.generateEvidence({
      domain: 'CAD', documentId: 'DOC', documentRevision: 1, actionId: 'EVAL', executionId: 'EXEC-1', capabilityId: 'BRep', featureId: 'F1',
      result: {
        resultId: 'RES-1', domain: 'CAD', executionId: 'EXEC-1', outputMetrics: {}, bRepHash: 'H', kernelVersion: '1', isFabricated: overrides?.isFabricated ?? false, actionId: 'EVAL', documentId: 'DOC', documentRevision: 1, featureOrOperationId: 'F1', rawResultSummary: '', producedByKernel: 'SECP'
      },
      validation: { validationId: 'V1', passed: true, checks: [], resultId: 'RES-1', validatorVersion: '1', validatedAt: '' },
      verification: { verificationId: 'VR1', verifierIdentity: overrides?.verifierIdentity ?? 'SYS_INDEPENDENT', independentVerdict: 'PASS', resultId: 'RES-1', validationId: 'V1', verifierVersion: '1', isSelfAttested: false, verificationChecks: [], verifiedAt: '' },
      sourceOrigin: 'REAL_KERNEL'
    });
  };

  it('P6-015 — CRYPTOGRAPHIC NON-REPUDIATION (Verifies Hash identity)', () => {
    const ev = createBaseEvidence();
    const result = IndependentEvidenceIntegrityVerifier.verifyEvidence(ev);
    expect(result.passed).toBe(true);
    
    // Hash verifies mathematically
    const verifyHash = EvidenceIntegrityEngine.verifyDeterministicHash(ev.canonicalPayload, ev.integrityHash);
    expect(verifyHash.valid).toBe(true);
  });

  it('P6-018 — FABRICATION REJECTION', () => {
    const ev = createBaseEvidence({ isFabricated: true });
    // The generateEvidence sets resultReference.isFabricated, but let's pass actualResult to verifier
    const actualResult = {
      resultId: 'RES-1', domain: 'CAD' as const, executionId: 'EXEC-1', outputMetrics: {}, bRepHash: 'H', kernelVersion: '1', isFabricated: true, actionId: 'EVAL', documentId: 'DOC', documentRevision: 1, featureOrOperationId: 'F1', rawResultSummary: '', producedByKernel: 'SECP'
    };
    
    const result = IndependentEvidenceIntegrityVerifier.verifyEvidence(ev, { actualResult });
    expect(result.passed).toBe(false);
    expect(result.failureReasons).toContain('Underlying engineering result is fabricated or synthetic placeholder');
  });

  it('P6-019 — SELF-ATTESTATION BLOCK', () => {
    // If verifierIdentity matches the generatorVersion/System, it blocks
    const ev = createBaseEvidence({ verifierIdentity: '2.4.0' });
    const result = IndependentEvidenceIntegrityVerifier.verifyEvidence(ev);
    
    expect(result.passed).toBe(false);
    expect(result.failureReasons).toContain('Missing independent verification or detected self-attestation loop');
  });
});
