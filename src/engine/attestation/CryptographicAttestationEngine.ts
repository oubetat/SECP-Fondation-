/**
 * SECP Industrial OS v2 — Forensic Engineering Network
 * PATCH-162: Cryptographic Attestation Engine
 * 
 * Strict Enforcement:
 * «ENGINEERING EVIDENCE MUST BE DERIVED FROM VERIFIED ENGINEERING EXECUTION.»
 * «MATH.RANDOM() MUST NEVER GENERATE ENGINEERING EVIDENCE OR ATTESTATIONS.»
 * «A HASH PROVES INTEGRITY OF DATA; IT DOES NOT PROVE ENGINEERING CORRECTNESS.»
 */

import { AttestationCanonicalizer } from './AttestationCanonicalizer';
import { AttestationSigner } from './AttestationSigner';
import { AttestationRegistry } from './AttestationRegistry';
import {
  CreateAttestationParams,
  CryptographicAttestation,
  AttestationVerificationCurrentState,
  AttestationVerificationResult,
  AttestationVerdict,
  AttestationStatus,
  AttestationCanonicalPayload,
  SubjectType
} from './types';

export class CryptographicAttestationEngine {
  public static readonly ENGINE_VERSION = '2.0.0';

  /**
   * Creates a verifiable 8-stage cryptographic attestation binding:
   * Subject -> Inputs -> Execution -> Solver -> Output -> Verification -> Evidence -> Policy
   */
  public static createAttestation(params: CreateAttestationParams): {
    verdict: AttestationVerdict;
    attestation?: CryptographicAttestation;
    error?: string;
  } {
    // 1. Enforce complete Subject reference
    if (
      !params.subject ||
      !params.subject.subjectId ||
      params.subject.subjectId.trim() === '' ||
      !params.subject.subjectType ||
      params.subject.subjectType.trim() === '' ||
      !params.subject.revision ||
      params.subject.revision.trim() === ''
    ) {
      return {
        verdict: 'INCOMPLETE',
        error: 'Missing required subject identifier, subjectType, or revision.'
      };
    }

    // 2. Enforce complete Evidence reference
    if (
      !params.evidence ||
      !params.evidence.evidenceId ||
      params.evidence.evidenceId.trim() === '' ||
      !params.evidence.resultHash ||
      params.evidence.resultHash.trim() === ''
    ) {
      return {
        verdict: 'MISSING_EVIDENCE',
        error: 'Verifiable evidence and resultHash must accompany attestation.'
      };
    }

    // 3. Enforce complete Execution Context reference
    if (
      !params.executionContext ||
      !params.executionContext.executionId ||
      params.executionContext.executionId.trim() === '' ||
      !params.executionContext.solverIdentity ||
      params.executionContext.solverIdentity.trim() === '' ||
      !params.executionContext.engineeringIdentity ||
      params.executionContext.engineeringIdentity.trim() === ''
    ) {
      return {
        verdict: 'INCOMPLETE',
        error: 'Execution context must specify executionId, solverIdentity, and engineeringIdentity.'
      };
    }

    // 4. Compute deterministic hashes for each stage
    const artifactHash =
      params.subject.artifactHash ||
      (params.subject.artifactData
        ? AttestationCanonicalizer.hashObject(params.subject.artifactData)
        : AttestationCanonicalizer.sha256(params.subject.subjectId));

    const evidenceHash =
      params.evidence.resultHash ||
      params.evidence.payloadHash ||
      (params.evidence.payload && Object.keys(params.evidence.payload).length > 0
        ? AttestationCanonicalizer.hashObject(params.evidence.payload)
        : 'EVID_HASH_NONE');

    const inputHash =
      params.executionContext.inputHash ||
      AttestationCanonicalizer.hashObject(params.executionContext.inputs || {});

    const outputHash =
      params.executionContext.outputHash ||
      AttestationCanonicalizer.hashObject(params.executionContext.outputs || {});

    const verificationHash =
      params.verification?.verificationHash ||
      (params.verification
        ? AttestationCanonicalizer.hashObject(params.verification)
        : 'VERIF_NONE_0000');

    const gateVerdict = params.verification?.verdict || 'UNPROVEN';

    const provenanceHash =
      params.provenance?.lineageHash ||
      (params.provenance
        ? AttestationCanonicalizer.hashObject(params.provenance)
        : 'PROV_NONE_0000');

    const policyHash =
      params.policy?.policyHash ||
      (params.policy
        ? AttestationCanonicalizer.hashObject(params.policy)
        : 'POLICY_NONE_0000');

    const policyId = params.policy?.policyId || 'DEFAULT_BASELINE_POLICY';

    // 5. Assemble structured 8-stage canonical payload
    const canonicalPayload: AttestationCanonicalPayload = {
      subject: {
        subjectId: params.subject.subjectId,
        subjectType: params.subject.subjectType,
        revision: params.subject.revision,
        artifactHash
      },
      inputs: {
        inputHash,
        solverInputs: params.executionContext.inputs || {}
      },
      execution: {
        executionId: params.executionContext.executionId,
        engineeringIdentity: params.executionContext.engineeringIdentity,
        timestamp: params.executionContext.executionTimestamp || new Date().toISOString(),
        environmentHash: params.executionContext.computeEnvironment
          ? AttestationCanonicalizer.hashObject(params.executionContext.computeEnvironment)
          : 'ENV_STANDARD_000'
      },
      solver: {
        solverIdentity: params.executionContext.solverIdentity,
        solverVersion: params.executionContext.solverVersion || '1.0.0'
      },
      output: {
        outputHash
      },
      verification: {
        verificationHash,
        gateVerdict
      },
      evidence: {
        evidenceId: params.evidence.evidenceId,
        evidenceHash
      },
      policy: {
        policyId,
        policyHash
      }
    };

    const canonicalPayloadString = AttestationCanonicalizer.buildCanonicalPayload(canonicalPayload);
    const canonicalPayloadHash = AttestationCanonicalizer.sha256(canonicalPayloadString);

    // 6. Generate deterministic Attestation ID
    const attestationId = AttestationCanonicalizer.generateAttestationId(
      params.subject.subjectId,
      params.executionContext.executionId,
      canonicalPayloadHash
    );

    // 7. Cryptographic digital signing (if keyPair provided)
    const signResult = params.keyPair
      ? AttestationSigner.sign(canonicalPayloadString, params.keyPair)
      : {
          signature: undefined,
          signingKeyId: undefined,
          algorithm: 'NONE',
          status: 'UNAVAILABLE' as const
        };

    const attestation: CryptographicAttestation = {
      attestationId,
      subjectId: params.subject.subjectId,
      subjectType: params.subject.subjectType as SubjectType,
      artifactHash,
      evidenceHash,
      provenanceHash,
      executionId: params.executionContext.executionId,
      engineeringIdentity: params.executionContext.engineeringIdentity,
      solverIdentity: params.executionContext.solverIdentity,
      solverVersion: params.executionContext.solverVersion || '1.0.0',
      inputHash,
      outputHash,
      verificationHash,
      gateVerdict,
      policyHash,
      policyId,
      revision: params.subject.revision,
      evidenceId: params.evidence.evidenceId,
      createdAt: new Date().toISOString(),
      attestationVersion: params.attestationVersion || this.ENGINE_VERSION,
      algorithm: signResult.algorithm || 'NONE',
      canonicalPayloadHash,
      canonicalPayloadString,
      signature: signResult.signature,
      signingKeyId: signResult.signingKeyId,
      status: 'ATTESTED'
    };

    // 8. Register in instance registry if present
    AttestationRegistry.getInstance().register(attestation);

    return {
      verdict: 'VALID',
      attestation
    };
  }

  /**
   * Independently verifies an issued attestation against current system state and trusted keys.
   */
  public static verifyAttestation(
    attestation: CryptographicAttestation,
    currentState?: AttestationVerificationCurrentState
  ): AttestationVerificationResult {
    const details: string[] = [];
    const verifiedAt = new Date().toISOString();

    // 1. Recompute canonical payload from the attestation's embedded parameters
    const reconstructedPayload: AttestationCanonicalPayload = {
      subject: {
        subjectId: attestation.subjectId,
        subjectType: attestation.subjectType,
        revision: attestation.revision,
        artifactHash: attestation.artifactHash
      },
      inputs: {
        inputHash: attestation.inputHash,
        solverInputs: currentState?.currentExecutionContext?.inputs || {}
      },
      execution: {
        executionId: attestation.executionId,
        engineeringIdentity: attestation.engineeringIdentity,
        timestamp: attestation.createdAt,
        environmentHash: 'ENV_STANDARD_000'
      },
      solver: {
        solverIdentity: attestation.solverIdentity,
        solverVersion: attestation.solverVersion
      },
      output: {
        outputHash: attestation.outputHash
      },
      verification: {
        verificationHash: attestation.verificationHash,
        gateVerdict: attestation.gateVerdict
      },
      evidence: {
        evidenceId: attestation.evidenceId,
        evidenceHash: attestation.evidenceHash
      },
      policy: {
        policyId: attestation.policyId,
        policyHash: attestation.policyHash
      }
    };

    // If canonicalPayloadString is recorded, check exact hash match
    const canonicalPayloadString =
      attestation.canonicalPayloadString ||
      AttestationCanonicalizer.buildCanonicalPayload(reconstructedPayload);

    const calculatedPayloadHash = AttestationCanonicalizer.sha256(canonicalPayloadString);
    const canonicalPayloadMatch = calculatedPayloadHash === attestation.canonicalPayloadHash;

    if (!canonicalPayloadMatch) {
      details.push(
        `Payload integrity failure: expected ${attestation.canonicalPayloadHash.substring(0, 16)}..., computed ${calculatedPayloadHash.substring(0, 16)}...`
      );
    }

    // 2. Subject Verification
    let subjectVerified = true;
    let calculatedArtifactHash: string | undefined;
    if (currentState?.currentSubject) {
      const curSub = currentState.currentSubject;
      if (curSub.subjectId !== attestation.subjectId) {
        subjectVerified = false;
        details.push(`Subject ID mismatch: '${curSub.subjectId}' vs '${attestation.subjectId}'`);
      }
      if (curSub.revision !== attestation.revision) {
        subjectVerified = false;
        details.push(`Subject revision mismatch: '${curSub.revision}' vs '${attestation.revision}'`);
      }

      if (curSub.artifactData) {
        calculatedArtifactHash = AttestationCanonicalizer.hashObject(curSub.artifactData);
        if (calculatedArtifactHash !== attestation.artifactHash) {
          subjectVerified = false;
          details.push(`Subject artifact data tampered or altered.`);
        }
      } else if (curSub.artifactHash && curSub.artifactHash !== attestation.artifactHash) {
        subjectVerified = false;
        details.push(`Subject artifact hash altered.`);
      }
    }

    // 3. Evidence Verification
    let evidenceVerified = true;
    let calculatedEvidenceHash: string | undefined;
    if (currentState?.currentEvidence) {
      const curEv = currentState.currentEvidence;
      if (curEv.evidenceId !== attestation.evidenceId) {
        evidenceVerified = false;
        details.push(`Evidence ID mismatch: '${curEv.evidenceId}' vs '${attestation.evidenceId}'`);
      }

      if (curEv.payload && Object.keys(curEv.payload).length > 0) {
        calculatedEvidenceHash = AttestationCanonicalizer.hashObject(curEv.payload);
      } else {
        calculatedEvidenceHash = curEv.resultHash;
      }

      if (
        (curEv.resultHash && curEv.resultHash !== attestation.evidenceHash) ||
        (curEv.payloadHash && curEv.payloadHash !== attestation.evidenceHash)
      ) {
        evidenceVerified = false;
        details.push(`Supporting physics evidence payload or resultHash tampered.`);
      }
    }

    // 4. Execution Context Verification
    let executionVerified = true;
    let calculatedInputHash: string | undefined;
    let calculatedOutputHash: string | undefined;
    if (currentState?.currentExecutionContext) {
      const curExec = currentState.currentExecutionContext;
      if (curExec.executionId !== attestation.executionId) {
        executionVerified = false;
        details.push(`Execution ID mismatch: '${curExec.executionId}' vs '${attestation.executionId}'`);
      }
      if (curExec.engineeringIdentity !== attestation.engineeringIdentity) {
        executionVerified = false;
        details.push(`Engineering identity impersonation: '${curExec.engineeringIdentity}' vs '${attestation.engineeringIdentity}'`);
      }
      if (curExec.solverIdentity !== attestation.solverIdentity) {
        executionVerified = false;
        details.push(`Solver identity mismatch: '${curExec.solverIdentity}' vs '${attestation.solverIdentity}'`);
      }
      if (curExec.solverVersion !== attestation.solverVersion) {
        executionVerified = false;
        details.push(`Solver version uncertified or altered: '${curExec.solverVersion}' vs '${attestation.solverVersion}'`);
      }

      if (curExec.inputs) {
        calculatedInputHash = AttestationCanonicalizer.hashObject(curExec.inputs);
        if (calculatedInputHash !== attestation.inputHash) {
          executionVerified = false;
          details.push(`Execution solver inputs boundary conditions swapped or modified.`);
        }
      }

      if (curExec.outputs) {
        calculatedOutputHash = AttestationCanonicalizer.hashObject(curExec.outputs);
        if (calculatedOutputHash !== attestation.outputHash) {
          executionVerified = false;
          details.push(`Execution solver outputs altered.`);
        }
      }
    }

    // 5. Provenance Lineage Verification
    let provenanceVerified = true;
    let calculatedProvenanceHash: string | undefined;
    if (currentState?.currentProvenance) {
      calculatedProvenanceHash =
        currentState.currentProvenance.lineageHash ||
        AttestationCanonicalizer.hashObject(currentState.currentProvenance);

      if (calculatedProvenanceHash !== attestation.provenanceHash) {
        provenanceVerified = false;
        details.push(`Provenance lineage hash severed or altered.`);
      }
    }

    // 6. Governance Policy Verification
    let policyVerified = true;
    let calculatedPolicyHash: string | undefined;
    if (currentState?.currentPolicy) {
      calculatedPolicyHash =
        currentState.currentPolicy.policyHash ||
        AttestationCanonicalizer.hashObject(currentState.currentPolicy);

      if (currentState.currentPolicy.policyId !== attestation.policyId) {
        policyVerified = false;
        details.push(`Policy ID altered: '${currentState.currentPolicy.policyId}' vs '${attestation.policyId}'`);
      }
      if (calculatedPolicyHash !== attestation.policyHash) {
        policyVerified = false;
        details.push(`Governance policy baseline modified.`);
      }
    }

    // 7. Digital Signature Verification
    let signatureStatus: 'AVAILABLE' | 'UNAVAILABLE' | 'UNPROVEN' = 'UNAVAILABLE';
    let signatureVerified: boolean | 'UNPROVEN' | 'UNAVAILABLE' = 'UNAVAILABLE';

    if (!attestation.signature || attestation.signature === '') {
      signatureStatus = 'UNAVAILABLE';
      signatureVerified = 'UNPROVEN';
      details.push('Attestation is unsigned; signature authenticity is UNPROVEN.');
    } else {
      signatureStatus = 'AVAILABLE';
      const sigResult = AttestationSigner.verifySignature(
        canonicalPayloadString,
        attestation.signature,
        attestation.signingKeyId,
        attestation.algorithm,
        currentState?.trustedPublicKeys
      );

      if (sigResult === true) {
        signatureVerified = true;
      } else if (sigResult === false) {
        signatureVerified = false;
        details.push('Cryptographic signature verification failed: signature is forged or invalid.');
      } else {
        signatureVerified = sigResult; // 'UNAVAILABLE' or 'UNPROVEN'
        details.push(`Cryptographic signature verification status: ${sigResult}`);
      }
    }

    // 8. Synthesize Overall Verdict
    let verdict: AttestationVerdict = 'VALID';
    let status: AttestationStatus = 'ATTESTED';

    if (!subjectVerified) {
      verdict = 'SUBJECT_MODIFIED';
      status = 'INVALID';
    } else if (!evidenceVerified) {
      verdict = 'EVIDENCE_MODIFIED';
      status = 'INVALID';
    } else if (!policyVerified) {
      verdict = 'POLICY_MISMATCH';
      status = 'INVALID';
    } else if (!provenanceVerified) {
      verdict = 'PROVENANCE_MISMATCH';
      status = 'INVALID';
    } else if (signatureVerified === false) {
      verdict = 'SIGNATURE_INVALID';
      status = 'INVALID';
    } else if (!executionVerified || !canonicalPayloadMatch) {
      verdict = 'INVALID';
      status = 'INVALID';
    } else {
      verdict = 'VALID';
      status = 'ATTESTED';
    }

    const integrityVerified = canonicalPayloadMatch && subjectVerified;

    return {
      attestationId: attestation.attestationId,
      verdict,
      status,
      integrityVerified,
      subjectVerified,
      evidenceVerified,
      provenanceVerified,
      executionVerified,
      policyVerified,
      signatureStatus,
      signatureVerified,
      canonicalPayloadMatch,
      recomputedHashes: {
        calculatedPayloadHash,
        expectedPayloadHash: attestation.canonicalPayloadHash,
        calculatedArtifactHash,
        calculatedEvidenceHash,
        calculatedInputHash,
        calculatedOutputHash,
        calculatedProvenanceHash,
        calculatedPolicyHash
      },
      details,
      verifiedAt
    };
  }
}
