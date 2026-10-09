/**
 * SECP Industrial OS — EPC-010: Evidence Integrity Types
 */

export enum IntegrityStatus {
  VALID = 'VALID',
  TAMPERED = 'TAMPERED',
  MISSING = 'MISSING',
  UNVERIFIABLE = 'UNVERIFIABLE'
}

export interface EvidenceIntegrityRecord {
  evidenceId: string;
  evidenceRevision: string;
  hashAlgorithm: string; // e.g. SHA-256
  contentHash: string;
  canonicalizationVersion: string;
  createdAt: string;
  createdBy: string;
  sourceReference: string;
  hashScope: string[]; // List of fields included in hash
}

export interface IntegrityVerificationResult {
  status: IntegrityStatus;
  recalculatedHash?: string;
  storedHash?: string;
  details?: string;
}
