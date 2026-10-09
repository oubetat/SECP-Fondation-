/**
 * SECP Industrial OS v2 — Forensic Engineering Network
 * PATCH-168: Independent Verification Portal Types
 */

import { EngineeringEvidenceRecord, EvidenceLedgerEntry } from '../../evidence/ledger/types';
import { CryptographicAttestation } from '../../attestation/types';
import { EngineeringResultCertificate, ResultCertificateDocument } from '../../certification/types';
import { CustodyRecord } from '../../custody/types';
import { ProvenanceNode, ProvenanceEdge } from '../../provenance/ProvenanceGraphTypes';

export enum VerificationStatus {
  VERIFIED = "VERIFIED",
  FAILED = "FAILED",
  UNPROVEN = "UNPROVEN",
  INCOMPLETE = "INCOMPLETE",
  INVALID = "INVALID",
  TAMPERED = "TAMPERED",
  SIGNATURE_INVALID = "SIGNATURE_INVALID",
  PROVENANCE_BROKEN = "PROVENANCE_BROKEN",
  CHAIN_OF_CUSTODY_BROKEN = "CHAIN_OF_CUSTODY_BROKEN",
  DEPENDENCY_MISMATCH = "DEPENDENCY_MISMATCH",
  SCHEMA_INVALID = "SCHEMA_INVALID",
  INTEGRITY_FAILURE = "INTEGRITY_FAILURE"
}

export interface VerificationFinding {
  readonly code: string;
  readonly message: string;
  readonly severity: 'CRITICAL' | 'WARNING' | 'INFO';
  readonly targetId?: string;
  readonly details?: any;
}

export interface EvidencePackage {
  readonly packageId: string;
  readonly certificate?: ResultCertificateDocument | EngineeringResultCertificate;
  readonly attestations: readonly CryptographicAttestation[];
  readonly evidenceRecords: readonly EngineeringEvidenceRecord[];
  readonly ledgerEntries: readonly EvidenceLedgerEntry[];
  readonly custodyRecords: readonly CustodyRecord[];
  readonly provenanceNodes: readonly ProvenanceNode[];
  readonly provenanceEdges: readonly ProvenanceEdge[];
  readonly artifactIdentities: readonly string[];
  readonly metadata: Record<string, any>;
  readonly manifest: {
    readonly rootArtifactId: string;
    readonly totalEvidenceItems: number;
    readonly timestamp: string;
    readonly sourceSystem: string;
  };
}

export interface IndependentVerificationResult {
  readonly verificationId: string;
  readonly packageId: string;
  readonly overallStatus: VerificationStatus;
  readonly verifiedArtifacts: readonly string[];
  readonly findings: readonly VerificationFinding[];
  readonly cryptographicChecks: {
    readonly hashesMatch: boolean;
    readonly signaturesValid: boolean;
    readonly attestationsVerified: boolean;
  };
  readonly provenanceChecks: {
    readonly lineageIntact: boolean;
    readonly dependenciesResolved: boolean;
  };
  readonly chainOfCustodyChecks: {
    readonly chainIntact: boolean;
    readonly transitionsValid: boolean;
  };
  readonly certificateChecks: {
    readonly certificateAuthentic: boolean;
    readonly criteriaMet: boolean;
  };
  readonly timestamp: string;
  readonly verifierVersion: string;
  readonly reportHash: string;
}

export interface IndependentVerificationRequest {
  readonly package: EvidencePackage;
  readonly options?: {
    readonly skipSignatureVerification?: boolean;
    readonly enforceFullProvenance?: boolean;
    readonly trustedPublicKeys?: Record<string, string>;
  };
}
