/**
 * SECP Industrial OS v2 — Forensic Engineering Network
 * PATCH-162: Cryptographic Attestation Test Suite
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AttestationCanonicalizer } from '../AttestationCanonicalizer';
import { AttestationRegistry } from '../AttestationRegistry';
import { AttestationSigner } from '../AttestationSigner';
import { CryptographicAttestationEngine } from '../CryptographicAttestationEngine';
import { HardAcceptanceGate162 } from '../HardAcceptanceGate162';
import { SigningKeyPair } from '../types';

describe('PATCH-162: Cryptographic Attestation', () => {
  let keyPair: SigningKeyPair;
  let trustedKeys: Record<string, string>;

  const defaultSubject = {
    subjectId: 'CAD-TURBINE-BLADE-901',
    subjectType: 'CAD_MODEL',
    revision: '1.0.0',
    artifactData: {
      chordMm: 120.5,
      spanMm: 350.0,
      airfoilSection: 'NACA-6409',
    },
  };

  const defaultEvidence = {
    evidenceId: 'EVID-FEM-BLADE-001',
    evidenceType: 'FEM',
    payload: {
      vonMisesMaxMpa: 285.4,
      safetyFactor: 1.85,
      meshElements: 42000,
    },
    resultHash: 'HASH_FEM_RES_BLADE_001',
  };

  const defaultExec = {
    executionId: 'EXEC-SOLVER-FEM-1002',
    solverIdentity: 'SECP-CALCULIX-FEM',
    solverVersion: '2.21',
    engineeringIdentity: 'ENG-OUBETAT-CHIEF-01',
    inputs: {
      youngsModulusGpa: 210,
      poissonRatio: 0.3,
      loadKn: 45.0,
    },
    outputs: {
      maxDisplacementMm: 1.42,
      maxStressMpa: 285.4,
    },
  };

  beforeEach(() => {
    keyPair = AttestationSigner.generateTestKeyPair('HMAC-SHA256', 'KEY_SECP_PRIMARY');
    trustedKeys = { [keyPair.keyId]: keyPair.publicKey };
    AttestationRegistry.resetInstance();
  });

  describe('Section A: Canonical Serialization & Hashing Invariants', () => {
    it('produces identical SHA-256 digests for out-of-order object keys', () => {
      const a = { alpha: 1, beta: { nested: true, count: 42 }, gamma: 'test' };
      const b = { gamma: 'test', alpha: 1, beta: { count: 42, nested: true } };

      const hashA = AttestationCanonicalizer.sha256(AttestationCanonicalizer.canonicalize(a));
      const hashB = AttestationCanonicalizer.sha256(AttestationCanonicalizer.canonicalize(b));

      expect(hashA).toBe(hashB);
      expect(hashA).toHaveLength(64);
    });

    it('normalizes numerical -0 to 0 invariantly', () => {
      const a = { val: -0 };
      const b = { val: 0 };
      expect(AttestationCanonicalizer.canonicalize(a)).toBe(AttestationCanonicalizer.canonicalize(b));
    });

    it('throws error when non-finite numbers are passed to canonicalizer', () => {
      expect(() => AttestationCanonicalizer.canonicalize({ val: Infinity })).toThrow();
      expect(() => AttestationCanonicalizer.canonicalize({ val: NaN })).toThrow();
    });
  });

  describe('Section B: Attestation Creation', () => {
    it('creates a valid 8-stage canonical attestation with authentic signature', () => {
      const res = CryptographicAttestationEngine.createAttestation({
        subject: defaultSubject,
        evidence: defaultEvidence,
        executionContext: defaultExec,
        keyPair,
      });

      expect(res.verdict).toBe('VALID');
      expect(res.attestation).toBeDefined();
      const att = res.attestation!;
      expect(att.status).toBe('ATTESTED');
      expect(att.subjectId).toBe(defaultSubject.subjectId);
      expect(att.executionId).toBe(defaultExec.executionId);
      expect(att.signature).toBeDefined();
      expect(att.signingKeyId).toBe(keyPair.keyId);
      expect(att.canonicalPayloadHash).toHaveLength(64);
      expect(att.attestationId).toMatch(/^ATT-[A-F0-9]{16}$/);
    });

    it('rejects creation when subject identifier is missing', () => {
      const res = CryptographicAttestationEngine.createAttestation({
        subject: { subjectId: '', subjectType: '', revision: '' },
        evidence: defaultEvidence,
        executionContext: defaultExec,
      });
      expect(res.verdict).toBe('INCOMPLETE');
      expect(res.attestation).toBeUndefined();
    });

    it('rejects creation when evidence is missing', () => {
      const res = CryptographicAttestationEngine.createAttestation({
        subject: defaultSubject,
        evidence: { evidenceId: '', evidenceType: '', payload: {}, resultHash: '' },
        executionContext: defaultExec,
      });
      expect(res.verdict).toBe('MISSING_EVIDENCE');
      expect(res.attestation).toBeUndefined();
    });

    it('rejects creation when execution context is missing', () => {
      const res = CryptographicAttestationEngine.createAttestation({
        subject: defaultSubject,
        evidence: defaultEvidence,
        executionContext: { executionId: '', solverIdentity: '', solverVersion: '', engineeringIdentity: '', inputs: {}, outputs: {} },
      });
      expect(res.verdict).toBe('INCOMPLETE');
      expect(res.attestation).toBeUndefined();
    });
  });

  describe('Section C: Independent Verification & Mutation Detection', () => {
    it('verifies a valid attestation and returns VALID with full integrity pass', () => {
      const createRes = CryptographicAttestationEngine.createAttestation({
        subject: defaultSubject,
        evidence: defaultEvidence,
        executionContext: defaultExec,
        keyPair,
      });
      const att = createRes.attestation!;

      const verifyRes = CryptographicAttestationEngine.verifyAttestation(att, {
        currentSubject: defaultSubject,
        currentEvidence: defaultEvidence,
        currentExecutionContext: defaultExec,
        trustedPublicKeys: trustedKeys,
      });

      expect(verifyRes.verdict).toBe('VALID');
      expect(verifyRes.integrityVerified).toBe(true);
      expect(verifyRes.subjectVerified).toBe(true);
      expect(verifyRes.evidenceVerified).toBe(true);
      expect(verifyRes.executionVerified).toBe(true);
      expect(verifyRes.signatureVerified).toBe(true);
      expect(verifyRes.signatureStatus).toBe('AVAILABLE');
    });

    it('detects modified artifact data and returns SUBJECT_MODIFIED', () => {
      const createRes = CryptographicAttestationEngine.createAttestation({
        subject: defaultSubject,
        evidence: defaultEvidence,
        executionContext: defaultExec,
        keyPair,
      });
      const att = createRes.attestation!;

      const tamperedSubject = {
        ...defaultSubject,
        artifactData: { ...defaultSubject.artifactData, chordMm: 999.9 },
      };

      const verifyRes = CryptographicAttestationEngine.verifyAttestation(att, {
        currentSubject: tamperedSubject,
        trustedPublicKeys: trustedKeys,
      });

      expect(verifyRes.verdict).toBe('SUBJECT_MODIFIED');
      expect(verifyRes.subjectVerified).toBe(false);
      expect(verifyRes.integrityVerified).toBe(false);
    });

    it('detects modified evidence and returns EVIDENCE_MODIFIED', () => {
      const createRes = CryptographicAttestationEngine.createAttestation({
        subject: defaultSubject,
        evidence: defaultEvidence,
        executionContext: defaultExec,
        keyPair,
      });
      const att = createRes.attestation!;

      const tamperedEvidence = {
        ...defaultEvidence,
        resultHash: 'HASH_TAMPERED_RESULT_VALUE',
      };

      const verifyRes = CryptographicAttestationEngine.verifyAttestation(att, {
        currentSubject: defaultSubject,
        currentEvidence: tamperedEvidence,
        trustedPublicKeys: trustedKeys,
      });

      expect(verifyRes.verdict).toBe('EVIDENCE_MODIFIED');
      expect(verifyRes.evidenceVerified).toBe(false);
    });

    it('detects modified solver version and returns INVALID', () => {
      const createRes = CryptographicAttestationEngine.createAttestation({
        subject: defaultSubject,
        evidence: defaultEvidence,
        executionContext: defaultExec,
        keyPair,
      });
      const att = createRes.attestation!;

      const tamperedExec = {
        ...defaultExec,
        solverVersion: '9.9.9-UNAUTHORIZED',
      };

      const verifyRes = CryptographicAttestationEngine.verifyAttestation(att, {
        currentSubject: defaultSubject,
        currentExecutionContext: tamperedExec,
        trustedPublicKeys: trustedKeys,
      });

      expect(verifyRes.verdict).toBe('INVALID');
      expect(verifyRes.executionVerified).toBe(false);
    });
  });

  describe('Section D: Signature Boundary & Cryptographic Authenticity', () => {
    it('handles unsigned attestations cleanly with UNAVAILABLE signature status and valid integrity', () => {
      const unsignedCreate = CryptographicAttestationEngine.createAttestation({
        subject: defaultSubject,
        evidence: defaultEvidence,
        executionContext: defaultExec,
        // No keyPair
      });
      const att = unsignedCreate.attestation!;

      const verifyRes = CryptographicAttestationEngine.verifyAttestation(att, {
        currentSubject: defaultSubject,
        currentExecutionContext: defaultExec,
      });

      expect(verifyRes.verdict).toBe('VALID');
      expect(verifyRes.integrityVerified).toBe(true);
      expect(verifyRes.signatureStatus).toBe('UNAVAILABLE');
      expect(verifyRes.signatureVerified).toBe('UNPROVEN');
    });

    it('detects forged signatures and returns SIGNATURE_INVALID', () => {
      const createRes = CryptographicAttestationEngine.createAttestation({
        subject: defaultSubject,
        evidence: defaultEvidence,
        executionContext: defaultExec,
        keyPair,
      });
      const att = createRes.attestation!;

      const forgedAttestation = {
        ...att,
        signature: 'beefcafe00112233445566778899aabbccddeeff00112233445566778899aabb',
      };

      const verifyRes = CryptographicAttestationEngine.verifyAttestation(forgedAttestation, {
        currentSubject: defaultSubject,
        trustedPublicKeys: trustedKeys,
      });

      expect(verifyRes.verdict).toBe('SIGNATURE_INVALID');
      expect(verifyRes.signatureVerified).toBe(false);
    });

    it('evaluates HardAcceptanceGate162 and all 15 checks pass', () => {
      const gateReport = HardAcceptanceGate162.evaluate();
      expect(gateReport.verdict).toBe('PASS');
      expect(gateReport.passedChecks).toBe(gateReport.totalChecks);
      expect(gateReport.totalChecks).toBeGreaterThanOrEqual(15);
      expect(gateReport.capabilities.canonicalSerialization).toBe('PROVEN');
      expect(gateReport.capabilities.attestationIntegrity).toBe('PROVEN');
      expect(gateReport.capabilities.tamperDetection).toBe('PROVEN');
    });
  });
});
