/**
 * SECP Industrial OS v3 — PATCH-186: Engineering Certification Engine Types
 * Defines the formal structure for claim-based, evidence-bound engineering certificates.
 */

import { EngineeringDomain, EvidencePackage } from '../reproducibility/ReproducibilityTypes';
import { ExternalValidationManifest } from '../validation/ValidationTypes';

export enum CertificationLevel {
  LEVEL_0_UNVERIFIED = 0,
  LEVEL_1_VERIFIED = 1,
  LEVEL_2_VALIDATED = 2,
  LEVEL_3_REPRODUCIBLE = 3,
  LEVEL_4_EXTERNALLY_VALIDATED = 4,
  LEVEL_5_CERTIFIED = 5
}

export type CertificateStatus = 
  | 'DRAFT' 
  | 'UNDER_REVIEW' 
  | 'VERIFIED' 
  | 'VALIDATED' 
  | 'CERTIFIED' 
  | 'ACTIVE' 
  | 'EXPIRED' 
  | 'REVOKED' 
  | 'SUPERSEDED' 
  | 'INVALIDATED';

export type CertificationDomain = 
  | 'GEOMETRY' 
  | 'MESH' 
  | 'PHYSICS' 
  | 'SOLVER' 
  | 'RESULT' 
  | 'REPRODUCIBILITY' 
  | 'INTEROPERABILITY' 
  | 'MANUFACTURABILITY' 
  | 'EXTERNAL_VALIDATION'
  | 'ENGINEERING_FULL';

export interface CertificationClaim {
  claimId: string;
  domain: CertificationDomain;
  description: string;
  requirementId: string;
  status: 'PENDING' | 'PROVEN' | 'REFUTED' | 'INCONCLUSIVE';
  evidenceIds: string[];
  testIds: string[];
  validatorVersion: string;
  timestamp: string;
  hash: string;
}

export interface CertificationScope {
  modelId: string;
  revision: string;
  solverVersion: string;
  meshId: string;
  materialId: string;
  operatingConditions: string;
  limitations: string[];
  assumptions: string[];
  validRange: {
    min: Record<string, number>;
    max: Record<string, number>;
  };
}

export interface EngineeringCertificate {
  certificateId: string;
  version: string;
  artifactId: string;
  artifactHash: string;
  level: CertificationLevel;
  domain: CertificationDomain;
  status: CertificateStatus;
  issuer: string;
  issuedAt: string;
  expiresAt?: string;
  scope: CertificationScope;
  claims: CertificationClaim[];
  evidenceSummary: {
    count: number;
    rootHash: string;
    hashes: Record<string, string>;
  };
  validationManifest?: ExternalValidationManifest;
  confidenceScore: number; // 0.0 - 1.0
  rootHash: string;
  signature: string;
}

export interface CertificationRequirement {
  id: string;
  description: string;
  mandatory: boolean;
  domain: CertificationDomain;
  minLevel: CertificationLevel;
}

export interface RequirementMatrix {
  matrixId: string;
  domain: CertificationDomain;
  targetLevel: CertificationLevel;
  requirements: CertificationRequirement[];
}

export interface RevocationNotice {
  certificateId: string;
  revokedAt: string;
  reason: string;
  evidenceOfFailure?: string;
  automated: boolean;
}

export interface CertificateComparison {
  sourceId: string;
  targetId: string;
  deltaLevel: number;
  changes: {
    domain: string;
    type: 'ADDED' | 'REMOVED' | 'MODIFIED';
    description: string;
  }[];
  isBackwardCompatible: boolean;
}
