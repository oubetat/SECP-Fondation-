/**
 * SECP Industrial OS v2 — PROMPT-060: Evidence Integrity Proof
 * Architectural Types & Invariants for Deterministic, Traceable, Reproducible Evidence
 */

export type EvidenceIntegrityState =
  | 'REQUESTED'
  | 'GENERATING'
  | 'BOUND_TO_RESULT'
  | 'VALIDATED'
  | 'VERIFIED'
  | 'INTEGRITY_COMPUTED'
  | 'STORED'
  | 'RETRIEVABLE'
  | 'REPRODUCIBLE'
  | 'VALID'
  | 'FAILED'
  | 'INVALID'
  | 'UNSUPPORTED'
  | 'STALE'
  | 'CORRUPTED'
  | 'UNVERIFIED'
  | 'DIVERGED'
  | 'MISSING_SOURCE'
  | 'MISSING_RESULT'
  | 'INTEGRITY_FAILURE';

export type EvidenceDomainType =
  | 'CAD'
  | 'ASSEMBLY'
  | 'CFD'
  | 'FEA'
  | 'CAM'
  | 'REVERSE_ENGINEERING';

export interface TopologyReferenceSnapshot {
  readonly referenceId: string;
  readonly entityType: 'FACE' | 'EDGE' | 'VERTEX';
  readonly persistentTag: string;
  readonly geometricSignature: string;
  readonly semanticRole: string;
  readonly lineageAncestors: readonly string[];
}

export interface EngineeringResultRecord {
  readonly resultId: string;
  readonly domain: EvidenceDomainType;
  readonly executionId: string;
  readonly actionId: string;
  readonly documentId: string;
  readonly documentRevision: number;
  readonly featureOrOperationId: string;
  readonly outputMetrics: Readonly<Record<string, number | string | boolean>>;
  readonly topologyReferences?: readonly TopologyReferenceSnapshot[];
  readonly rawResultSummary: string;
  readonly producedByKernel: string;
  readonly kernelVersion: string;
  readonly isFabricated?: boolean;
}

export interface ValidationRecord {
  readonly validationId: string;
  readonly resultId: string;
  readonly passed: boolean;
  readonly checks: readonly {
    readonly checkName: string;
    readonly passed: boolean;
    readonly metric: string;
    readonly observedValue: number | string;
    readonly threshold: number | string;
  }[];
  readonly validatorVersion: string;
  readonly validatedAt: string;
}

export interface IndependentVerificationRecord {
  readonly verificationId: string;
  readonly resultId: string;
  readonly validationId: string;
  readonly verifierIdentity: string;
  readonly verifierVersion: string;
  readonly independentVerdict: 'PASS' | 'FAIL' | 'INCONCLUSIVE';
  readonly isSelfAttested: boolean; // Must be false!
  readonly verificationChecks: readonly string[];
  readonly verifiedAt: string;
}

export interface CanonicalEvidenceRecord {
  readonly evidenceId: string;
  readonly evidenceType: string;
  readonly domain: EvidenceDomainType;
  readonly documentId: string;
  readonly documentRevision: number;
  readonly actionId: string;
  readonly executionId: string;
  readonly capabilityId: string;
  readonly featureId: string;
  readonly sourceRevision: number;
  readonly resultRevision: number;
  
  // Explicit Non-Negotiable References
  readonly resultReference: {
    readonly resultId: string;
    readonly resultHash: string;
  };
  readonly validationReference: {
    readonly validationId: string;
    readonly validationPassed: boolean;
  };
  readonly verificationReference: {
    readonly verificationId: string;
    readonly verifierIdentity: string;
    readonly verdict: 'PASS' | 'FAIL' | 'INCONCLUSIVE';
  };
  
  readonly topologyReferences: readonly TopologyReferenceSnapshot[];
  readonly dependencyReferences: readonly string[];
  
  // Versions
  readonly generatorVersion: string;
  readonly evaluatorVersion: string;
  readonly kernelVersion: string;
  
  // Payload & Integrity
  readonly canonicalPayload: Readonly<Record<string, any>>;
  readonly integrityHash: string;
  
  // State & Provenance
  readonly state: EvidenceIntegrityState;
  readonly sourceOrigin: 'REAL_KERNEL' | 'UI_STATE' | 'PREVIEW' | 'NOTIFICATION' | 'HARDCODED';
  readonly isAiAssisted?: boolean;
  readonly aiConfidenceOnly?: boolean;
  readonly lineage: {
    readonly upstreamEvidenceIds: readonly string[];
    readonly stage: string;
  };
  readonly createdAt: string;
}

export interface EvidenceIntegrityCheckResult {
  readonly checkCode: string;
  readonly description: string;
  readonly passed: boolean;
  readonly details?: string;
}

export interface EvidenceIntegrityScore {
  readonly deterministic: number; // 0 or 100
  readonly traceable: number;
  readonly reproducible: number;
  readonly resultBound: number;
  readonly validationBound: number;
  readonly verificationBound: number;
  readonly revisionBound: number;
  readonly integrityVerified: number;
  readonly totalScore: number; // 0 to 100
  readonly verdict: 'PASS' | 'FAIL';
}

export interface GateResult {
  readonly gateId: string;
  readonly name: string;
  readonly passed: boolean;
  readonly failureReason?: string;
}

export interface EvidencePackageReport {
  readonly reportNumber: number;
  readonly reportTitle: string;
  readonly content: Readonly<Record<string, any>>;
  readonly status: 'PASS' | 'FAIL';
}

export interface FullEvidenceIntegrityPackage {
  readonly generatedAt: string;
  readonly overallVerdict: 'PASS' | 'FAIL';
  readonly evidenceIntegrityScore: EvidenceIntegrityScore;
  readonly gates: readonly GateResult[];
  readonly negativeProofs: readonly {
    readonly code: string;
    readonly name: string;
    readonly passed: boolean;
    readonly details: string;
  }[];
  readonly positiveProofs: readonly {
    readonly code: string;
    readonly name: string;
    readonly passed: boolean;
    readonly details: string;
  }[];
  readonly reports: readonly EvidencePackageReport[];
}
