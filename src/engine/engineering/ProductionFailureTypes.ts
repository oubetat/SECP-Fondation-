import { pureSha256 } from '../../polyfills/crypto';

export enum FailureClassification {
  APPLICATION_FAILURE = 'APPLICATION_FAILURE',
  KERNEL_FAILURE = 'KERNEL_FAILURE',
  SOLVER_FAILURE = 'SOLVER_FAILURE',
  NUMERICAL_FAILURE = 'NUMERICAL_FAILURE',
  GPU_FAILURE = 'GPU_FAILURE',
  CPU_FAILURE = 'CPU_FAILURE',
  MEMORY_FAILURE = 'MEMORY_FAILURE',
  STORAGE_FAILURE = 'STORAGE_FAILURE',
  NETWORK_FAILURE = 'NETWORK_FAILURE',
  WORKER_FAILURE = 'WORKER_FAILURE',
  SERVICE_FAILURE = 'SERVICE_FAILURE',
  DATABASE_FAILURE = 'DATABASE_FAILURE',
  QUEUE_FAILURE = 'QUEUE_FAILURE',
  CHECKPOINT_FAILURE = 'CHECKPOINT_FAILURE',
  IMPORT_FAILURE = 'IMPORT_FAILURE',
  EXPORT_FAILURE = 'EXPORT_FAILURE',
  INTEROPERABILITY_FAILURE = 'INTEROPERABILITY_FAILURE',
  USER_OPERATION_FAILURE = 'USER_OPERATION_FAILURE',
  SECURITY_FAILURE = 'SECURITY_FAILURE',
  RESOURCE_EXHAUSTION = 'RESOURCE_EXHAUSTION',
  DATA_CORRUPTION = 'DATA_CORRUPTION',
  UNKNOWN_FAILURE = 'UNKNOWN_FAILURE'
}

export enum FailureSeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  RECOVERABLE = 'RECOVERABLE',
  DEGRADED = 'DEGRADED',
  CRITICAL = 'CRITICAL',
  FATAL = 'FATAL'
}

export enum FailureState {
  DETECTED = 'DETECTED',
  CLASSIFIED = 'CLASSIFIED',
  ISOLATING = 'ISOLATING',
  PRESERVING = 'PRESERVING',
  RECOVERING = 'RECOVERING',
  VERIFYING = 'VERIFYING',
  RECOVERED = 'RECOVERED',
  RECOVERED_WITH_LOSS = 'RECOVERED_WITH_LOSS',
  FAILED_RECOVERY = 'FAILED_RECOVERY',
  NON_RECOVERABLE = 'NON_RECOVERABLE',
  DEGRADED = 'DEGRADED'
}

export enum RecoveryPolicyKind {
  SUPPORTED = 'SUPPORTED',
  UNSUPPORTED = 'UNSUPPORTED',
  AUTOMATIC = 'AUTOMATIC',
  MANUAL = 'MANUAL',
  REQUIRES_CHECKPOINT = 'REQUIRES_CHECKPOINT',
  REQUIRES_REBUILD = 'REQUIRES_REBUILD',
  REQUIRES_OPERATOR = 'REQUIRES_OPERATOR'
}

export enum RecoveryStatus {
  RECOVERED = 'RECOVERED',
  RECOVERED_WITH_LOSS = 'RECOVERED_WITH_LOSS',
  DEGRADED = 'DEGRADED',
  FAILED = 'FAILED',
  NON_RECOVERABLE = 'NON_RECOVERABLE',
  INCONCLUSIVE = 'INCONCLUSIVE'
}

export enum RecoveryCapabilityLevel {
  LEVEL_0_DETECTION_ONLY = 'LEVEL_0_DETECTION_ONLY',
  LEVEL_1_CLASSIFICATION = 'LEVEL_1_CLASSIFICATION',
  LEVEL_2_STATE_PRESERVATION = 'LEVEL_2_STATE_PRESERVATION',
  LEVEL_3_RECOVERY_TESTED = 'LEVEL_3_RECOVERY_TESTED',
  LEVEL_4_RECOVERY_VERIFIED = 'LEVEL_4_RECOVERY_VERIFIED',
  LEVEL_5_PRODUCTION_QUALIFICATION = 'LEVEL_5_PRODUCTION_QUALIFICATION',
  LEVEL_6_RESILIENT_PLATFORM = 'LEVEL_6_RESILIENT_PLATFORM'
}

export enum RecoveryCapabilityStatus {
  IMPLEMENTED = 'IMPLEMENTED',
  TESTED = 'TESTED',
  VERIFIED = 'VERIFIED',
  QUALIFIED = 'QUALIFIED',
  PRODUCTION_QUALIFIED = 'PRODUCTION_QUALIFIED',
  NOT_SUPPORTED = 'NOT_SUPPORTED'
}

export interface FailureFingerprint {
  component: string;
  errorCode: string;
  stackOrDiagnosticRef: string;
  state: string;
  timestamp: string;
  configuration: Record<string, any>;
  environment: string;
  inputHash: string;
  lastCheckpointHash?: string;
  fingerprintHash: string;
}

export interface FailureEvent {
  eventId: string;
  failureId: string;
  state: FailureState;
  timestamp: string;
  details: Record<string, any>;
  evidenceHash: string;
}

export interface FailureBlastRadius {
  affectedObjects: string[];
  affectedWorkflows: string[];
  affectedResults: string[];
  affectedEvidence: string[];
  affectedUsers: string[];
  affectedEngineeringDecisions: string[];
  unrelatedProjectsIsolated: boolean;
  unrelatedJobsIsolated: boolean;
  unrelatedEvidenceIsolated: boolean;
}

export interface EngineeringStateSnapshot {
  stateId: string;
  stateHash: string;
  timestamp: string;
  cadGeometryHash?: string;
  camToolpathHash?: string;
  cfdSolutionHash?: string;
  femDisplacementHash?: string;
  assemblyBomHash?: string;
  checkpointId?: string;
  isValid: boolean;
  isCorrupted: boolean;
}

export interface SimulationCheckpoint {
  checkpointId: string;
  timeStep: number;
  iteration: number;
  stateHash: string;
  checksum: string;
  schemaVersion: string;
  isCorrupted: boolean;
  timestamp: string;
  solverData: {
    maxResidual: number;
    temperaturesOrPressuresSample?: number[];
  };
}

export interface RecoveryPolicy {
  failureType: FailureClassification;
  kind: RecoveryPolicyKind;
  maxRetries: number;
  retryDelayMs: number;
  circuitBreakerThreshold: number;
  requiresCheckpoint: boolean;
  isAutomatic: boolean;
}

export interface RecoveryAttempt {
  attemptId: string;
  attemptNumber: number;
  timestamp: string;
  action: 'RETRY' | 'RESTART' | 'ROLLBACK' | 'RESTORE' | 'FAILOVER' | 'ABORT';
  method: string;
  fromState: FailureState;
  toState: FailureState;
  operatorIdentity?: string;
  reason: string;
  checkpointUsed?: string;
  durationMs: number;
  resultStatus: RecoveryStatus;
  evidenceHash: string;
}

export interface PostRecoveryVerification {
  functionalOperational: boolean;
  engineeringStateUnchanged: boolean;
  numericalTolerancePassed: boolean;
  geometryIntegrityPassed: boolean;
  assemblyConstraintIntact: boolean;
  camToolpathIntact: boolean;
  evidenceChainIntact: boolean;
  rpoActualSeconds: number;
  rtoActualSeconds: number;
  dataLossAmount: number;
  evidenceLossAmount: number;
  completenessScore: number;
  affectedCapabilities: string[];
  overallPassed: boolean;
}

export interface ProductionFailureRecord {
  failureId: string;
  projectId: string;
  executionIdentity: string;
  jobId: string;
  originalJobId?: string;
  recoveryJobId?: string;
  simulationRunId?: string;
  modelRevision?: string;
  assemblyRevision?: string;
  workflowId?: string;
  systemComponent: string;
  failureType: FailureClassification;
  severity: FailureSeverity;
  timestamp: string;
  environment: string;
  evidencePackageId: string;
  fingerprint: FailureFingerprint;
  events: FailureEvent[];
  currentState: FailureState;
  detectionLatencyMs: number;
  blastRadius: FailureBlastRadius;
  recoveryAttempts: RecoveryAttempt[];
  lastValidState?: EngineeringStateSnapshot;
  recoveryPolicy: RecoveryPolicy;
  isIdempotent: boolean;
  isPartialState: boolean;
  isDeduplicated: boolean;
  patternId?: string;
}

export interface ProductionFailureEvidencePackage {
  packageId: string;
  failureId: string;
  failureRecord: ProductionFailureRecord;
  stateSnapshots: EngineeringStateSnapshot[];
  checkpoints: SimulationCheckpoint[];
  recoveryEvidence: RecoveryAttempt[];
  verification: PostRecoveryVerification;
  logs: Array<{ timestamp: string; level: string; message: string; signature: string }>;
  metrics: Record<string, number>;
  immutableHistoricalEvidenceProtected: boolean;
  digitalThreadLinks: {
    requirementId: string;
    modelId: string;
    executionId: string;
    failureId: string;
    recoveryId: string;
    decisionId: string;
  };
  aiGovernance: {
    aiProposed: boolean;
    authorizedByPolicy: boolean;
    evidenceProtected: boolean;
    cannotAlterHistorical: boolean;
  };
  finalVerdict: 'PASS' | 'FAIL' | 'INCONCLUSIVE';
  provenanceHash: string;
}

export interface FailureScenarioDefinition {
  scenarioId: string;
  name: string;
  version: string;
  failureType: FailureClassification;
  injectionMethod: string;
  expectedBehavior: string;
  recoveryPolicy: RecoveryPolicy;
  acceptanceCriteria: string[];
  capabilityStatus: RecoveryCapabilityStatus;
}
