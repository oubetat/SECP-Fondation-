/**
 * PHASE 28 — ENGINEERING AI
 * PATCH-311 — AI Failure Detection
 * Type Definitions & Data Structures
 * 
 * CORE PRINCIPLE:
 * AI Detection ≠ Engineering Validation ≠ Engineering Truth
 * AI detects, explains, and proposes causes.
 * Engineering validators establish actual physical state.
 * Engineers control corrective actions and approvals.
 */

export type FailureCategory =
  | 'CAD_FAILURE'
  | 'GEOMETRY_FAILURE'
  | 'TOPOLOGY_FAILURE'
  | 'MESH_FAILURE'
  | 'SOLVER_FAILURE'
  | 'NUMERICAL_FAILURE'
  | 'PHYSICS_FAILURE'
  | 'CONVERGENCE_FAILURE'
  | 'BOUNDARY_CONDITION_FAILURE'
  | 'MATERIAL_FAILURE'
  | 'THERMAL_FAILURE'
  | 'CFD_FAILURE'
  | 'FEM_FAILURE'
  | 'FSI_FAILURE'
  | 'CAM_FAILURE'
  | 'COLLISION_FAILURE'
  | 'RESOURCE_FAILURE'
  | 'HARDWARE_FAILURE'
  | 'DATA_FAILURE'
  | 'CONFIGURATION_FAILURE';

export type FailureSeverity =
  | 'INFO'
  | 'WARNING'
  | 'ERROR'
  | 'CRITICAL'
  | 'BLOCKING';

export type FailureState =
  | 'DETECTED'
  | 'UNDER_ANALYSIS'
  | 'CONFIRMED'
  | 'FALSE_POSITIVE'
  | 'RESOLVED'
  | 'REVALIDATION_REQUIRED';

export type DetectionSource =
  | 'SOLVER_LOGS'
  | 'RESIDUAL_HISTORY'
  | 'CONVERGENCE_METRICS'
  | 'MESH_DIAGNOSTICS'
  | 'GEOMETRY_DIAGNOSTICS'
  | 'CAD_KERNEL'
  | 'TELEMETRY'
  | 'HARDWARE_MONITORING'
  | 'CAM_VERIFICATION'
  | 'SIMULATION_RESULTS'
  | 'VALIDATION_GATES';

export type ConfidenceCategory =
  | 'CONFIRMED'
  | 'STRONGLY_SUPPORTED'
  | 'POSSIBLE'
  | 'UNKNOWN';

export type SolverTerminationClass =
  | 'CONVERGED'
  | 'MAX_ITERATIONS'
  | 'DIVERGED'
  | 'FAILED'
  | 'CANCELLED'
  | 'TIMEOUT';

export type ResidualPatternType =
  | 'GROWTH'
  | 'OSCILLATION'
  | 'STAGNATION'
  | 'DIVERGENCE'
  | 'CONVERGENCE'
  | 'FLAT';

export interface FailureEvidenceItem {
  evidenceId: string;
  source: DetectionSource;
  rawPayload: string;
  timestamp: string;
  metrics?: Record<string, number | string | boolean>;
}

export interface FailureFingerprint {
  fingerprintHash: string;
  logPattern: string;
  residualPattern: ResidualPatternType;
  errorCode?: string;
  solverState: string;
  meshState: string;
  hardwareState: string;
  isKnownPattern: boolean;
  matchedSignatureId?: string;
}

export interface CausalGraphNode {
  id: string;
  label: string;
  type: 'SETUP' | 'GEOMETRY' | 'MESH' | 'SOLVER' | 'RESULT';
  status: 'NORMAL' | 'WARNING' | 'FAILED';
}

export interface CausalGraphEdge {
  from: string;
  to: string;
  relationship: string;
  isHypothesis: boolean; // MUST be true unless confirmed by engineering validator
}

export interface RootCauseHypothesis {
  causeId: string;
  title: string;
  confidenceCategory: ConfidenceCategory;
  supportingSignals: string[];
  contradictingSignals: string[];
  evidenceRef: string[];
  isHypothesis: boolean; // Guaranteed true unless engineering validator confirmed
  proposedFixSummary: string;
}

export interface AIRootCauseDiagnosis {
  diagnosisId: string;
  eventId: string;
  rankedCauses: RootCauseHypothesis[];
  causalGraphNodes: CausalGraphNode[];
  causalGraphEdges: CausalGraphEdge[];
  evaluatedAt: string;
}

export interface TimelineEvent {
  step: string;
  timestamp: string;
  stage: 'T0_SETUP' | 'T1_MESH' | 'T2_SOLVER_START' | 'T3_RESIDUAL_GROWTH' | 'T4_WARNING' | 'T5_FAILURE';
  description: string;
  severity: FailureSeverity;
}

export interface AIRecoveryProposal {
  proposalId: string;
  failureId: string;
  suggestedAction:
    | 'REFINE_MESH'
    | 'CHANGE_TIME_STEP'
    | 'REVIEW_BOUNDARY_CONDITIONS'
    | 'CHECK_MATERIAL'
    | 'REPAIR_GEOMETRY'
    | 'REVIEW_SOLVER_SETTINGS'
    | 'RETRY_JOB';
  reason: string;
  affectedParameters: string[];
  risk: 'LOW' | 'MEDIUM' | 'HIGH';
  newRevisionBranchId: string;
  approvedByEngineer: boolean;
  engineerApproverId?: string;
  executedAt?: string;
  reRunRunId?: string;
  recoveryEffectiveness?: {
    failureResolved: boolean;
    convergenceImproved: boolean;
    physicsPreserved: boolean;
    status: 'RESOLVED' | 'NOT_RESOLVED' | 'REVALIDATION_REQUIRED';
    notes: string;
  };
}

export interface EngineeringFailureEvent {
  failureId: string;
  runId: string;
  caseId: string;
  failureType: FailureCategory;
  severity: FailureSeverity;
  source: DetectionSource;
  detectedAt: string;
  evidence: FailureEvidenceItem[];
  status: FailureState;
  diagnosis?: AIRootCauseDiagnosis;
  fingerprint?: FailureFingerprint;
  timeline?: TimelineEvent[];
  falsePositiveReason?: string;
  engineerReviewer?: string;
  isEarlyWarning?: boolean;
  isPredictionOnly?: boolean;
}

export interface AIFailureDetectionSession {
  sessionId: string;
  projectId: string;
  revisionId: string;
  runId: string;
  caseId: string;
  modelVersion: string;
  policyVersion: string;
  aiModelVersion: string;
  status: 'ACTIVE' | 'COMPLETED' | 'FAILED' | 'REVALIDATION_REQUIRED';
  createdAt: string;
  failureEvents: EngineeringFailureEvent[];
  recoveryProposals: AIRecoveryProposal[];
  isProductionBlocked: boolean;
}

export interface FailureEvidencePackage {
  packageId: string;
  packageHash: string; // Cryptographic hash of entire evidence
  sessionId: string;
  projectId: string;
  revisionId: string;
  runId: string;
  setupVersion: string;
  inputHash: string;
  solverVersion: string;
  hardwareInfo: string;
  logs: string[];
  residualHistory: Array<{ iteration: number; residualValue: number }>;
  meshDiagnostics: Record<string, any>;
  geometryDiagnostics: Record<string, any>;
  classification: FailureCategory;
  aiDiagnosis?: AIRootCauseDiagnosis;
  recoveryAttempts: AIRecoveryProposal[];
  finalStatus: FailureState;
  plmEcoLink?: {
    project: string;
    revision: string;
    branch: string;
    ecoId?: string;
  };
  digitalThreadChain: string[];
  createdAt: string;
}

export interface KnownFailureRecord {
  patternId: string;
  patternName: string;
  category: FailureCategory;
  observedEvidence: string[];
  confirmedCause: string;
  resolution: string;
  humanValidated: boolean;
  solverDomain: string;
}

export interface AnomalyReport {
  anomalyId: string;
  runId: string;
  type: 'Numerical' | 'Physical' | 'Geometric' | 'Operational' | 'Performance' | 'Hardware' | 'Data';
  baselineRunId: string;
  metricName: string;
  expectedValue: number | string;
  actualValue: number | string;
  deviationPercentage: number;
  isRegression: boolean;
  severity: FailureSeverity;
}
