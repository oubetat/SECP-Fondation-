/**
 * SECP Industrial OS v2 — Forensic Engineering Network
 * PATCH-163: Result Certification Standard Test Suite
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AttestationSigner } from '../../attestation/AttestationSigner';
import { CryptographicAttestationEngine } from '../../attestation/CryptographicAttestationEngine';
import { ResultCertificationEngine } from '../ResultCertificationEngine';
import { HardAcceptanceGate163 } from '../HardAcceptanceGate163';
import { ResultObject, VerificationEvidence, ResultCertificationPolicy } from '../types';

describe('PATCH-163: Result Certification Standard Suite', () => {
  let keyPair: any;
  let trustedKeys: Record<string, string>;
  let defaultResult: ResultObject;
  let defaultVerification: VerificationEvidence;
  let defaultPolicy: ResultCertificationPolicy;
  let attestation: any;

  beforeEach(() => {
    keyPair = AttestationSigner.generateTestKeyPair('HMAC-SHA256', 'KEY_SECP_PRIMARY_163');
    trustedKeys = { [keyPair.keyId]: keyPair.publicKey };
    ResultCertificationEngine.getInstance().resetRegistry();

    const subject = {
      subjectId: 'CAD-IMPELLER-B100',
      subjectType: 'CAD_MODEL',
      revision: '2.1.0',
      artifactData: { radiusMm: 85.0, bladesCount: 12, material: 'AL-6061-T6' },
    };

    const evidence = {
      evidenceId: 'EVID-CFD-IMPELLER-002',
      evidenceType: 'CFD_RESULT',
      payload: { outletVelocityM_S: 45.2, efficiencyPct: 92.4, maxPressureBar: 12.5 },
      resultHash: 'HASH_CFD_IMPELLER_002_VALID',
    };

    const executionContext = {
      executionId: 'EXEC-HYDRO-IMPELLER-2002',
      solverIdentity: 'SECP-NAVIER-STOKES-V2',
      solverVersion: '2.4.1',
      engineeringIdentity: 'ENG-OUBETAT-CHIEF-01',
      inputs: { fluidDensityKg_M3: 998.2, rotorSpeedRpm: 3200 },
      outputs: { pressureDropBar: 12.5, massFlowRateKg_S: 18.2 },
      inputHash: 'HASH_INPUT_DENSITY_SPEED_MATCH',
    };

    const attRes = CryptographicAttestationEngine.createAttestation({
      subject,
      evidence,
      executionContext,
      keyPair,
    });
    attestation = attRes.attestation!;

    defaultResult = {
      resultId: 'RES-CFD-IMPELLER-002',
      subjectId: 'CAD-IMPELLER-B100',
      resultType: 'CFD_RESULT',
      valuePayload: { outletVelocityM_S: 45.2, efficiencyPct: 92.4, maxPressureBar: 12.5 },
      numericalQualification: {
        residuals: { momentum: 1e-5, continuity: 1e-5 },
        convergence: { isConverged: true, iterations: 120, residualTolerance: 1e-5 },
        conservation: { isConserved: true, massError: 1e-6 },
        stability: { isStable: true, courantNumber: 0.85 },
        units: 'SI',
        meshIdentity: 'MESH-HEX-FINE-01',
        materialIdentity: 'AL-6061-T6',
      },
      executionId: 'EXEC-HYDRO-IMPELLER-2002',
      solverIdentity: 'SECP-NAVIER-STOKES-V2',
      solverVersion: '2.4.1',
      inputHash: 'HASH_INPUT_DENSITY_SPEED_MATCH',
    };

    defaultVerification = {
      verificationId: 'VER-IMPELLER-002',
      resultId: 'RES-CFD-IMPELLER-002',
      isVerified: true,
      verificationChecks: ['CONVERGENCE_CHECK_PASSED', 'CONSERVATION_CHECK_PASSED', 'EVID-CFD-IMPELLER-002'],
      evidenceId: 'EVID-CFD-IMPELLER-002',
      evidencePayload: { executionId: 'EXEC-HYDRO-IMPELLER-2002', solverVersion: '2.4.1' },
      evidenceHash: 'HASH_CFD_IMPELLER_002_VALID',
      verifiedAt: new Date().toISOString(),
    };

    defaultPolicy = {
      policyId: 'POLICY-HYDRO-CFD-QUALIFIED-V1',
      policyVersion: '1.0.0',
      requiredEvidence: ['EVID-CFD-IMPELLER-002'],
      requiredVerifications: ['CONVERGENCE_CHECK_PASSED', 'CONSERVATION_CHECK_PASSED'],
      requiredTolerances: { maxPressureBar: 15.0, efficiencyPct: 90.0 },
      requiredSolverVersion: '2.4.1',
      requiredAttestation: true,
      requireConvergence: true,
      requireConservation: true,
      requireStability: true,
    };
  });

  describe('Section A: Result Certification Core Flows', () => {
    it('successfully issues a certificate when all criteria are met', () => {
      const res = ResultCertificationEngine.getInstance().createCertificate({
        result: defaultResult,
        verificationEvidence: defaultVerification,
        attestation,
        certificationPolicy: defaultPolicy,
        engineeringIdentity: 'ENG-OUBETAT-CHIEF-01',
        keyPair,
      });

      if (res.status !== 'CERTIFIED') {
        console.log('RECREATION ERRORS:', res.errors);
      }

      expect(res.status).toBe('CERTIFIED');
      expect(res.certificate).toBeDefined();
      const cert = res.certificate!;
      expect(cert.certificateId).toMatch(/^CERT-[A-F0-9]{16}$/);
      expect(cert.certificationStatus).toBe('CERTIFIED');
      expect(cert.signature).toBeDefined();
    });

    it('denies certification if verification status is false', () => {
      const badVerification = { ...defaultVerification, isVerified: false };
      const res = ResultCertificationEngine.getInstance().createCertificate({
        result: defaultResult,
        verificationEvidence: badVerification,
        attestation,
        certificationPolicy: defaultPolicy,
        engineeringIdentity: 'ENG-OUBETAT-CHIEF-01',
        keyPair,
      });

      expect(res.status).toBe('INVALID');
      expect(res.certificate).toBeUndefined();
      expect(res.errors).toContain('Verification status is failed. Unverified results cannot be certified.');
    });

    it('returns INCOMPLETE if critical elements like result or verification are missing', () => {
      const res = ResultCertificationEngine.getInstance().createCertificate({
        result: null as any,
        verificationEvidence: defaultVerification,
        attestation,
        certificationPolicy: defaultPolicy,
        engineeringIdentity: 'ENG-OUBETAT-CHIEF-01',
      });
      expect(res.status).toBe('INCOMPLETE');
    });
  });

  describe('Section B: Independent Verification & Reproducibility', () => {
    it('verifies a valid certificate and confirms absolute reproducing parity', () => {
      const engine = ResultCertificationEngine.getInstance();
      const createRes = engine.createCertificate({
        result: defaultResult,
        verificationEvidence: defaultVerification,
        attestation,
        certificationPolicy: defaultPolicy,
        engineeringIdentity: 'ENG-OUBETAT-CHIEF-01',
        keyPair,
      });
      const cert = createRes.certificate!;

      const verifyRes = engine.verifyResultCertificate(cert, {
        currentResult: defaultResult,
        currentVerification: defaultVerification,
        currentAttestation: attestation,
        currentPolicy: defaultPolicy,
        trustedPublicKeys: trustedKeys,
      });

      expect(verifyRes.verdict).toBe('CERTIFIED');
      expect(verifyRes.integrityVerified).toBe(true);
      expect(verifyRes.resultVerified).toBe(true);
      expect(verifyRes.signatureStatus).toBe('AUTHENTIC');
    });

    it('reproduces verification identically from serialized/re-loaded JSON payload', () => {
      const engine = ResultCertificationEngine.getInstance();
      const cert = engine.createCertificate({
        result: defaultResult,
        verificationEvidence: defaultVerification,
        attestation,
        certificationPolicy: defaultPolicy,
        engineeringIdentity: 'ENG-OUBETAT-CHIEF-01',
        keyPair,
      }).certificate!;

      const serialized = JSON.stringify(cert);
      const reloaded = JSON.parse(serialized);

      const verifyRes = engine.verifyResultCertificate(reloaded, {
        currentResult: defaultResult,
        currentVerification: defaultVerification,
        currentAttestation: attestation,
        currentPolicy: defaultPolicy,
        trustedPublicKeys: trustedKeys,
      });

      expect(verifyRes.verdict).toBe('CERTIFIED');
      expect(verifyRes.integrityVerified).toBe(true);
    });
  });

  describe('Section C: Acceptance Gate 163', () => {
    it('runs the HardAcceptanceGate163 suite successfully with all checks passing', () => {
      const report = HardAcceptanceGate163.evaluate();
      if (report.verdict !== 'PASS') {
        const failed = report.checks.filter(c => !c.passed);
        console.log('FAILED GATE CHECKS:', failed);
      }
      expect(report.verdict).toBe('PASS');
      expect(report.passedChecks).toBe(report.totalChecks);
      expect(report.totalChecks).toBeGreaterThanOrEqual(15);
      expect(report.capabilities.resultIntegrity).toBe('PROVEN');
      expect(report.capabilities.tamperDetection).toBe('PROVEN');
    });
  });
});
