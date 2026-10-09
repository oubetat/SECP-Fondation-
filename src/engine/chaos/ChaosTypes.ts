/**
 * PATCH-184: Industrial Failure Injection & Chaos Framework Types
 * SECP Industrial OS v3 - Engineering Truth Platform
 */

export type FailureStatus = 
  | 'DETECTED'
  | 'ISOLATED'
  | 'CONTAINED'
  | 'RECOVERED'
  | 'REJECTED'
  | 'UNDETECTED'
  | 'MISCLASSIFIED'
  | 'PROPAGATED';

export type FailureSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type FailureDomain = 
  | 'CAD_BREP'
  | 'DEGENERATE_GEOMETRY'
  | 'NUMERICAL_INSTABILITY'
  | 'MESH'
  | 'MATERIAL'
  | 'CFD'
  | 'FEM'
  | 'GCS_CONSTRAINT'
  | 'CAM'
  | 'PLM'
  | 'EVIDENCE'
  | 'CROSS_DOMAIN';

export interface InjectedFault {
  faultId: string;
  domain: FailureDomain;
  severity: FailureSeverity;
  injectionType: string;
  precondition: string;
  injectedData: Record<string, any>;
  description: string;
  timestamp: string;
}

export interface FailureDiagnosis {
  rootCause: string;
  propagationPath: string[];
  affectedComponents: string[];
  containmentBoundary: string;
  recommendedAction: 'REJECT' | 'REPAIR' | 'ISOLATE_AND_CONTINUE' | 'HALT_SYSTEM';
  technicalDetails: Record<string, any>;
}

export interface FailureRecord {
  recordId: string;
  fault: InjectedFault;
  actualStatus: FailureStatus;
  expectedStatus: FailureStatus;
  detectionLatencyMs: number;
  detectedBy: string;
  isolationBoundary: string;
  contained: boolean;
  publishedResultBlocked: boolean;
  diagnosis: FailureDiagnosis;
  evidenceHash: string;
  oracleVerdict: 'PASS' | 'FAIL';
  oracleNotes: string;
  timestamp: string;
}

export interface ChaosScenario {
  scenarioId: string;
  name: string;
  domain: FailureDomain;
  faults: InjectedFault[];
  expectedDetection: string;
  expectedRootCause: string;
  recoveryPossible: boolean;
}

export interface ChaosCampaign {
  campaignId: string;
  name: string;
  seed: number;
  domain: FailureDomain | 'ALL';
  scenarios: ChaosScenario[];
  executionTimeMs: number;
  totalInjected: number;
  detectedCount: number;
  isolatedCount: number;
  containedCount: number;
  recoveredCount: number;
  rejectedCount: number;
  undetectedCount: number;
  criticalFailuresCount: number;
  evidenceHash: string;
  verdict: 'QUALIFIED' | 'FAILED';
  timestamp: string;
}

export interface Gate184Report {
  gateId: 'GATE-SECP-184';
  patchId: 'PATCH-184';
  title: 'Industrial Failure Injection & Chaos Testing Framework';
  timestamp: string;
  status: 'PASSED' | 'FAILED';
  score: number;
  totalCriteria: number;
  passedCriteria: number;
  criteria: Array<{
    id: string;
    description: string;
    status: 'PASSED' | 'FAILED';
    details: string;
  }>;
  campaignSummaries: Array<{
    campaignId: string;
    domain: string;
    injected: number;
    detected: number;
    contained: number;
    verdict: string;
  }>;
  merkleRootHash: string;
  signature: string;
  provenance: {
    previousGate: 'GATE-SECP-183';
    timestamp: string;
  };
}
