/**
 * SECP Industrial OS v2 — PROMPT-060: Evidence Integrity Proof
 * Comprehensive Engineering Evidence Verification Suite
 * 
 * Tests:
 * 1. Determinism, Canonical Serialization, and SHA-256 Immutability
 * 2. Real Kernel Execution Linkage (No UI / Preview / Notification bypass)
 * 3. Actual Engineering Result & Validation Binding
 * 4. Independent Verification & Anti-Self-Attestation
 * 5. Document Revision Freshness & Stale Evidence Detection
 * 6. All 30 Negative Proofs (EVD-NEG-001 to EVD-NEG-030)
 * 7. All 12 Positive Proofs (EVD-POS-001 to EVD-POS-012)
 * 8. All 15 Evidence Integrity Gates (GATES A to O)
 * 9. Mathematical Evidence Integrity Score (EIS = 100)
 * 10. The 15 Required Forensic Evidence Reports
 */

import { describe, it, expect } from 'vitest';
import { EvidenceIntegrityEngine } from '../../../engine/evidence/integrity/EvidenceIntegrityEngine';
import { IndependentEvidenceIntegrityVerifier } from '../../../engine/evidence/integrity/IndependentEvidenceIntegrityVerifier';
import { EvidenceIntegrityProofSuite } from '../../../engine/evidence/integrity/EvidenceIntegrityProofSuite';

describe('PROMPT-060 — Evidence Integrity Proof', () => {

  it('P060-01: Deterministic Canonical Serialization & Authentic SHA-256 Hashing', () => {
    const payloadA = {
      domain: 'CAD',
      z_value: 100.0,
      a_value: 50.0,
      nested: { beta: 2.0, alpha: 1.0 }
    };
    const payloadB = {
      nested: { alpha: 1.0, beta: 2.0 },
      a_value: 50.0,
      domain: 'CAD',
      z_value: 100.0
    };

    const canonA = EvidenceIntegrityEngine.canonicalize(payloadA);
    const canonB = EvidenceIntegrityEngine.canonicalize(payloadB);

    // Key order invariant
    expect(canonA).toBe(canonB);

    const hashA = EvidenceIntegrityEngine.sha256(canonA);
    const hashB = EvidenceIntegrityEngine.sha256(canonB);

    expect(hashA).toBe(hashB);
    expect(hashA).toHaveLength(64);
  });

  it('P060-02: Rejection of Evidence generated from UI state or Preview', () => {
    const base = EvidenceIntegrityProofSuite.createAuthenticCadResult('DOC-TEST-UI', 1);

    const uiEvidence = EvidenceIntegrityEngine.generateEvidence({
      domain: 'CAD',
      documentId: 'DOC-TEST-UI',
      documentRevision: 1,
      actionId: 'CLICK_BUTTON',
      executionId: 'UI_CLICK_01',
      capabilityId: 'UI',
      featureId: 'EXTRUDE_BASE',
      result: base.result,
      validation: base.validation,
      verification: base.verification,
      sourceOrigin: 'UI_STATE'
    });

    const audit = IndependentEvidenceIntegrityVerifier.verifyEvidence(uiEvidence);
    expect(audit.passed).toBe(false);
    expect(audit.verdict).toBe('FAIL');
    expect(audit.failureReasons.some(r => r.includes('Invalid source origin: UI_STATE'))).toBe(true);
  });

  it('P060-03: Rejection of Evidence without genuine validation', () => {
    const base = EvidenceIntegrityProofSuite.createAuthenticCadResult('DOC-TEST-VAL', 1);

    const unvalidatedEvidence = EvidenceIntegrityEngine.generateEvidence({
      domain: 'CAD',
      documentId: 'DOC-TEST-VAL',
      documentRevision: 1,
      actionId: 'ACTION_EXTRUDE',
      executionId: 'EXEC_01',
      capabilityId: 'CAD',
      featureId: 'EXTRUDE_BASE',
      result: base.result,
      validation: { ...base.validation, passed: false },
      verification: base.verification
    });

    const audit = IndependentEvidenceIntegrityVerifier.verifyEvidence(unvalidatedEvidence);
    expect(audit.passed).toBe(false);
    expect(unvalidatedEvidence.state).toBe('FAILED');
  });

  it('P060-04: Rejection of Self-Attestation Loops in Verification', () => {
    const base = EvidenceIntegrityProofSuite.createAuthenticCadResult('DOC-TEST-SELF', 1);

    const selfAttested = EvidenceIntegrityEngine.generateEvidence({
      domain: 'CAD',
      documentId: 'DOC-TEST-SELF',
      documentRevision: 1,
      actionId: 'ACTION_EXTRUDE',
      executionId: 'EXEC_01',
      capabilityId: 'CAD',
      featureId: 'EXTRUDE_BASE',
      result: base.result,
      validation: base.validation,
      verification: {
        ...base.verification,
        verifierIdentity: EvidenceIntegrityEngine.GENERATOR_VERSION, // Same as generator!
        isSelfAttested: true
      }
    });

    const audit = IndependentEvidenceIntegrityVerifier.verifyEvidence(selfAttested);
    expect(audit.passed).toBe(false);
    expect(audit.failureReasons.some(r => r.includes('detected self-attestation loop'))).toBe(true);
  });

  it('P060-05: Stale Evidence Detection when Document Revision advances', () => {
    const base = EvidenceIntegrityProofSuite.createAuthenticCadResult('DOC-TEST-REV', 1);

    const evRev1 = EvidenceIntegrityEngine.generateEvidence({
      domain: 'CAD',
      documentId: 'DOC-TEST-REV',
      documentRevision: 1,
      actionId: 'ACTION_EXTRUDE',
      executionId: 'EXEC_01',
      capabilityId: 'CAD',
      featureId: 'EXTRUDE_BASE',
      result: base.result,
      validation: base.validation,
      verification: base.verification
    });

    // Valid when current document is Rev 1
    const auditRev1 = IndependentEvidenceIntegrityVerifier.verifyEvidence(evRev1, { currentDocumentRevision: 1 });
    expect(auditRev1.passed).toBe(true);
    expect(auditRev1.verdict).toBe('PASS');

    // Stale when active model has evolved to Rev 2
    const auditRev2 = IndependentEvidenceIntegrityVerifier.verifyEvidence(evRev1, { currentDocumentRevision: 2 });
    expect(auditRev2.passed).toBe(false);
    expect(auditRev2.verdict).toBe('STALE');
    expect(auditRev2.failureReasons.some(r => r.includes('STALE'))).toBe(true);
  });

  it('P060-06: Cryptographic Tamper & Bit-Flip Detection', () => {
    const base = EvidenceIntegrityProofSuite.createAuthenticCadResult('DOC-TEST-TAMPER', 1);

    const authenticEv = EvidenceIntegrityEngine.generateEvidence({
      domain: 'CAD',
      documentId: 'DOC-TEST-TAMPER',
      documentRevision: 1,
      actionId: 'ACTION_EXTRUDE',
      executionId: 'EXEC_01',
      capabilityId: 'CAD',
      featureId: 'EXTRUDE_BASE',
      result: base.result,
      validation: base.validation,
      verification: base.verification
    });

    // Mutate single numeric metric in stored payload
    const tamperedPayload = {
      ...authenticEv.canonicalPayload,
      metrics: {
        ...authenticEv.canonicalPayload.metrics,
        volume: 800001 // subtle 1mm^3 alteration
      }
    };

    const tamperedRecord = {
      ...authenticEv,
      canonicalPayload: tamperedPayload
    };

    const audit = IndependentEvidenceIntegrityVerifier.verifyEvidence(tamperedRecord);
    expect(audit.passed).toBe(false);
    expect(audit.verdict).toBe('INTEGRITY_FAILURE');
    expect(audit.failureReasons.some(r => r.includes('Integrity hash mismatch'))).toBe(true);
  });

  it('P060-07: Full Execution of 30 Negative Proofs (EVD-NEG-001 through EVD-NEG-030)', () => {
    const negativeProofs = EvidenceIntegrityProofSuite.runNegativeProofs();
    expect(negativeProofs).toHaveLength(30);

    const failed = negativeProofs.filter(p => !p.passed);
    if (failed.length > 0) {
      console.error('FAILING NEGATIVE PROOFS:', failed.map(f => `${f.code}: ${f.name} -> ${f.details}`));
    }
    expect(failed).toHaveLength(0);
  });

  it('P060-08: Full Execution of 12 Positive Proofs (EVD-POS-001 through EVD-POS-012)', () => {
    const positiveProofs = EvidenceIntegrityProofSuite.runPositiveProofs();
    expect(positiveProofs).toHaveLength(12);

    for (const proof of positiveProofs) {
      expect(proof.passed).toBe(true);
    }
  });

  it('P060-09: Complete Evaluation of Evidence Integrity Gates A through O', () => {
    const pkg = EvidenceIntegrityProofSuite.buildFullEvidencePackage();
    expect(pkg.gates).toHaveLength(15);

    for (const gate of pkg.gates) {
      expect(gate.passed).toBe(true);
    }
  });

  it('P060-10: Mathematical Evidence Integrity Score (EIS = 100%)', () => {
    const pkg = EvidenceIntegrityProofSuite.buildFullEvidencePackage();
    expect(pkg.evidenceIntegrityScore.totalScore).toBe(100);
    expect(pkg.evidenceIntegrityScore.verdict).toBe('PASS');
    expect(pkg.evidenceIntegrityScore.deterministic).toBe(100);
    expect(pkg.evidenceIntegrityScore.traceable).toBe(100);
    expect(pkg.evidenceIntegrityScore.reproducible).toBe(100);
    expect(pkg.evidenceIntegrityScore.resultBound).toBe(100);
    expect(pkg.evidenceIntegrityScore.validationBound).toBe(100);
    expect(pkg.evidenceIntegrityScore.verificationBound).toBe(100);
    expect(pkg.evidenceIntegrityScore.revisionBound).toBe(100);
    expect(pkg.evidenceIntegrityScore.integrityVerified).toBe(100);
  });

  it('P060-11: Full Evidence Package with 15 Forensic Reports & Zero Critical Failures', () => {
    const pkg = EvidenceIntegrityProofSuite.buildFullEvidencePackage();
    expect(pkg.overallVerdict).toBe('PASS');
    expect(pkg.reports).toHaveLength(15);

    for (const report of pkg.reports) {
      expect(report.status).toBe('PASS');
    }

    // Confirm Report 14 explicitly records 0 critical failures
    const critReport = pkg.reports.find(r => r.reportNumber === 14);
    expect(critReport).toBeDefined();
    expect(critReport?.content.criticalFailuresEncountered).toBe(0);
    expect(critReport?.content.nonNegotiableViolations).toBe(0);
  });

});
