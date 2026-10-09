/**
 * PHASE 28 — ENGINEERING AI
 * PATCH-314 — Engineering Copilot
 * Type Definitions & Data Structures
 * 
 * CORE PRINCIPLE:
 * COPILOT ≠ ENGINEERING TRUTH
 * Engineering Truth originates strictly from CAD Kernels, Physical Solvers,
 * CAM Engines, Deterministic Validators, and the Evidence Bus.
 * Copilot orchestrates tools, interprets evidence, and explains trade-offs.
 */

export type CopilotMode =
  | 'ASK'
  | 'ANALYZE'
  | 'DESIGN'
  | 'SIMULATE'
  | 'REVIEW'
  | 'OPTIMIZE'
  | 'MANUFACTURE'
  | 'DIAGNOSE'
  | 'COMPARE'
  | 'TRACE'
  | 'EXPLAIN';

export type CopilotSessionStatus =
  | 'ACTIVE'
  | 'WAITING_CONFIRMATION'
  | 'EXECUTING_PLAN'
  | 'COMPLETED'
  | 'FAILED'
  | 'TERMINATED';

export type ClaimClassificationType = 'FACT' | 'INFERENCE' | 'RECOMMENDATION' | 'UNKNOWN';

export type ActionRiskLevel =
  | 'READ_ONLY'
  | 'LOW_RISK'
  | 'ENGINEERING_CHANGE'
  | 'CRITICAL_ENGINEERING_CHANGE'
  | 'RELEASE_ACTION';

export interface EngineeringContext {
  projectId: string;
  projectName: string;
  partId?: string;
  assemblyId?: string;
  currentRevisionId: string;
  materialId?: string;
  materialName?: string;
  simulationCaseId?: string;
  camSetupId?: string;
  machineId?: string;
  requirementsSetId?: string;
  userRole: 'VIEWER' | 'ENGINEER' | 'LEAD_ENGINEER' | 'ADMIN';
}

export interface EngineeringIntent {
  intentId: string;
  intentType: 'DESIGN_REVIEW' | 'SIMULATION_REQUEST' | 'MANUFACTURING_CHECK' | 'GEOMETRY_ANALYSIS' | 'OPTIMIZATION' | 'FAILURE_ANALYSIS' | 'UNKNOWN';
  targetComponent: string;
  scope: 'PART' | 'ASSEMBLY' | 'SYSTEM';
  requestedOperation: string;
  constraints: string[];
  expectedOutput: string;
  ambiguous: boolean;
  missingInputs?: string[];
}

export interface ActionPlanStep {
  stepId: number;
  toolCategory: 'CAD_KERNEL' | 'FEM_SOLVER' | 'CAM_ENGINE' | 'EVIDENCE_BUS' | 'VALIDATOR' | 'REVIEW_ENGINE' | 'GENERATIVE_ENGINE';
  toolName: string;
  description: string;
  riskLevel: ActionRiskLevel;
  requiresConfirmation: boolean;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'SKIPPED';
  resultSummary?: string;
  evidenceId?: string;
}

export interface EngineeringActionPlan {
  planId: string;
  intentId: string;
  traceId: string;
  steps: ActionPlanStep[];
  status: 'PROPOSED' | 'APPROVED' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  createdAt: string;
}

export interface EvidenceReference {
  evidenceId: string;
  source: 'CAD_KERNEL' | 'FEM_SOLVER' | 'CFD_SOLVER' | 'CAM_SIMULATOR' | 'DESIGN_REVIEW' | 'GENERATIVE_ENGINE';
  runId: string;
  revisionId: string;
  timestamp: string;
  evidenceHash: string;
  validatorName: string;
  status: 'VALIDATED' | 'FAILED' | 'UNCONVERGED' | 'STALE' | 'UNKNOWN';
  metrics: Record<string, number | string>;
}

export interface ClaimGrounding {
  claimId: string;
  text: string;
  classification: ClaimClassificationType; // Rule 35: FACT | INFERENCE | RECOMMENDATION | UNKNOWN
  evidenceRef?: EvidenceReference;
  provenancePath?: string;
  blockedByGuard?: boolean;
}

export interface CopilotResponseContract {
  responseId: string;
  traceId: string;
  mode: CopilotMode;
  userPrompt: string;
  intent: EngineeringIntent;
  plan?: EngineeringActionPlan;
  validationStatus: 'PASS' | 'FAIL' | 'UNCONVERGED' | 'UNKNOWN' | 'NO_RESULT';
  claims: ClaimGrounding[];
  observedResults: Record<string, number | string>;
  aiInterpretation: string;
  recommendation?: string;
  engineerActionRequired: boolean;
  evidenceReferences: EvidenceReference[];
  timestamp: string;
}

export interface CopilotSession {
  sessionId: string;
  userId: string;
  context: EngineeringContext;
  policyVersion: string;
  modelVersion: string;
  status: CopilotSessionStatus;
  traceHistory: string[];
  createdAt: string;
}

export interface EngineeringCopilotPolicy {
  policyVersion: string;
  allowedTools: string[];
  allowedActions: ActionRiskLevel[];
  requireConfirmationFor: ActionRiskLevel[];
  allowSilentChanges: boolean; // Rule 116: Strictly false in production
  allowUnvalidatedResults: boolean; // Rule 116: Strictly false
  maxActionBudget: number;
}
