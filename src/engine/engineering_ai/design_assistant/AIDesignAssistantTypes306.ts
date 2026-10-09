/**
 * SECP Industrial OS - PATCH-306 AI Design Assistant Types
 * Intent Parsing, Context Resolver, Tool Calling, Design Proposals,
 * Multi-Physics Solver Integrations, Counterfactuals & Digital Thread Evidence
 */

export type AIActionClassification =
  | 'READ'
  | 'ANALYZE'
  | 'PROPOSE'
  | 'SIMULATE'
  | 'MODIFY'
  | 'SUBMIT'
  | 'APPROVE';

export type ToolPermissionLevel =
  | 'READ'
  | 'ANALYZE'
  | 'PROPOSE'
  | 'MODIFY'
  | 'EXECUTE';

export type ValidationStatus306 =
  | 'UNVALIDATED'
  | 'PARTIALLY_VALIDATED'
  | 'VALIDATED';

export type ProposalStatus306 =
  | 'DRAFT'
  | 'NEEDS_CLARIFICATION'
  | 'PENDING_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'ROLLED_BACK';

export type ReviewSeverity = 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';

export type ReviewCategory =
  | 'GEOMETRY'
  | 'CONSTRAINTS'
  | 'MATERIALS'
  | 'STRUCTURAL'
  | 'THERMAL'
  | 'FLUID'
  | 'MANUFACTURING'
  | 'ASSEMBLY'
  | 'PLM';

export type ProductionClassification306 =
  | 'AI_ASSISTED'
  | 'AI_VERIFIED'
  | 'AI_ENGINEERING_VALIDATED'
  | 'AI_PRODUCTION_APPROVED';

export interface AIDesignSession {
  sessionId: string;
  projectId: string;
  revisionId: string;
  userId: string;
  contextHash: string;
  model: {
    modelId: string;
    modelVersion: string;
    provider: string;
    configuration: Record<string, any>;
  };
  promptVersion: string;
  policyVersion: string;
  createdAt: number;
}

export interface EngineeringContext {
  projectId: string;
  revisionId: string;
  branchName: string;
  variantId?: string;
  partName: string;
  assemblyId?: string;
  materials: {
    materialId: string;
    name: string;
    youngModulusGPa: number;
    yieldStrengthMPa: number;
    densityKgM3: number;
    thermalConductivity: number;
  }[];
  constraints: {
    constraintId: string;
    type: string;
    target: string;
    expression: string;
    isSatisfied: boolean;
  }[];
  loads: {
    loadId: string;
    type: 'FORCE' | 'PRESSURE' | 'TORQUE' | 'TEMPERATURE';
    magnitude: number;
    unit: string;
    appliedFaceId: string;
  }[];
  boundaryConditions: {
    faceId: string;
    condition: 'FIXED' | 'SLIDING' | 'SYMMETRY';
  }[];
  manufacturingProcess: '3_AXIS_CNC' | '5_AXIS_CNC' | 'INJECTION_MOLDING' | 'ADDITIVE_SLS' | 'SHEET_METAL';
  designRequirements: string[];
  units: {
    length: 'mm' | 'm' | 'in';
    force: 'N' | 'kN';
    stress: 'MPa' | 'GPa';
    mass: 'kg' | 'g';
  };
  toleranceClass: 'FINE' | 'MEDIUM' | 'COARSE';
}

export interface StructuredIntent {
  rawNaturalLanguage: string;
  primaryObjective: string;
  objectives: {
    metric: 'MASS' | 'STIFFNESS' | 'COST' | 'MANUFACTURABILITY' | 'THERMAL' | 'FLOW';
    direction: 'MINIMIZE' | 'MAXIMIZE' | 'MAINTAIN';
    targetValue?: number;
  }[];
  constraints: {
    metric: string;
    boundType: 'MIN' | 'MAX' | 'EXACT';
    value: number;
    unit: string;
  }[];
  manufacturingRequirements: string[];
  performanceRequirements: string[];
  explicitAssumptions: string[];
  ambiguityStatus: 'CLEAR' | 'NEEDS_CLARIFICATION' | 'CONTRADICTORY';
  clarificationPrompt?: string;
}

export interface AIDesignRequest {
  requestId: string;
  sessionId: string;
  intent: StructuredIntent;
  targetObject: string; // e.g., "Bracket_Body_v2"
  preferences: Record<string, any>;
}

export interface ParametricDiff {
  parameterName: string;
  oldValue: number | string;
  newValue: number | string;
  unit: string;
}

export interface EngineeringDiff {
  parametricDiffs: ParametricDiff[];
  affectedFeatures: string[];
  affectedConstraints: string[];
  assemblyImpact: {
    hasClearanceIssue: boolean;
    affectedMatingParts: string[];
  };
  manufacturingImpact: {
    machinabilityScoreBefore: number;
    machinabilityScoreAfter: number;
    toolpathCollisionRisk: 'NONE' | 'LOW' | 'HIGH';
  };
  simulationImpact: {
    revalidationRequiredSolvers: ('FEM' | 'CFD' | 'THERMAL' | 'CAM')[];
  };
  validationImpact: {
    revalidationRequiredGates: string[];
  };
}

export interface AIDesignProposal {
  proposalId: string;
  sessionId: string;
  requestId: string;
  baseRevision: string;
  targetObject: string;
  changes: {
    type: 'GEOMETRY_PARAM' | 'MATERIAL_SUBSTITUTION' | 'FEATURE_MODIFICATION' | 'TOPOLOGY_MASK';
    targetId: string;
    description: string;
    action: string;
  }[];
  diff: EngineeringDiff;
  reasoning: string;
  expectedImpact: {
    massDeltaPercent: number;
    stiffnessDeltaPercent: number;
    costDeltaPercent: number;
  };
  assumptions: string[];
  validationPlan: {
    solversToRun: string[];
    rulesToCheck: string[];
  };
  aiModelConfidence: number; // 0.0 to 1.0 (Model confidence, NOT engineering safety!)
  status: ProposalStatus306;
  createdAt: number;
}

export interface AIEngineeringTool {
  toolId: string;
  name: string;
  description: string;
  requiredPermission: ToolPermissionLevel;
  argumentSchema: Record<string, string>;
  isSolver: boolean;
  execute: (args: Record<string, any>, session: AIDesignSession) => Promise<ToolExecutionResult>;
}

export interface ToolExecutionResult {
  executionId: string;
  toolId: string;
  solverName?: string;
  solverVersion?: string;
  inputHash: string;
  outputHash: string;
  data: any;
  executionTimeMs: number;
  cpuOrGpuUsed: 'CPU' | 'GPU' | 'HPC_CLUSTER';
}

export interface AIDesignReviewItem {
  itemId: string;
  category: ReviewCategory;
  severity: ReviewSeverity;
  title: string;
  description: string;
  flaggedBy: string;
  evidenceSource: string;
  explainability: string;
}

export interface AIDesignReview {
  reviewId: string;
  projectId: string;
  revisionId: string;
  items: AIDesignReviewItem[];
  overallStatus: 'PASS' | 'PASS_WITH_WARNINGS' | 'FAIL';
  createdAt: number;
}

export interface SimulationBudget {
  maxRuntimeMs: number;
  maxJobs: number;
  maxGpuAllocationMb: number;
  maxCpuCores: number;
  currentJobsCount: number;
}

export interface DesignCandidate {
  candidateId: string;
  name: string;
  parameters: Record<string, number>;
  revisionId: string;
  solverResults: {
    solver: string;
    metric: string;
    value: number;
    hash: string;
  }[];
  compositeScore: number;
  status: 'EXPLORED' | 'CANDIDATE' | 'SELECTED' | 'REJECTED';
}

export interface AIProvenanceRecord {
  provenanceId: string;
  userRequest: string;
  sessionId: string;
  contextHash: string;
  modelId: string;
  promptVersion: string;
  policyVersion: string;
  toolCallIds: string[];
  proposalId: string;
  engineerDecision: 'APPROVED' | 'REJECTED' | 'MODIFIED';
  resultingRevisionId: string;
  digitalThreadToken: string;
  signatureSha256: string;
  timestamp: number;
}

export interface AIDesignEvidenceRecord {
  evidenceId: string;
  sessionId: string;
  requestId: string;
  projectId: string;
  revisionId: string;
  userId: string;
  modelId: string;
  modelVersion: string;
  promptVersion: string;
  policyVersion: string;
  contextHash: string;
  toolCallCount: number;
  proposalId: string;
  validationRunsCount: number;
  decision: string;
  outputHash: string;
  digitalThreadToken: string;
  signatureSha256: string;
  timestamp: number;
}

export interface ProductionClassificationStatus306 {
  capability: string;
  status: 'PROVEN' | 'PARTIAL' | 'ABSENT';
  verificationCount: number;
  lastVerifiedAt: number;
}
