/**
 * SECP Industrial OS — M10.7: Cross-Domain Engineering Intelligence & Truth Reconciliation Types
 * 
 * Formal representation of multi-domain dependencies, freshness enforcement, 
 * conflict-preserving intelligence, and cross-domain truth reconciliation.
 * 
 * Governing Invariants:
 * 1. Cross-Domain AI Intelligence != Cross-Domain Engineering Authority.
 * 2. UNKNOWN != CURRENT; STALE != CURRENT.
 * 3. Conflicting canonical facts must remain independently identifiable (No silent merging).
 * 4. Deterministic identity change upon dependency mutation.
 * 5. Full binding to M10.4 Evidence, M10.5 Uncertainty, and M10.6 Reasoning.
 */

import { EngineeringDomain, EngineeringServiceType, CrossDomainResultStatus } from '../../crossdomain/CrossDomainTypes';
import { EngineeringReasoningTrace } from '../reasoning/types';
import { UncertaintyAssessment } from '../uncertainty/types';

export type FreshnessState = 
  | 'CURRENT'
  | 'STALE'
  | 'MISSING'
  | 'UNKNOWN'
  | 'INVALID'
  | 'CONFLICTED';

export type ReconciliationStatus =
  | 'RECONCILED'
  | 'PARTIALLY_RECONCILED'
  | 'CONFLICTED'
  | 'INSUFFICIENT_EVIDENCE'
  | 'STALE_DEPENDENCY'
  | 'MISSING_DEPENDENCY'
  | 'UNKNOWN';

export type DependencyRelationship =
  | 'CONSUMES'
  | 'DERIVES_FROM'
  | 'VALIDATES'
  | 'CORRELATES_WITH'
  | 'CONTRADICTS';

export interface CrossDomainDependency {
  readonly dependencyId: string; // Deterministic: DEP-<hash>
  readonly sourceDomain: EngineeringDomain | string;
  readonly serviceType: EngineeringServiceType | string;
  readonly sourceRevisionId: string;
  readonly sourceRevisionHash: string;
  readonly sourceResultId: string;
  readonly sourceResultHash: string;
  readonly sourceContextHash: string;
  readonly relationship: DependencyRelationship;
  readonly freshness: FreshnessState;
  readonly evidenceId?: string;
  readonly metadata?: Readonly<Record<string, any>>;
}

export interface DomainReconciliationFinding {
  readonly findingId: string;
  readonly domainA: EngineeringDomain | string;
  readonly domainB: EngineeringDomain | string;
  readonly sourceIdA: string;
  readonly sourceIdB: string;
  readonly valueA: any;
  readonly valueB: any;
  readonly status: 'AGREEMENT' | 'CONFLICT' | 'INCOMPLETE' | 'UNKNOWN';
  readonly delta?: any;
  readonly rationale: string;
}

export interface CrossDomainInferenceTrace {
  readonly inferenceId: string;
  readonly schemaVersion: '1.0.0-M10.7';
  readonly contextId: string;
  readonly contextHash: string;
  readonly modelId: string;
  readonly modelVersion: string;
  readonly executionHash: string;
  
  // Cross-domain dependencies
  readonly dependencies: readonly CrossDomainDependency[];
  readonly dependencyGroupHash: string;
  
  // Truth reconciliation findings
  readonly reconciliationStatus: ReconciliationStatus;
  readonly findings: readonly DomainReconciliationFinding[];
  
  // Integration with M10.5/M10.6
  readonly reasoningTraceId?: string;
  readonly reasoningTrace?: EngineeringReasoningTrace;
  readonly uncertaintyAssessmentId?: string;
  readonly uncertaintyAssessment?: UncertaintyAssessment;
  
  // Authority Boundaries
  readonly authorityTag: 'ADVISORY_EVIDENCE';
  readonly isCanonicalTruth: false;
  readonly isCanonicalRelease: false;
  
  readonly contentHash: string;
  readonly createdAt: string;
}

export interface CrossDomainValidationError {
  readonly code:
    | 'STALE_DEPENDENCY_IN_CURRENT_INFERENCE'
    | 'MISSING_MANDATORY_DOMAIN'
    | 'DEPENDENCY_IDENTITY_TAMPERED'
    | 'CONFLICT_SILENTLY_RESOLVED'
    | 'UNCERTAINTY_COLLAPSED'
    | 'AUTHORITY_ESCALATION'
    | 'REVISION_MISMATCH'
    | 'CONTEXT_DRIFT_DETECTED'
    | 'REHYDRATION_IDENTITY_DRIFT';
  readonly message: string;
  readonly path?: string;
}

export interface CrossDomainValidationResult {
  readonly valid: boolean;
  readonly errors: readonly CrossDomainValidationError[];
}
