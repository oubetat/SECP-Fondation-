/**
 * SECP Industrial OS v2 — CAD Fidelity Certification Framework
 * PATCH-041: formal CAD Fidelity Certification
 */

import { DifferenceCategory, ExternalKernelIdentity, ExternalKernelStatus } from '../cross-kernel/CrossKernelTypes';

export type CertificationStatus = 'PROVEN' | 'PARTIAL' | 'UNPROVEN' | 'FAILED' | 'NOT_APPLICABLE' | 'CONDITIONAL';

export enum CertificationLevel {
  LEVEL_0_UNASSESSED = 0,
  LEVEL_1_STRUCTURAL = 1,
  LEVEL_2_GEOMETRIC = 2,
  LEVEL_3_TOPOLOGICAL = 3,
  LEVEL_4_ENGINEERING = 4,
  LEVEL_5_CROSS_KERNEL = 5,
  LEVEL_6_FORENSIC = 6
}

export type CertificationVerdict = 'CERTIFIED' | 'CONDITIONALLY_CERTIFIED' | 'PARTIALLY_CERTIFIED' | 'UNPROVEN' | 'FAILED' | 'INVALID';

export interface CapabilityAssessment {
  capability: DifferenceCategory;
  status: CertificationStatus;
  evidenceReference: string;
  limitations: string[];
}

export interface FormatCapabilityMatrix {
  format: string;
  capabilities: CapabilityAssessment[];
}

export interface CADFidelityCertification {
  certificationId: string;
  certificationVersion: string;
  schemaVersion: string;

  secpVersion: string;
  kernelVersion: string;
  formatVersions: Record<string, string>;

  issuedAt: string;
  validUntil: string;

  scope: {
    formats: string[];
    operations: ('IMPORT' | 'EXPORT' | 'ROUND_TRIP')[];
    engineeringDomains: DifferenceCategory[];
  };

  capabilities: CapabilityAssessment[];
  formatMatrix: FormatCapabilityMatrix[];
  
  testCorpus: {
    corpusVersion: string;
    cases: {
      caseId: string;
      caseVersion: string;
      sourceHash: string;
      evidenceReference: string;
      verdict: CertificationStatus;
    }[];
  };

  externalKernelMatrix: {
    identity: ExternalKernelIdentity;
    status: ExternalKernelStatus;
    capabilities: CapabilityAssessment[];
  }[];

  adversarialResults: {
    category: string;
    status: 'PASSED' | 'FAILED' | 'UNPROVEN';
    evidenceReference: string;
  }[];

  tamperResults: {
    test: string;
    detected: boolean;
    evidenceReference: string;
  }[];

  overallVerdict: CertificationVerdict;
  overallLevel: CertificationLevel;

  signature: {
    signedAt: string;
    signingIdentity: string;
    signatureAlgorithm: string;
    signatureValue: string;
  };

  canonicalHash: string;
  evidenceHash: string;
}

export interface CertificationVerificationResult {
  isValid: boolean;
  verdict: CertificationVerdict;
  level: CertificationLevel;
  reason: string;
  integrityVerified: boolean;
  claimsVerified: boolean;
  missingEvidence: string[];
  mismatchedHashes: string[];
  failedCapabilities: DifferenceCategory[];
}
