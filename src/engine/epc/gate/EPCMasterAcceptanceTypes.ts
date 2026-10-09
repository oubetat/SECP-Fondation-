/**
 * SECP Industrial OS — EPC-015: Master Acceptance Gate Types
 * Canonical Central Master Acceptance Gate Contracts & Definitions.
 */

export enum MasterGateCriterionId {
  TRACEABILITY = 'TRACEABILITY',
  PROVENANCE = 'PROVENANCE',
  CONFIGURATION = 'CONFIGURATION',
  INTEGRITY = 'INTEGRITY',
  REPRODUCIBILITY = 'REPRODUCIBILITY',
  VERDICT_INTEGRITY = 'VERDICT_INTEGRITY',
  EXECUTION = 'EXECUTION'
}

export type MasterGateVerdict = 'PASS' | 'FAIL' | 'INCONCLUSIVE';

export enum MasterGateFailureCode {
  TRACEABILITY_MISSING = 'EPC-015-TRACEABILITY-MISSING',
  PROVENANCE_MISSING = 'EPC-015-PROVENANCE-MISSING',
  CONFIGURATION_MISSING = 'EPC-015-CONFIGURATION-MISSING',
  CONFIGURATION_INCOMPLETE = 'EPC-015-CONFIGURATION-INCOMPLETE',
  EVIDENCE_INTEGRITY_FAILURE = 'EPC-015-EVIDENCE-INTEGRITY-FAILURE',
  REPRODUCIBILITY_FAILURE = 'EPC-015-REPRODUCIBILITY-FAILURE',
  EXECUTION_MISSING = 'EPC-015-EXECUTION-MISSING',
  HARDCODED_VERDICT_REJECTED = 'EPC-015-HARDCODED-VERDICT-REJECTED',
  INVALID_PROOFCASE = 'EPC-015-INVALID-PROOFCASE'
}

export interface MasterGateCriterionResult {
  readonly criterionId: MasterGateCriterionId;
  readonly status: MasterGateVerdict;
  readonly mandatory: boolean;
  readonly details: string;
  readonly evidenceRefs: string[];
}

export interface MasterGateFailureReport {
  readonly failureCode: MasterGateFailureCode | string;
  readonly criterion: MasterGateCriterionId;
  readonly severity: 'CRITICAL' | 'MAJOR' | 'MINOR';
  readonly caseId: string;
  readonly requirementId?: string;
  readonly evidenceId?: string;
  readonly missingLinks?: string[];
  readonly details: string;
  readonly detectedAt: string;
}

export interface MasterGateAuditRecord {
  readonly gateId: string;
  readonly caseId: string;
  readonly evaluatedAt: string;
  readonly evaluator: string;
  readonly criteriaResults: Record<string, MasterGateVerdict>;
  readonly failures: readonly MasterGateFailureReport[];
  readonly warnings: readonly string[];
  readonly finalVerdict: MasterGateVerdict;
  readonly auditHash: string;
}

export interface MasterAcceptanceResult {
  readonly gateId: string;
  readonly caseId: string;
  readonly evaluatedAt: string;
  readonly status: 'COMPLETED' | 'REJECTED' | 'EVALUATED';
  readonly verdict: MasterGateVerdict;
  readonly criteria: readonly MasterGateCriterionResult[];
  readonly failures: readonly MasterGateFailureReport[];
  readonly warnings: readonly string[];
  readonly evidenceRefs: readonly string[];
  readonly executionRef?: string;
  readonly configurationRef?: string;
  readonly provenanceRef?: readonly string[];
  readonly reproducibilityRef?: string;
  readonly auditRecord?: MasterGateAuditRecord;
}

export interface MasterGateExecutionRecord {
  readonly executionId: string;
  readonly caseId: string;
  readonly workflowId: string;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly status: 'COMPLETED' | 'RUNNING' | 'FAILED' | 'ABORTED';
  readonly inputs: Record<string, any>;
  readonly outputs: Record<string, any>;
  readonly configurationRef?: string;
  readonly evidenceRefs?: readonly string[];
}

export interface MasterGateReproducibilityResult {
  readonly reproducibilityId: string;
  readonly contractId?: string;
  readonly originalExecutionId: string;
  readonly reproductionExecutionId: string;
  readonly status: 'PASS' | 'FAIL' | 'INCONCLUSIVE';
  readonly maxObservedDifference: number;
  readonly expectedTolerance: number;
  readonly reproducible: boolean;
  readonly details?: string;
}

export interface EPCMasterGateInput {
  readonly proofCase?: any;
  readonly requirements?: readonly any[];
  readonly traceability?: any;
  readonly configurationBaseline?: any;
  readonly evidence?: readonly any[];
  readonly provenance?: readonly any[] | Record<string, any>;
  readonly executionRecords?: readonly MasterGateExecutionRecord[];
  readonly reproducibilityResults?: readonly MasterGateReproducibilityResult[];
  readonly verdict?: MasterGateVerdict;
  readonly options?: {
    readonly allowInconclusiveOnUnknown?: boolean;
    readonly evaluator?: string;
  };
}
