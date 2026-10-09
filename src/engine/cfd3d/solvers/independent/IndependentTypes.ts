/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-072: Independent CFD Verifier Types & Interfaces
 */

export interface CFDCaseManifest {
  readonly caseId: string;
  readonly caseVersion: string;
  readonly geometryHash: string;
  readonly meshHash: string;
  readonly physicsHash: string;
  readonly materialHash: string;
  readonly bcHash: string;
  readonly icHash: string;
  readonly solverConfigHash: string;
  readonly numericalSchemeHash: string;
  readonly convergencePolicyHash: string;
  readonly resultHash: string;
  readonly residualHistoryHash: string;
  readonly conservationReportHash: string;
  readonly meshStudyHash: string;
  readonly timestepStudyHash: string;
  readonly provenanceHash: string;
  readonly evidenceHash: string;
  readonly timestamp: string;
  readonly softwareVersion: string;
}

export interface IndependentCheckConfig {
  readonly absoluteTolerance: number;
  readonly relativeTolerance: number;
  readonly conservationThreshold: number;
}

export interface VerificationAuditRecord {
  readonly stepId: string;
  readonly calculationName: string;
  readonly primaryValue: number;
  readonly verifiedValue: number;
  readonly status: 'VERIFIED' | 'DISAGREEMENT';
}

export interface VerifierDisagreementRecord {
  readonly metric: string;
  readonly solverValue: number;
  readonly verifierValue: number;
  readonly difference: number;
  readonly tolerance: number;
  readonly likelyCause: string;
  readonly status: 'AGREE' | 'MINOR_DIFFERENCE' | 'MATERIAL_DIFFERENCE' | 'CRITICAL_DIFFERENCE';
}

export interface IndependentVerifierVerdict {
  readonly verifierId: string;
  readonly passed: boolean;
  readonly auditRecords: readonly VerificationAuditRecord[];
  readonly status: 'VERIFIED' | 'VERIFIER_DISAGREEMENT';
}
