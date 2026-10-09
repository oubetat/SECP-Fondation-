/**
 * SECP Industrial OS v2 — Forensic Engineering Network
 * PATCH-163: Result Certification Types & Definitions
 */

import { CryptographicAttestation, SubjectType } from '../attestation/types';

export type CertificationStatus =
  | 'CERTIFIED'
  | 'NOT_CERTIFIED'
  | 'UNPROVEN'
  | 'INVALID'
  | 'INCOMPLETE'
  | 'REVOKED'
  | 'EXPIRED';

export interface NumericalQualification {
  readonly residuals?: Record<string, number>;
  readonly convergence?: {
    readonly isConverged: boolean;
    readonly iterations: number;
    readonly residualTolerance: number;
  };
  readonly conservation?: {
    readonly massError?: number;
    readonly energyError?: number;
    readonly momentumError?: number;
    readonly isConserved: boolean;
  };
  readonly stability?: {
    readonly isStable: boolean;
    readonly courantNumber?: number;
  };
  readonly boundaryConditionValidity?: boolean;
  readonly solverConfiguration?: Record<string, any>;
  readonly meshIdentity?: string;
  readonly materialIdentity?: string;
  readonly units?: string;
  readonly numericalTolerances?: Record<string, number>;
  readonly validationReferences?: readonly string[];
}

export interface ResultObject {
  readonly resultId: string;
  readonly subjectId: string;
  readonly resultType: SubjectType;
  readonly valuePayload: Record<string, any>;
  readonly numericalQualification?: NumericalQualification;
  readonly executionId: string;
  readonly solverIdentity: string;
  readonly solverVersion: string;
  readonly inputHash: string;
}

export interface VerificationEvidence {
  readonly verificationId: string;
  readonly resultId: string;
  readonly isVerified: boolean;
  readonly verificationChecks: readonly string[];
  readonly evidenceId: string;
  readonly evidencePayload: Record<string, any>;
  readonly evidenceHash: string;
  readonly verifiedAt: string;
}

export interface ResultCertificationPolicy {
  readonly policyId: string;
  readonly policyVersion: string;
  readonly requiredEvidence: readonly string[];
  readonly requiredVerifications: readonly string[];
  readonly requiredTolerances?: Record<string, number>;
  readonly requiredSolverVersion?: string; // semantic version constraint, e.g. ">=2.0.0" or exactly "2.4.1"
  readonly requiredProvenance?: boolean;
  readonly requiredAttestation?: boolean;
  readonly requiredValidation?: readonly string[];
  readonly requiredResidualsMax?: Record<string, number>;
  readonly requireConvergence?: boolean;
  readonly requireConservation?: boolean;
  readonly requireStability?: boolean;
  readonly expirationPolicy?: {
    readonly durationDays: number;
  };
  readonly revocationPolicy?: string;
}

export interface EngineeringResultCertificate {
  readonly certificateId: string;
  readonly resultId: string;
  readonly subjectId: string;
  readonly engineeringIdentity: string;
  readonly resultType: SubjectType;
  readonly resultHash: string;
  readonly inputHash: string;
  readonly solverIdentity: string;
  readonly solverVersion: string;
  readonly executionId: string;
  readonly verificationId: string;
  readonly evidenceId: string;
  readonly evidenceHash: string;
  readonly attestationId: string;
  readonly policyId: string;
  readonly criteria: readonly string[];
  readonly verificationStatus: boolean;
  readonly certificationStatus: CertificationStatus;
  readonly issuedAt: string;
  readonly certificateVersion: string;
  readonly issuer: string;
  readonly signature: string;
  readonly signingKeyId: string;
  readonly canonicalPayloadHash: string;
  
  // Revocation fields
  readonly revocationReason?: string;
  readonly revokedAt?: string;
  readonly revokedBy?: string;
  readonly revokedEvidenceId?: string;

  // Metadata/Numerical fields
  readonly numericalQualification?: NumericalQualification;
  readonly expirationDate?: string;
}

export interface ResultCertificateDocument {
  readonly certificateMetadata: {
    readonly certificateId: string;
    readonly certificateVersion: string;
    readonly issuedAt: string;
    readonly issuer: string;
    readonly status: CertificationStatus;
    readonly expiresAt?: string;
  };
  readonly resultIdentity: {
    readonly resultId: string;
    readonly subjectId: string;
    readonly resultType: string;
  };
  readonly hashes: {
    readonly resultHash: string;
    readonly inputHash: string;
    readonly evidenceHash: string;
    readonly attestationHash: string;
    readonly canonicalPayloadHash: string;
  };
  readonly executionInformation: {
    readonly executionId: string;
    readonly engineeringIdentity: string;
  };
  readonly solverInformation: {
    readonly solverIdentity: string;
    readonly solverVersion: string;
  };
  readonly verificationEvidence: {
    readonly verificationId: string;
    readonly evidenceId: string;
    readonly verificationStatus: boolean;
    readonly checks: readonly string[];
  };
  readonly certificationCriteria: readonly string[];
  readonly attestation: {
    readonly attestationId: string;
    readonly signatureStatus: string;
    readonly signingKeyId: string;
  };
  readonly signatureStatus: {
    readonly status: 'AUTHENTIC' | 'UNPROVEN' | 'UNAVAILABLE' | 'REVOKED';
    readonly signature: string;
    readonly signingKeyId: string;
  };
  readonly verdict: CertificationStatus;
  readonly auditReferences: {
    readonly policyId: string;
    readonly policyVersion: string;
  };
}

export interface CertificationVerificationCurrentState {
  readonly currentResult?: ResultObject;
  readonly currentVerification?: VerificationEvidence;
  readonly currentAttestation?: CryptographicAttestation;
  readonly currentPolicy?: ResultCertificationPolicy;
  readonly trustedPublicKeys?: Record<string, string>;
  readonly skipSignatureVerification?: boolean;
}

export interface CertificateVerificationResult {
  readonly certificateId: string;
  readonly verdict: CertificationStatus;
  readonly integrityVerified: boolean;
  readonly resultVerified: boolean;
  readonly inputVerified: boolean;
  readonly evidenceVerified: boolean;
  readonly attestationVerified: boolean;
  readonly solverVerified: boolean;
  readonly executionVerified: boolean;
  readonly policyVerified: boolean;
  readonly criteriaVerified: boolean;
  readonly signatureVerified: boolean | 'UNPROVEN';
  readonly signatureStatus: 'AUTHENTIC' | 'UNPROVEN' | 'UNAVAILABLE' | 'REVOKED';
  readonly recalculatedHashes: {
    readonly expectedResultHash: string;
    readonly calculatedResultHash: string;
    readonly expectedInputHash: string;
    readonly calculatedInputHash: string;
    readonly expectedEvidenceHash: string;
    readonly calculatedEvidenceHash: string;
    readonly expectedCanonicalPayloadHash: string;
    readonly calculatedCanonicalPayloadHash: string;
  };
  readonly details: readonly string[];
  readonly verifiedAt: string;
}
