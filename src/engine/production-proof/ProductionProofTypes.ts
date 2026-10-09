export interface EngineeringClosureStatus {
  edgeVertexPickingClosed: boolean;
  professionalViewportClosed: boolean;
  workbenchOwnershipClosed: boolean;
  invalidationContractClosed: boolean;
  capabilityIntegrationClosed: boolean;
  isEngineeringClosureAchieved: boolean;
  closureTimestamp?: string;
  closureSignOffHash?: string;
}

export type PStageId =
  | 'P0'
  | 'P1'
  | 'P2'
  | 'P3'
  | 'P4'
  | 'P5'
  | 'P6'
  | 'P7'
  | 'P8'
  | 'P9'
  | 'P10'
  | 'P11'
  | 'P12';

export interface PStageExecutionResult {
  stageId: PStageId;
  name: string;
  description: string;
  status: 'PASSED' | 'FAILED' | 'CRITICAL_FAILURE';
  score: number; // 0 to 100
  executionTimeMs: number;
  assertionsPassed: number;
  assertionsTotal: number;
  isCriticalStage: boolean;
  criticalFailureDetails?: string;
  evidenceHash: string;
  logs: string[];
}

export type GateId = 'GATE_A' | 'GATE_B' | 'GATE_C' | 'GATE_D' | 'GATE_E';

export interface GateExecutionResult {
  gateId: GateId;
  name: string;
  description: string;
  requiredPStages: PStageId[];
  status: 'PASSED' | 'BLOCKED' | 'FAILED';
  prerequisitesMet: boolean;
  verificationMessage: string;
}

export type ProductionProofVerdict =
  | 'ENGINEERING_CLOSED_PENDING_PROOF'
  | 'QUALIFICATION_IN_PROGRESS'
  | 'CRITICAL_FAILURE_REJECTED'
  | 'GATES_FAILED'
  | 'FIELD_PROVEN';

export interface ProductionProofReport {
  reportId: string;
  timestamp: string;
  gitCommit: string;
  environmentId: string;
  engineeringClosure: EngineeringClosureStatus;
  pStageResults: PStageExecutionResult[];
  secpPPS: number; // SECP Production Proven Score (0 - 1000)
  criticalFailureOccurred: boolean;
  criticalFailureStageId?: PStageId;
  criticalFailureReason?: string;
  gateResults: GateExecutionResult[];
  finalVerdict: ProductionProofVerdict;
  overallFieldProven: boolean;
  merkleProofHash: string;
  executionDurationMs: number;
}
