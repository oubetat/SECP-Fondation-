/**
 * SECP Industrial OS v2 — Forensic Engineering Network
 * PATCH-162: Adversarial Attestation & Tamper Attack Test Suite
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AttestationCanonicalizer } from '../AttestationCanonicalizer';
import { AttestationRegistry } from '../AttestationRegistry';
import { AttestationSigner } from '../AttestationSigner';
import { CryptographicAttestationEngine } from '../CryptographicAttestationEngine';
import { SigningKeyPair } from '../types';

describe('PATCH-162: Adversarial Tamper Attack Suite', () => {
  let keyPair: SigningKeyPair;
  let trustedKeys: Record<string, string>;

  const baseSubject = {
    subjectId: 'CAD-MANIFOLD-HYD-500',
    subjectType: 'CAD_MODEL',
    revision: '3.0.1',
    artifactData: {
      ports: 4,
      pressureRatingBar: 350,
      material: 'AL-7075-T6',
    },
  };

  const baseEvidence = {
    evidenceId: 'EVID-HYD-BURST-099',
    evidenceType: 'FEM',
    payload: {
      burstPressureBar: 1050,
      safetyMargin: 3.0,
      yieldLocation: 'PORT_2_FILLET',
    },
    resultHash: 'HASH_BURST_TEST_099_VALID',
  };

  const baseExec = {
    executionId: 'EXEC-HYDRO-STATIC-4411',
    solverIdentity: 'SECP-STRUCTURAL-FEM-V2',
    solverVersion: '2.5.0',
    engineeringIdentity: 'ENG-OUBETAT-CHIEF-01',
    inputs: {
      internalPressureBar: 350,
      ambientTempC: 25,
    },
    outputs: {
      maxStressMpa: 210.5,
      factorOfSafety: 2.38,
    },
  };

  const baseProvenance = {
    rootId: 'CAD-MANIFOLD-HYD-500',
    parentIds: ['CAD-MANIFOLD-HYD-499'],
    dependencyIds: ['MAT-AL-7075-T6', 'ISO-4401-03'],
    lineageHash: 'HASH_PROV_MANIFOLD_500_VALID',
  };

  const basePolicy = {
    policyId: 'POLICY-AEROSPACE-HYDRAULICS-V3',
    policyVersion: '3.1.0',
    rulesEvaluated: ['BURST_MARGIN_GT_2_5', 'MAX_STRESS_LT_YIELD_0_8'],
    policyHash: 'HASH_GOV_HYDRAULICS_V3_VALID',
  };

  beforeEach(() => {
    keyPair = AttestationSigner.generateTestKeyPair('ECDSA-P256-SHA256', 'KEY_SECP_ECDSA_ROOT');
    trustedKeys = { [keyPair.keyId]: keyPair.publicKey };
    AttestationRegistry.resetInstance();
  });

  it('Attack 1: Mutated artifactHash post-issuance fails verification', () => {
    const createRes = CryptographicAttestationEngine.createAttestation({
      subject: baseSubject,
      evidence: baseEvidence,
      executionContext: baseExec,
      provenance: baseProvenance,
      policy: basePolicy,
      keyPair,
    });
    const att = createRes.attestation!;

    // Adversary tampers with the artifact
    const tamperedSubject = {
      ...baseSubject,
      artifactData: { ...baseSubject.artifactData, pressureRatingBar: 700 }, // Changed rating
    };

    const verifyRes = CryptographicAttestationEngine.verifyAttestation(att, {
      currentSubject: tamperedSubject,
      trustedPublicKeys: trustedKeys,
    });

    expect(verifyRes.verdict).toBe('SUBJECT_MODIFIED');
    expect(verifyRes.subjectVerified).toBe(false);
  });

  it('Attack 2: Mutated evidence payload / resultHash fails verification', () => {
    const createRes = CryptographicAttestationEngine.createAttestation({
      subject: baseSubject,
      evidence: baseEvidence,
      executionContext: baseExec,
      keyPair,
    });
    const att = createRes.attestation!;

    // Adversary tampers with the supporting evidence
    const tamperedEvidence = {
      ...baseEvidence,
      resultHash: 'HASH_FORGED_BURST_TEST_VALUE_9999',
    };

    const verifyRes = CryptographicAttestationEngine.verifyAttestation(att, {
      currentSubject: baseSubject,
      currentEvidence: tamperedEvidence,
      trustedPublicKeys: trustedKeys,
    });

    expect(verifyRes.verdict).toBe('EVIDENCE_MODIFIED');
    expect(verifyRes.evidenceVerified).toBe(false);
  });

  it('Attack 3: Replay of historical attestation onto a different artifact revision fails', () => {
    const createRes = CryptographicAttestationEngine.createAttestation({
      subject: baseSubject,
      evidence: baseEvidence,
      executionContext: baseExec,
      keyPair,
    });
    const att = createRes.attestation!;

    // Newer artifact revision attempting to reuse previous valid attestation
    const nextGenSubject = {
      subjectId: 'CAD-MANIFOLD-HYD-500',
      subjectType: 'CAD_MODEL',
      revision: '3.1.0',
      artifactData: { ports: 6, pressureRatingBar: 400 },
    };

    const verifyRes = CryptographicAttestationEngine.verifyAttestation(att, {
      currentSubject: nextGenSubject,
      trustedPublicKeys: trustedKeys,
    });

    expect(verifyRes.verdict).toBe('SUBJECT_MODIFIED');
    expect(verifyRes.subjectVerified).toBe(false);
  });

  it('Attack 4: Solver boundary inputs substitution fails verification', () => {
    const createRes = CryptographicAttestationEngine.createAttestation({
      subject: baseSubject,
      evidence: baseEvidence,
      executionContext: baseExec,
      keyPair,
    });
    const att = createRes.attestation!;

    // Adversary claims solver was run at 100 Bar instead of 350 Bar
    const forgedExec = {
      ...baseExec,
      inputs: { ...baseExec.inputs, internalPressureBar: 100 },
    };

    const verifyRes = CryptographicAttestationEngine.verifyAttestation(att, {
      currentSubject: baseSubject,
      currentExecutionContext: forgedExec,
      trustedPublicKeys: trustedKeys,
    });

    expect(verifyRes.verdict).toBe('INVALID');
    expect(verifyRes.executionVerified).toBe(false);
  });

  it('Attack 5: Solver version alteration post-issuance is detected', () => {
    const createRes = CryptographicAttestationEngine.createAttestation({
      subject: baseSubject,
      evidence: baseEvidence,
      executionContext: baseExec,
      keyPair,
    });
    const att = createRes.attestation!;

    const forgedExec = {
      ...baseExec,
      solverVersion: '3.0.0-BETA-UNQUALIFIED',
    };

    const verifyRes = CryptographicAttestationEngine.verifyAttestation(att, {
      currentSubject: baseSubject,
      currentExecutionContext: forgedExec,
      trustedPublicKeys: trustedKeys,
    });

    expect(verifyRes.verdict).toBe('INVALID');
    expect(verifyRes.executionVerified).toBe(false);
  });

  it('Attack 6: Governance policy divergence is detected', () => {
    const createRes = CryptographicAttestationEngine.createAttestation({
      subject: baseSubject,
      evidence: baseEvidence,
      executionContext: baseExec,
      policy: basePolicy,
      keyPair,
    });
    const att = createRes.attestation!;

    const laxPolicy = {
      ...basePolicy,
      policyHash: 'HASH_LAX_UNAUTHORIZED_POLICY_HASH',
    };

    const verifyRes = CryptographicAttestationEngine.verifyAttestation(att, {
      currentSubject: baseSubject,
      currentPolicy: laxPolicy,
      trustedPublicKeys: trustedKeys,
    });

    expect(verifyRes.verdict).toBe('POLICY_MISMATCH');
    expect(verifyRes.policyVerified).toBe(false);
  });

  it('Attack 7: Signature splicing across attestations is detected and rejected', () => {
    const att1 = CryptographicAttestationEngine.createAttestation({
      subject: baseSubject,
      evidence: baseEvidence,
      executionContext: baseExec,
      keyPair,
    }).attestation!;

    const att2 = CryptographicAttestationEngine.createAttestation({
      subject: { ...baseSubject, subjectId: 'CAD-DIFFERENT-PART' },
      evidence: baseEvidence,
      executionContext: baseExec,
      keyPair,
    }).attestation!;

    // Transplant att1's signature into att2
    const splicedAttestation = {
      ...att2,
      signature: att1.signature,
    };

    const verifyRes = CryptographicAttestationEngine.verifyAttestation(splicedAttestation, {
      currentSubject: { ...baseSubject, subjectId: 'CAD-DIFFERENT-PART' },
      trustedPublicKeys: trustedKeys,
    });

    expect(verifyRes.verdict).toBe('SIGNATURE_INVALID');
    expect(verifyRes.signatureVerified).toBe(false);
  });

  it('Attack 8: Out-of-order canonical payload modification is detected', () => {
    const payloadA = {
      stage1_subject: { a: 1, b: 2 },
      stage2_inputs: { z: 'x' },
    };
    const payloadB = {
      stage1_subject: { b: 2, a: 1 },
      stage2_inputs: { z: 'x' },
    };

    // Deterministic canonicalization should produce same hash for identical content
    expect(AttestationCanonicalizer.hashObject(payloadA)).toBe(AttestationCanonicalizer.hashObject(payloadB));

    // But any content tampering changes the hash
    const tamperedPayload = {
      stage1_subject: { b: 3, a: 1 },
      stage2_inputs: { z: 'x' },
    };
    expect(AttestationCanonicalizer.hashObject(payloadA)).not.toBe(AttestationCanonicalizer.hashObject(tamperedPayload));
  });

  it('Attack 9: Severed parent provenance lineage is detected', () => {
    const createRes = CryptographicAttestationEngine.createAttestation({
      subject: baseSubject,
      evidence: baseEvidence,
      executionContext: baseExec,
      provenance: baseProvenance,
      keyPair,
    });
    const att = createRes.attestation!;

    const tamperedProv = {
      ...baseProvenance,
      lineageHash: 'HASH_DISCONNECTED_ORPHAN_LINEAGE',
    };

    const verifyRes = CryptographicAttestationEngine.verifyAttestation(att, {
      currentSubject: baseSubject,
      currentProvenance: tamperedProv,
      trustedPublicKeys: trustedKeys,
    });

    expect(verifyRes.verdict).toBe('PROVENANCE_MISMATCH');
    expect(verifyRes.provenanceVerified).toBe(false);
  });

  it('Attack 10: Claimant impersonation fails engineering identity check', () => {
    const createRes = CryptographicAttestationEngine.createAttestation({
      subject: baseSubject,
      evidence: baseEvidence,
      executionContext: baseExec,
      keyPair,
    });
    const att = createRes.attestation!;

    const impersonatedExec = {
      ...baseExec,
      engineeringIdentity: 'ENG-UNKNOWN-THIRD-PARTY',
    };

    const verifyRes = CryptographicAttestationEngine.verifyAttestation(att, {
      currentSubject: baseSubject,
      currentExecutionContext: impersonatedExec,
      trustedPublicKeys: trustedKeys,
    });

    expect(verifyRes.verdict).toBe('INVALID');
    expect(verifyRes.executionVerified).toBe(false);
  });
});
