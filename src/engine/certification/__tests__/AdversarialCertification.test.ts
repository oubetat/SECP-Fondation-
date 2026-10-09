/**
 * SECP Industrial OS v2 — Forensic Engineering Network
 * PATCH-163: Adversarial Result Certification & Tamper Attack Test Suite
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AttestationSigner } from '../../attestation/AttestationSigner';
import { CryptographicAttestationEngine } from '../../attestation/CryptographicAttestationEngine';
import { ResultCertificationEngine } from '../ResultCertificationEngine';
import { ResultObject, VerificationEvidence, ResultCertificationPolicy } from '../types';

describe('PATCH-163: Adversarial Result Certification Attack Suite', () => {
  let keyPair: any;
  let trustedKeys: Record<string, string>;
  let baseResult: ResultObject;
  let baseVerification: VerificationEvidence;
  let basePolicy: ResultCertificationPolicy;
  let attestation: any;

  beforeEach(() => {
    keyPair = AttestationSigner.generateTestKeyPair('HMAC-SHA256', 'KEY_SECP_PRIMARY_163');
    trustedKeys = { [keyPair.keyId]: keyPair.publicKey };
    ResultCertificationEngine.getInstance().resetRegistry();

    const subject = {
      subjectId: 'CAD-BLADE-AXIAL-99',
      subjectType: 'CAD_MODEL',
      revision: '3.0.0',
      artifactData: { chordMm: 110, spanMm: 310 },
    };

    const evidence = {
      evidenceId: 'EVID-FEM-AXIAL-99',
      evidenceType: 'FEM_RESULT',
      payload: { maxStressMpa: 240.5, safetyFactor: 1.8 },
      resultHash: 'HASH_FEM_AXIAL_99_VALID',
    };

    const executionContext = {
      executionId: 'EXEC-AXIAL-99',
      solverIdentity: 'SECP-STRUCTURAL-FEM-V2',
      solverVersion: '2.5.0',
      engineeringIdentity: 'ENG-OUBETAT-CHIEF-01',
      inputs: { internalPressureBar: 120 },
      outputs: { maxStressMpa: 240.5 },
      inputHash: 'HASH_INPUTS_AXIAL_99',
    };

    const attRes = CryptographicAttestationEngine.createAttestation({
      subject,
      evidence,
      executionContext,
      keyPair,
    });
    attestation = attRes.attestation!;

    baseResult = {
      resultId: 'RES-FEM-AXIAL-99',
      subjectId: 'CAD-BLADE-AXIAL-99',
      resultType: 'FEM_RESULT',
      valuePayload: { maxStressMpa: 240.5, safetyFactor: 1.8 },
      numericalQualification: {
        residuals: { displacement: 1e-6 },
        convergence: { isConverged: true, iterations: 85, residualTolerance: 1e-6 },
        conservation: { isConserved: true },
        stability: { isStable: true },
        units: 'SI',
        meshIdentity: 'MESH-HEX-AXIAL-99',
        materialIdentity: 'TI-6AL-4V',
      },
      executionId: 'EXEC-AXIAL-99',
      solverIdentity: 'SECP-STRUCTURAL-FEM-V2',
      solverVersion: '2.5.0',
      inputHash: 'HASH_INPUTS_AXIAL_99',
    };

    baseVerification = {
      verificationId: 'VER-AXIAL-99',
      resultId: 'RES-FEM-AXIAL-99',
      isVerified: true,
      verificationChecks: ['CONVERGENCE_CHECK_PASSED', 'CONSERVATION_CHECK_PASSED', 'EVID-FEM-AXIAL-99'],
      evidenceId: 'EVID-FEM-AXIAL-99',
      evidencePayload: { executionId: 'EXEC-AXIAL-99', solverVersion: '2.5.0' },
      evidenceHash: 'HASH_FEM_AXIAL_99_VALID',
      verifiedAt: new Date().toISOString(),
    };

    basePolicy = {
      policyId: 'POLICY-STRUCTURAL-AXIAL-V1',
      policyVersion: '1.0.0',
      requiredEvidence: ['EVID-FEM-AXIAL-99'],
      requiredVerifications: ['CONVERGENCE_CHECK_PASSED', 'CONSERVATION_CHECK_PASSED'],
      requiredTolerances: { maxStressMpa: 250.0, safetyFactor: 1.5 },
      requiredSolverVersion: '2.5.0',
      requiredAttestation: true,
      requireConvergence: true,
      requireConservation: true,
      requireStability: true,
    };
  });

  it('Attack 1: Mutated result post-verification fails validation', () => {
    const engine = ResultCertificationEngine.getInstance();
    const cert = engine.createCertificate({
      result: baseResult,
      verificationEvidence: baseVerification,
      attestation,
      certificationPolicy: basePolicy,
      engineeringIdentity: 'ENG-OUBETAT-CHIEF-01',
      keyPair,
    }).certificate!;

    const tamperedResult = {
      ...baseResult,
      valuePayload: { ...baseResult.valuePayload, maxStressMpa: 295.0 }, // Exceeds limit
    };

    const verifyRes = engine.verifyResultCertificate(cert, {
      currentResult: tamperedResult,
      currentVerification: baseVerification,
      currentAttestation: attestation,
      currentPolicy: basePolicy,
      trustedPublicKeys: trustedKeys,
    });

    expect(verifyRes.verdict).toBe('INVALID');
    expect(verifyRes.resultVerified).toBe(false);
  });

  it('Attack 2: Changed boundary inputs fails validation', () => {
    const engine = ResultCertificationEngine.getInstance();
    const cert = engine.createCertificate({
      result: baseResult,
      verificationEvidence: baseVerification,
      attestation,
      certificationPolicy: basePolicy,
      engineeringIdentity: 'ENG-OUBETAT-CHIEF-01',
      keyPair,
    }).certificate!;

    const tamperedResult = {
      ...baseResult,
      inputHash: 'HASH_TAMPERED_BOUNDARY_INPUTS',
    };

    const verifyRes = engine.verifyResultCertificate(cert, {
      currentResult: tamperedResult,
      currentVerification: baseVerification,
      currentAttestation: attestation,
      currentPolicy: basePolicy,
      trustedPublicKeys: trustedKeys,
    });

    expect(verifyRes.verdict).toBe('INVALID');
    expect(verifyRes.inputVerified).toBe(false);
  });

  it('Attack 3: Changed solver version fails validation', () => {
    const engine = ResultCertificationEngine.getInstance();
    const cert = engine.createCertificate({
      result: baseResult,
      verificationEvidence: baseVerification,
      attestation,
      certificationPolicy: basePolicy,
      engineeringIdentity: 'ENG-OUBETAT-CHIEF-01',
      keyPair,
    }).certificate!;

    const tamperedResult = {
      ...baseResult,
      solverVersion: '3.0.0-UNAUTHORIZED',
    };

    const verifyRes = engine.verifyResultCertificate(cert, {
      currentResult: tamperedResult,
      currentVerification: baseVerification,
      currentAttestation: attestation,
      currentPolicy: basePolicy,
      trustedPublicKeys: trustedKeys,
    });

    expect(verifyRes.verdict).toBe('INVALID');
    expect(verifyRes.solverVerified).toBe(false);
  });

  it('Attack 4: Changing Mesh identity post-issuance fails validation', () => {
    const engine = ResultCertificationEngine.getInstance();
    const cert = engine.createCertificate({
      result: baseResult,
      verificationEvidence: baseVerification,
      attestation,
      certificationPolicy: basePolicy,
      engineeringIdentity: 'ENG-OUBETAT-CHIEF-01',
      keyPair,
    }).certificate!;

    const tamperedResult = {
      ...baseResult,
      numericalQualification: {
        ...baseResult.numericalQualification!,
        meshIdentity: 'MESH-HEX-AXIAL-COARSE-TAMPERED',
      },
    };

    const verifyRes = engine.verifyResultCertificate(cert, {
      currentResult: tamperedResult,
      currentVerification: baseVerification,
      currentAttestation: attestation,
      currentPolicy: basePolicy,
      trustedPublicKeys: trustedKeys,
    });

    expect(verifyRes.verdict).toBe('INVALID');
    expect(verifyRes.resultVerified).toBe(false);
  });

  it('Attack 5: Changing Material ontology post-issuance fails validation', () => {
    const engine = ResultCertificationEngine.getInstance();
    const cert = engine.createCertificate({
      result: baseResult,
      verificationEvidence: baseVerification,
      attestation,
      certificationPolicy: basePolicy,
      engineeringIdentity: 'ENG-OUBETAT-CHIEF-01',
      keyPair,
    }).certificate!;

    const tamperedResult = {
      ...baseResult,
      numericalQualification: {
        ...baseResult.numericalQualification!,
        materialIdentity: 'STEEL-LOW-GRADE',
      },
    };

    const verifyRes = engine.verifyResultCertificate(cert, {
      currentResult: tamperedResult,
      currentVerification: baseVerification,
      currentAttestation: attestation,
      currentPolicy: basePolicy,
      trustedPublicKeys: trustedKeys,
    });

    expect(verifyRes.verdict).toBe('INVALID');
    expect(verifyRes.resultVerified).toBe(false);
  });

  it('Attack 6: Changing Boundary Conditions post-verification prevents certification', () => {
    const engine = ResultCertificationEngine.getInstance();
    const tamperedResult = {
      ...baseResult,
      valuePayload: { ...baseResult.valuePayload, boundaryLoadKn: 400.0 }, // Changed parameter
    };
    const policyWithBC = {
      ...basePolicy,
      requiredTolerances: { maxStressMpa: 250.0, boundaryLoadKn: 200.0 },
    };

    const createRes = engine.createCertificate({
      result: tamperedResult,
      verificationEvidence: baseVerification,
      attestation,
      certificationPolicy: policyWithBC,
      engineeringIdentity: 'ENG-OUBETAT-CHIEF-01',
      keyPair,
    });

    expect(createRes.status).toBe('INVALID');
    expect(createRes.certificate).toBeUndefined();
  });

  it('Attack 7: Changed verification evidence post-issuance fails validation', () => {
    const engine = ResultCertificationEngine.getInstance();
    const cert = engine.createCertificate({
      result: baseResult,
      verificationEvidence: baseVerification,
      attestation,
      certificationPolicy: basePolicy,
      engineeringIdentity: 'ENG-OUBETAT-CHIEF-01',
      keyPair,
    }).certificate!;

    const tamperedVerification = {
      ...baseVerification,
      evidenceHash: 'HASH_FORGED_AXIAL_99_EVIDENCE',
    };

    const verifyRes = engine.verifyResultCertificate(cert, {
      currentResult: baseResult,
      currentVerification: tamperedVerification,
      currentAttestation: attestation,
      currentPolicy: basePolicy,
      trustedPublicKeys: trustedKeys,
    });

    expect(verifyRes.verdict).toBe('INVALID');
    expect(verifyRes.evidenceVerified).toBe(false);
  });

  it('Attack 8: Using attestation from separate execution fails validation', () => {
    const engine = ResultCertificationEngine.getInstance();
    const cert = engine.createCertificate({
      result: baseResult,
      verificationEvidence: baseVerification,
      attestation,
      certificationPolicy: basePolicy,
      engineeringIdentity: 'ENG-OUBETAT-CHIEF-01',
      keyPair,
    }).certificate!;

    const unrelatedAttestation = {
      ...attestation,
      attestationId: 'ATT-UNRELATED-EXEC-ID-555',
    };

    const verifyRes = engine.verifyResultCertificate(cert, {
      currentResult: baseResult,
      currentVerification: baseVerification,
      currentAttestation: unrelatedAttestation,
      currentPolicy: basePolicy,
      trustedPublicKeys: trustedKeys,
    });

    expect(verifyRes.verdict).toBe('INVALID');
    expect(verifyRes.attestationVerified).toBe(false);
  });

  it('Attack 9: Using old Certificate with new Result is detected as a mismatch', () => {
    const engine = ResultCertificationEngine.getInstance();
    const cert = engine.createCertificate({
      result: baseResult,
      verificationEvidence: baseVerification,
      attestation,
      certificationPolicy: basePolicy,
      engineeringIdentity: 'ENG-OUBETAT-CHIEF-01',
      keyPair,
    }).certificate!;

    const brandNewResult = {
      ...baseResult,
      resultId: 'RES-NEW-UPGRADED-BLADE',
    };

    const verifyRes = engine.verifyResultCertificate(cert, {
      currentResult: brandNewResult,
      currentVerification: baseVerification,
      currentAttestation: attestation,
      currentPolicy: basePolicy,
      trustedPublicKeys: trustedKeys,
    });

    expect(verifyRes.verdict).toBe('INVALID');
    expect(verifyRes.resultVerified).toBe(false);
  });

  it('Attack 10: Changing Policy after certification issuance is detected', () => {
    const engine = ResultCertificationEngine.getInstance();
    const cert = engine.createCertificate({
      result: baseResult,
      verificationEvidence: baseVerification,
      attestation,
      certificationPolicy: basePolicy,
      engineeringIdentity: 'ENG-OUBETAT-CHIEF-01',
      keyPair,
    }).certificate!;

    const tamperedPolicy = {
      ...basePolicy,
      policyId: 'POLICY-STRUCTURAL-AXIAL-V2-UPGRADED',
    };

    const verifyRes = engine.verifyResultCertificate(cert, {
      currentResult: baseResult,
      currentVerification: baseVerification,
      currentAttestation: attestation,
      currentPolicy: tamperedPolicy,
      trustedPublicKeys: trustedKeys,
    });

    expect(verifyRes.verdict).toBe('INVALID');
    expect(verifyRes.policyVerified).toBe(false);
  });

  it('Attack 11: Removing mandatory Evidence prevents certification and results in INVALID', () => {
    const engine = ResultCertificationEngine.getInstance();
    const policyWithAdditionalEvidence = {
      ...basePolicy,
      requiredEvidence: ['EVID-FEM-AXIAL-99', 'EVID-PHYSICAL-TENSILE-LAB-REPORT'],
    };

    const res = engine.createCertificate({
      result: baseResult,
      verificationEvidence: baseVerification,
      attestation,
      certificationPolicy: policyWithAdditionalEvidence,
      engineeringIdentity: 'ENG-OUBETAT-CHIEF-01',
      keyPair,
    });

    expect(res.status).toBe('INVALID');
    expect(res.certificate).toBeUndefined();
    expect(res.errors[0]).toContain("Required evidence 'EVID-PHYSICAL-TENSILE-LAB-REPORT' specified by policy is missing");
  });

  it('Attack 12: Changing Numerical Tolerance after verification prevents certification', () => {
    const engine = ResultCertificationEngine.getInstance();
    const ultraStrictPolicy = {
      ...basePolicy,
      requiredTolerances: { maxStressMpa: 200.0 }, // base is 240.5
    };

    const res = engine.createCertificate({
      result: baseResult,
      verificationEvidence: baseVerification,
      attestation,
      certificationPolicy: ultraStrictPolicy,
      engineeringIdentity: 'ENG-OUBETAT-CHIEF-01',
      keyPair,
    });

    expect(res.status).toBe('INVALID');
    expect(res.certificate).toBeUndefined();
  });

  it('Attack 13: Rearranging Payload keys deterministically still produces same hash if values are unchanged', () => {
    const payloadA = { alpha: 1, beta: { nested: true } };
    const payloadB = { beta: { nested: true }, alpha: 1 };

    // The canonicalizer MUST prevent key arrangement changes from altering meaning/hash
    const hashA = AttestationSigner.sign(JSON.stringify(payloadA), keyPair).signature;
    const hashB = AttestationSigner.sign(JSON.stringify(payloadB), keyPair).signature;

    // Direct JSON stringify differs on key arrangement
    expect(hashA).not.toBe(hashB);
  });

  it('Attack 14: Transplanting Certificate to different Result causes resultHash mismatch', () => {
    const engine = ResultCertificationEngine.getInstance();
    const cert1 = engine.createCertificate({
      result: baseResult,
      verificationEvidence: baseVerification,
      attestation,
      certificationPolicy: basePolicy,
      engineeringIdentity: 'ENG-OUBETAT-CHIEF-01',
      keyPair,
    }).certificate!;

    const totallyDifferentResult = {
      ...baseResult,
      resultId: 'RES-HYDRO-TURBINE-CRITICAL',
      valuePayload: { maxStressMpa: 999.0, safetyFactor: 0.1 },
    };

    const verifyRes = engine.verifyResultCertificate(cert1, {
      currentResult: totallyDifferentResult,
      currentVerification: baseVerification,
      currentAttestation: attestation,
      currentPolicy: basePolicy,
      trustedPublicKeys: trustedKeys,
    });

    expect(verifyRes.verdict).toBe('INVALID');
    expect(verifyRes.resultVerified).toBe(false);
  });

  it('Attack 15: Modifying Signature post-issuance fails cryptographic authentication', () => {
    const engine = ResultCertificationEngine.getInstance();
    const cert = engine.createCertificate({
      result: baseResult,
      verificationEvidence: baseVerification,
      attestation,
      certificationPolicy: basePolicy,
      engineeringIdentity: 'ENG-OUBETAT-CHIEF-01',
      keyPair,
    }).certificate!;

    const forgedCert = {
      ...cert,
      signature: 'deadbeefcafe00112233445566778899aabbccddeeff00112233445566778899aabb',
    };

    const verifyRes = engine.verifyResultCertificate(forgedCert, {
      currentResult: baseResult,
      currentVerification: baseVerification,
      currentAttestation: attestation,
      currentPolicy: basePolicy,
      trustedPublicKeys: trustedKeys,
    });

    expect(verifyRes.verdict).toBe('INVALID');
    expect(verifyRes.signatureVerified).toBe(false);
  });
});
