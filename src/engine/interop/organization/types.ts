/**
 * SECP Industrial OS v2 — Cross-Organization Interoperability
 * PATCH-169: Cross-Organization Evidence Types
 */

import { EvidencePackage, VerificationStatus, VerificationFinding } from '../../verification/portal/types';

export enum OrganizationType {
  ENGINEERING_COMPANY = "ENGINEERING_COMPANY",
  MANUFACTURER = "MANUFACTURER",
  SUPPLIER = "SUPPLIER",
  CUSTOMER = "CUSTOMER",
  INSPECTION_BODY = "INSPECTION_BODY",
  CERTIFICATION_BODY = "CERTIFICATION_BODY",
  REGULATOR = "REGULATOR",
  RESEARCH_INSTITUTION = "RESEARCH_INSTITUTION",
  INDEPENDENT_VERIFIER = "INDEPENDENT_VERIFIER"
}

export enum EvidenceRole {
  CREATOR = "CREATOR",
  OWNER = "OWNER",
  CUSTODIAN = "CUSTODIAN",
  VERIFIER = "VERIFIER",
  CERTIFIER = "CERTIFIER"
}

export interface OrganizationIdentity {
  readonly organizationId: string;
  readonly organizationName: string;
  readonly organizationType: OrganizationType;
  readonly identityVersion: string;
  readonly publicKeyReferences: readonly string[];
  readonly attestationReferences: readonly string[];
  readonly status: 'ACTIVE' | 'SUSPENDED' | 'REVOKED';
  readonly createdAt: string;
}

export interface EvidenceTransferStatus {
  readonly state: 'PREPARED' | 'SIGNED' | 'TRANSFERRED' | 'RECEIVED' | 'VERIFIED' | 'REJECTED' | 'REVOKED';
  readonly timestamp: string;
  readonly actor: string;
  readonly organizationId: string;
  readonly message?: string;
}

export interface EvidenceTransfer {
  readonly transferId: string;
  readonly sourceOrganization: string;
  readonly destinationOrganization: string;
  readonly artifactId: string;
  readonly sourceHash: string;
  readonly packageHash: string;
  readonly transferTimestamp: string;
  readonly transferReason: string;
  readonly transferPolicy: string;
  readonly senderAttestation: string;
  readonly receiverAcknowledgement?: string;
  readonly status: EvidenceTransferStatus;
  readonly history: readonly EvidenceTransferStatus[];
}

export interface CrossOrganizationEvidencePackage extends EvidencePackage {
  readonly schemaVersion: string;
  readonly sourceOrganization: string;
  readonly destinationOrganization: string;
  readonly packageHash: string;
  readonly packageSignature: string;
  readonly senderIdentityAssertion: OrganizationIdentity;
  readonly transferMetadata: {
    readonly transferId: string;
    readonly policyId: string;
    readonly reason: string;
  };
}

export interface CrossOrganizationVerificationReport {
  readonly reportId: string;
  readonly transferId: string;
  readonly overallStatus: VerificationStatus;
  readonly findings: readonly VerificationFinding[];
  readonly organizationIdentityVerified: boolean;
  readonly packageIntegrityVerified: boolean;
  readonly senderSignatureVerified: boolean;
  readonly artifactIntegrityVerified: boolean;
  readonly independentVerificationStatus: VerificationStatus;
  readonly timestamp: string;
  readonly verifierVersion: string;
}
