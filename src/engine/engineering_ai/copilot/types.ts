export type EngineeringIntentType =
  | 'EXPLAIN_RESULT'
  | 'DIAGNOSE_FAILURE'
  | 'COMPARE_DESIGNS'
  | 'OPTIMIZE_DESIGN'
  | 'OPTIMIZE_MANUFACTURING'
  | 'QUERY_EVIDENCE'
  | 'CHECK_COMPLIANCE'
  | 'GENERATE_ANALYSIS'
  | 'REVIEW_MODEL'
  | 'AMBIGUOUS_ENGINEERING_REQUEST';

export type EngineeringCommand =
  | 'ANALYZE'
  | 'SIMULATE'
  | 'VERIFY'
  | 'COMPARE'
  | 'OPTIMIZE'
  | 'DIAGNOSE'
  | 'INSPECT'
  | 'TRACE'
  | 'EXPLAIN'
  | 'GENERATE'
  | 'MODIFY'
  | 'RELEASE';

export type ToolPermission =
  | 'READ_ONLY'
  | 'ANALYZE'
  | 'SIMULATE'
  | 'PROPOSE'
  | 'MODIFY'
  | 'RELEASE';

export type CopilotSafetyClassification =
  | 'LOW_RISK'
  | 'ENGINEERING_REVIEW'
  | 'HIGH_IMPACT'
  | 'CRITICAL_ENGINEERING_ACTION';

export type ActionProposalState =
  | 'PROPOSED'
  | 'REVIEW_REQUIRED'
  | 'APPROVED'
  | 'REJECTED'
  | 'EXECUTED'
  | 'VERIFIED';

export type CopilotResponseClassification =
  | 'FACTUAL'
  | 'ANALYTICAL'
  | 'PREDICTIVE'
  | 'RECOMMENDATION'
  | 'ACTION_PROPOSAL'
  | 'VERIFICATION_RESULT'
  | 'UNKNOWN'
  | 'INSUFFICIENT_EVIDENCE';

export interface EngineeringContext {
  projectId: string;
  userId: string;
  partId?: string;
  assemblyId?: string;
  revisionId?: string;
  geometryState?: any;
  materialState?: any;
  simulationState?: any;
  manufacturingState?: any;
  inspectionState?: any;
  digitalTwinState?: any;
  activeEvidence?: string[];
  constraints?: any[];
  units?: string;
  solverState?: any;
}

export interface EngineeringIntent {
  intentType: EngineeringIntentType;
  domain: string;
  target: string;
  operation: EngineeringCommand;
  constraints: any[];
  requestedEvidence: string[];
  confidence: number;
  requiredTools: string[];
}

export interface EngineeringActionProposal {
  proposalId: string;
  action: string;
  target: string;
  currentState: any;
  proposedState: any;
  reason: string;
  expectedImpact: string;
  risks: string[];
  evidence: string[];
  verificationPlan: string;
  state: ActionProposalState;
}

export interface CopilotProvenance {
  model: string;
  modelVersion: string;
  promptPolicyVersion: string;
  toolVersions: Record<string, string>;
  contextHash: string;
  evidenceHashes: string[];
  responseHash: string;
  timestamp: string;
}

export interface EngineeringCopilotEvidenceBundle {
  sessionId: string;
  intent: EngineeringIntent;
  context: EngineeringContext;
  retrievedEvidence: any[];
  toolExecutions: any[];
  calculations: any[];
  recommendations: any[];
  proposals: EngineeringActionProposal[];
  approvals: any[];
  verification: any;
  provenance: CopilotProvenance;
  finalDecision: any;
}
