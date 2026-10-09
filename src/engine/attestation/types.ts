/**
 * SECP Industrial OS v2 — Forensic Engineering Network
 * PATCH-162: Cryptographic Attestation Types & Definitions
 */

export type AttestationStatus =
  | 'ATTESTED'
  | 'UNPROVEN'
  | 'REVOKED'
  | 'INVALID'
  | 'SUPERSEDED';

export type AttestationVerdict =
  | 'VALID'
  | 'INVALID'
  | 'UNPROVEN'
  | 'MISSING_EVIDENCE'
  | 'SUBJECT_MODIFIED'
  | 'EVIDENCE_MODIFIED'
  | 'PROVENANCE_MISMATCH'
  | 'POLICY_MISMATCH'
  | 'SIGNATURE_INVALID'
  | 'SIGNATURE_UNAVAILABLE'
  | 'INCOMPLETE';

export type SubjectType =
  | 'CAD_MODEL'
  | 'BREP_SOLID'
  | 'MESH'
  | 'FEM_RESULT'
  | 'CFD_RESULT'
  | 'THERMAL_RESULT'
  | 'CAM_TOOLPATH'
  | 'GCODE'
  | 'MATERIAL_SPEC'
  | 'ASSEMBLY'
  | 'ECO'
  | 'INSPECTION_RECORD'
  | 'EVIDENCE_RECORD'
  | 'LEDGER_ENTRY'
  | 'CERTIFICATE'
  | string;

export type SigningBackendStatus =
  | 'AVAILABLE'
  | 'UNAVAILABLE'
  | 'UNPROVEN';

export interface SubjectReference {
  readonly subjectId: string;
  readonly subjectType: SubjectType;
  readonly revision: string;
  readonly artifactData?: unknown;
  readonly artifactHash?: string;
}

export interface ExecutionContextReference {
  readonly executionId: string;
  readonly solverIdentity: string;
  readonly solverVersion: string;
  readonly engineeringIdentity: string;
  readonly inputs: Record<string, any>;
  readonly outputs: Record<string, any>;
  readonly inputHash?: string;
  readonly outputHash?: string;
  readonly executionTimestamp?: string;
  readonly computeEnvironment?: {
    readonly nodeType?: string;
    readonly os?: string;
    readonly hardwareProfile?: string;
  };
}

export interface EvidenceReference {
  readonly evidenceId: string;
  readonly evidenceType: string;
  readonly payload: Record<string, any>;
  readonly resultHash: string;
  readonly payloadHash?: string;
  readonly ledgerEntryHash?: string;
}

export interface ProvenanceReference {
  readonly rootId: string;
  readonly parentIds: readonly string[];
  readonly dependencyIds: readonly string[];
  readonly lineageHash: string;
  readonly graphSnapshot?: Record<string, any>;
}

export interface VerificationReference {
  readonly gateId: string;
  readonly verdict: string;
  readonly checksPerformed: readonly string[];
  readonly verificationHash: string;
  readonly verifiedAt: string;
}

export interface PolicyReference {
  readonly policyId: string;
  readonly policyVersion: string;
  readonly rulesEvaluated: readonly string[];
  readonly policyHash: string;
  readonly governanceSignoff?: string;
}

export interface AttestationCanonicalPayload {
  readonly subject: {
    readonly subjectId: string;
    readonly subjectType: string;
    readonly revision: string;
    readonly artifactHash: string;
  };
  readonly inputs: {
    readonly inputHash: string;
    readonly solverInputs: Record<string, any>;
  };
  readonly execution: {
    readonly executionId: string;
    readonly engineeringIdentity: string;
    readonly timestamp: string;
    readonly environmentHash?: string;
  };
  readonly solver: {
    readonly solverIdentity: string;
    readonly solverVersion: string;
  };
  readonly output: {
    readonly outputHash: string;
  };
  readonly verification: {
    readonly verificationHash: string;
    readonly gateVerdict: string;
  };
  readonly evidence: {
    readonly evidenceHash: string;
    readonly evidenceId: string;
  };
  readonly policy: {
    readonly policyHash: string;
    readonly policyId: string;
  };
}

export interface CryptographicAttestation {
  readonly attestationId: string;
  readonly subjectId: string;
  readonly subjectType: SubjectType;
  readonly artifactHash: string;
  readonly evidenceHash: string;
  readonly provenanceHash: string;
  readonly executionId: string;
  readonly engineeringIdentity: string;
  readonly solverIdentity: string;
  readonly solverVersion: string;
  readonly inputHash: string;
  readonly outputHash: string;
  readonly verificationHash: string;
  readonly gateVerdict: string;
  readonly policyHash: string;
  readonly policyId: string;
  readonly revision: string;
  readonly evidenceId: string;
  readonly createdAt: string;
  readonly attestationVersion: string;
  readonly algorithm: string;
  readonly canonicalPayloadHash: string;
  readonly canonicalPayloadString?: string;
  readonly signature?: string;
  readonly signingKeyId?: string;
  readonly status: AttestationStatus;
}

export interface CreateAttestationParams {
  readonly subject: SubjectReference;
  readonly evidence: EvidenceReference;
  readonly executionContext: ExecutionContextReference;
  readonly provenance?: ProvenanceReference;
  readonly verification?: VerificationReference;
  readonly policy?: PolicyReference;
  readonly attestationVersion?: string;
  readonly algorithm?: string;
  readonly keyPair?: SigningKeyPair;
}

export interface SigningKeyPair {
  readonly keyId: string;
  readonly algorithm: 'HMAC-SHA256' | 'ECDSA-P256-SHA256' | 'ED25519';
  readonly publicKey: string;
  readonly privateKey: string;
}

export interface SignatureResult {
  readonly signature: string;
  readonly signingKeyId: string;
  readonly algorithm: string;
  readonly status: SigningBackendStatus;
}

export interface AttestationVerificationCurrentState {
  readonly currentSubject?: SubjectReference;
  readonly currentEvidence?: EvidenceReference;
  readonly currentExecutionContext?: ExecutionContextReference;
  readonly currentProvenance?: ProvenanceReference;
  readonly currentPolicy?: PolicyReference;
  readonly trustedPublicKeys?: Record<string, string>;
}

export interface AttestationVerificationResult {
  readonly attestationId: string;
  readonly verdict: AttestationVerdict;
  readonly status: AttestationStatus;
  readonly integrityVerified: boolean;
  readonly subjectVerified: boolean;
  readonly evidenceVerified: boolean;
  readonly provenanceVerified: boolean;
  readonly executionVerified: boolean;
  readonly policyVerified: boolean;
  readonly signatureStatus: SigningBackendStatus;
  readonly signatureVerified: boolean | 'UNPROVEN' | 'UNAVAILABLE';
  readonly canonicalPayloadMatch: boolean;
  readonly recomputedHashes: {
    readonly calculatedPayloadHash: string;
    readonly expectedPayloadHash: string;
    readonly calculatedArtifactHash?: string;
    readonly calculatedEvidenceHash?: string;
    readonly calculatedInputHash?: string;
    readonly calculatedOutputHash?: string;
    readonly calculatedProvenanceHash?: string;
    readonly calculatedPolicyHash?: string;
  };
  readonly details: readonly string[];
  readonly verifiedAt: string;
}
