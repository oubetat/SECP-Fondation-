import { describe, it, expect } from 'vitest';
import { EvidenceIntegrityEngine } from '../../engine/evidence/integrity/EvidenceIntegrityEngine';
import { IndependentEvidenceIntegrityVerifier } from '../../engine/evidence/integrity/IndependentEvidenceIntegrityVerifier';
import { CanonicalEvidenceRecord, EngineeringResultRecord } from '../../engine/evidence/integrity/EvidenceIntegrityTypes';

describe('P6-013 — CROSS-REVISION MISMATCH', () => {
  const createEvidenceAndResult = (revision: number): { evidence: CanonicalEvidenceRecord, result: EngineeringResultRecord } => {
    const result: EngineeringResultRecord = {
      resultId: `RES-${revision}`, domain: 'CAD', executionId: `EXEC-${revision}`, outputMetrics: { metric: revision }, bRepHash: 'H', kernelVersion: '1', isFabricated: false, actionId: 'EVAL', documentId: 'P6-DOC-013', documentRevision: revision, featureOrOperationId: 'FEA', rawResultSummary: '', producedByKernel: 'SECP'
    };
    
    const evidence = EvidenceIntegrityEngine.generateEvidence({
      domain: 'CAD', documentId: 'P6-DOC-013', documentRevision: revision, actionId: 'EVAL', executionId: result.executionId, capabilityId: 'SIM', featureId: 'FEA',
      result, validation: { validationId: 'V', passed: true, checks: [], resultId: result.resultId, validatorVersion: '1', validatedAt: '' },
      verification: { verificationId: 'VR', verifierIdentity: 'SYS', independentVerdict: 'PASS', resultId: result.resultId, validationId: 'V', verifierVersion: '1', isSelfAttested: false, verificationChecks: [], verifiedAt: '' },
      sourceOrigin: 'REAL_KERNEL'
    });
    
    return { evidence, result };
  };

  it('P6-013-A — REV-A evidence + REV-B source rejects', () => {
    const { evidence: evA } = createEvidenceAndResult(1);
    
    const result = IndependentEvidenceIntegrityVerifier.verifyEvidence(evA, { currentDocumentRevision: 2 });
    expect(result.passed).toBe(false);
    expect(result.failureReasons).toContain('Evidence is STALE: document revision has advanced');
    expect(result.verdict).toBe('STALE');
  });

  it('P6-013-B — REV-B evidence + REV-A source rejects', () => {
    const { evidence: evB } = createEvidenceAndResult(2);
    
    const result = IndependentEvidenceIntegrityVerifier.verifyEvidence(evB, { currentDocumentRevision: 1 });
    expect(result.passed).toBe(false);
    expect(result.failureReasons).toContain('Evidence references mismatched or forward document revision');
    expect(result.verdict).toBe('STALE'); // The engine treats any rev mismatch as a staleness/mismatch issue
  });

  it('P6-013-C — REV-B result + REV-A evidence rejects', () => {
    const { evidence: evA } = createEvidenceAndResult(1);
    const { result: resB } = createEvidenceAndResult(2);
    
    const result = IndependentEvidenceIntegrityVerifier.verifyEvidence(evA, { actualResult: resB });
    expect(result.passed).toBe(false);
    expect(result.failureReasons).toContain('Result ID mismatch between evidence reference and verified execution result');
  });
});
