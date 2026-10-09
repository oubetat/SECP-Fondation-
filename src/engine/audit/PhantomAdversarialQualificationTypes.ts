/**
 * SECP Industrial OS v2 — PROMPT-064: Phantom Capability Adversarial Qualification
 * Core Types & Injected Phantom Definitions Schema
 */

import {
  CapabilityVerdict,
  FindingSeverity,
  FullCapabilityRecord,
  GlobalPhantomAuditVerdict,
  UiBackendMatchStatus
} from './ZeroPhantomCapabilityAuditTypes';

export type InjectedPhantomType =
  | 'NO_BACKEND_ROUTE'
  | 'FAKE_SUCCESS_NO_KERNEL'
  | 'DEAD_DISPATCHER_ROUTE'
  | 'BACKEND_METHOD_UNEXECUTABLE'
  | 'DETERMINISTIC_STUB_KERNEL'
  | 'FABRICATED_KERNEL_RESULT'
  | 'FAKE_VERIFIER_PASS'
  | 'UNRELATED_EVIDENCE_LINK'
  | 'UNREACHABLE_UI_ORPHAN'
  | 'SHADOW_PIPELINE_BYPASS'
  | 'HARDCODED_METADATA_PASS'
  | 'CIRCULAR_SELF_ATTESTATION'
  | 'HASH_EXISTS_WRONG_PHYSICS'
  | 'METADATA_PASS_RUNTIME_FAIL';

export interface InjectedPhantomCase {
  caseId: string; // PHANTOM-001 to PHANTOM-014
  name: string;
  type: InjectedPhantomType;
  description: string;
  injectedRecord: FullCapabilityRecord;
  expectedDetectionReason: string;
  expectedSeverity: FindingSeverity;
}

export interface AdversarialQualificationResult {
  caseId: string;
  name: string;
  type: InjectedPhantomType;
  wasDetected: boolean;
  detectedAs: CapabilityVerdict | GlobalPhantomAuditVerdict;
  detectionMessage: string;
  severityAssigned: FindingSeverity;
  bypassOccurred: boolean; // Must be false for 100% security
}

export interface ScopeClarificationReport {
  declaredCoreCapabilitiesCount: number; // 14
  additionalDiscoveredSubsystemsCount: number; // 3 (Boolean Intersect, STEP Export, VTK Export)
  totalEvaluatedEngineeringSurface: number; // 17
  scopeReconciliationStatus: 'EXPLICITLY_RECONCILED';
  subsystems: {
    id: string;
    name: string;
    entryPoint: string;
    uiExposure: string;
    operationalStatus: 'OPERATIONAL_ACCESSIBLE';
  }[];
}

export interface PhantomAdversarialAuditReport {
  timestamp: string;
  totalInjectedCases: number; // 14
  detectedCount: number; // Must be 14
  bypassedCount: number; // Must be 0
  adversarialDetectionRate: number; // Must be 100%
  qualificationVerdict: 'ADVERSARIALLY QUALIFIED' | 'QUALIFICATION FAILED';
  results: AdversarialQualificationResult[];
  scopeClarification: ScopeClarificationReport;
  liveEngineCalculationsDemonstrated: {
    eulerPoincareInvariance: { V: number; E: number; F: number; chi: number; isValid: boolean };
    gcs2dNewtonRaphsonConvergence: { iterations: number; finalResidual: number; isConverged: boolean };
    massPropertiesDivergenceIntegral: { volumeMm3: number; calculatedMassKg: number; isPositiveDefinite: boolean };
    cryptographicLedgerRecalculation: { computedHash: string; matchesGenesis: boolean };
  };
}
