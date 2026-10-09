/**
 * SECP Industrial OS v2 — Forensic Engineering Network
 * PATCH-166: Design Certificate Types & Definitions
 */

import { EngineeringIdentity } from '../identity/CanonicalEngineeringIdentity';

export type DesignCertificateStatus =
  | 'DRAFT'
  | 'UNDER_REVIEW'
  | 'VERIFIED'
  | 'CERTIFIED'
  | 'FAILED'
  | 'INVALID'
  | 'REVOKED'
  | 'EXPIRED';

export type ClaimVerificationStatus =
  | 'PROVEN'
  | 'VERIFIED'
  | 'PARTIAL'
  | 'UNPROVEN'
  | 'FAILED'
  | 'INVALID';

export interface VerificationClaimItem {
  readonly claim: string;
  readonly evidence: string;
  readonly verificationMethod: string;
  readonly result: string;
  readonly status: ClaimVerificationStatus;
}

export interface DesignCertificate {
  readonly certificateId: string;
  readonly designId: string;
  readonly engineeringIdentity: EngineeringIdentity;
  readonly designRevision: string;
  readonly canonicalDesignHash: string;
  readonly geometryHash: string;
  readonly materialReferences: readonly string[];
  readonly assemblyReferences: readonly string[];
  readonly constraintReferences: readonly string[];
  readonly simulationReferences: readonly string[];
  readonly manufacturingReferences: readonly string[];
  readonly provenanceRoot: string;
  readonly evidenceReferences: readonly string[];
  readonly verificationResults: readonly VerificationClaimItem[];
  readonly issuedAt: string;
  readonly issuer: string;
  readonly certificateVersion: string;
  readonly status: DesignCertificateStatus;
  readonly limitations: readonly string[];
  readonly fingerprint: string;
  readonly validationVerdict: ClaimVerificationStatus;
  
  // Revocation trace fields
  readonly revokedAt?: string;
  readonly revocationReason?: string;
  readonly revokedBy?: string;
}

export interface DesignCertificatePolicy {
  readonly policyId: string;
  readonly policyVersion: string;
  readonly requiredClaims: readonly string[];
  readonly requireCanonicalHash: boolean;
  readonly requireProvenanceRoot: boolean;
  readonly requireNoConflictingEvidence: boolean;
  readonly requireAttestations: boolean;
  readonly allowedSigners?: readonly string[];
}

export interface DesignCertificateVerificationReport {
  readonly certificateId: string;
  readonly fingerprintMatch: boolean;
  readonly tamperDetected: boolean;
  readonly hashValidationMatched: boolean;
  readonly chainOfCustodyVerified: boolean;
  readonly evidenceCompletenessVerdict: ClaimVerificationStatus;
  readonly details: readonly string[];
  readonly evaluatedStatus: DesignCertificateStatus;
}
