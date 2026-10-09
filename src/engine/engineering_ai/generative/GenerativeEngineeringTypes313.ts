/**
 * PHASE 28 — ENGINEERING AI
 * PATCH-313 — Generative Engineering
 * Type Definitions & Data Structures
 * 
 * CORE PRINCIPLE:
 * GENERATED ≠ VALIDATED ≠ APPROVED
 * AI generates candidate native CAD structures within explicit bounds.
 * Deterministic CAD Kernels, Solvers, and CAM Validators supply evidence.
 * Engineers maintain sole decision authority to promote and release candidates.
 */

export type GenerationStatus =
  | 'DRAFT'
  | 'CONFIGURED'
  | 'GENERATING'
  | 'VALIDATING'
  | 'RANKING'
  | 'REQUIRES_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED';

export type GenerationMethod =
  | 'PARAMETRIC_GENERATION'
  | 'TOPOLOGY_GENERATION'
  | 'SHAPE_GENERATION'
  | 'FEATURE_GENERATION'
  | 'HYBRID_GENERATION';

export type FeasibilityClassification =
  | 'FEASIBLE'
  | 'INFEASIBLE'
  | 'UNKNOWN';

export type ValidationState =
  | 'GENERATED'
  | 'GEOMETRY_VALID'
  | 'ENGINEERING_VALID'
  | 'MANUFACTURING_VALID'
  | 'FULLY_VALIDATED'
  | 'REJECTED'
  | 'UNKNOWN';

export type ConstraintType = 'HARD_CONSTRAINT' | 'SOFT_CONSTRAINT';

export interface RequirementItem {
  requirementId: string;
  name: string;
  type: ConstraintType;
  category: 'SAFETY' | 'FUNCTIONAL' | 'MANUFACTURING' | 'REGULATORY' | 'PERFORMANCE' | 'COST' | 'WEIGHT';
  targetValue: number;
  unit: string;
  operator: 'LESS_THAN_EQUAL' | 'GREATER_THAN_EQUAL' | 'EQUAL';
  priority: number; // Hierarchy: Safety (1) -> Functional (2) -> Manufacturing (3) -> Regulatory (4) -> Performance (5) -> Cost (6) -> Weight (7)
  source: string;
  createdAt: string;
}

export interface EngineeringRequirementSet {
  requirementSetId: string;
  name: string;
  requirements: RequirementItem[];
  maximumMassKg?: number;
  minimumYieldSafetyFactor?: number;
  maximumDisplacementMm?: number;
  maximumAllowableStressMPa?: number;
  operatingTemperatureC?: number;
  envelopeDimensionsMm?: [number, number, number];
  manufacturingMethod?: '3_AXIS_MILL' | '5_AXIS_MILL' | 'SLS_ADDITIVE' | 'CASTING';
}

export interface DesignSpace {
  spaceId: string;
  allowedVolumeM3: number;
  forbiddenVolumeM3: number;
  preservedInterfaces: Array<{
    interfaceId: string;
    name: string;
    location: [number, number, number];
    type: 'MOUNTING' | 'BEARING' | 'BOLT_PATTERN' | 'FLUID_PORT';
  }>;
  variableRegions: Array<{
    regionId: string;
    name: string;
    maxVolumeM3: number;
  }>;
  exclusionRegions: Array<{
    regionId: string;
    description: string;
  }>;
}

export interface ParameterBound {
  parameterName: string;
  min: number;
  max: number;
  unit: string;
  step?: number;
  defaultValue: number;
}

export interface GenerativeParameterSpace {
  parameters: ParameterBound[];
  materialChoices: string[];
  manufacturingLimits: {
    minWallThicknessMm: number;
    minRadiusMm: number;
    maxPocketDepthMm: number;
    toolAccessAngleDeg: number;
  };
}

export type ObjectiveType =
  | 'MINIMIZE_WEIGHT'
  | 'MINIMIZE_COST'
  | 'MINIMIZE_DISPLACEMENT'
  | 'MINIMIZE_STRESS'
  | 'MINIMIZE_PRESSURE_DROP'
  | 'MINIMIZE_MATERIAL'
  | 'MINIMIZE_MACHINING_TIME'
  | 'MAXIMIZE_STIFFNESS'
  | 'MAXIMIZE_FLOW_PERFORMANCE'
  | 'MAXIMIZE_SAFETY_MARGIN';

export interface EngineeringObjective {
  objectiveId: string;
  type: ObjectiveType;
  weight: number; // 0.0 - 1.0
  unit: string;
  targetDirection: 'MINIMIZE' | 'MAXIMIZE';
}

export interface ConstraintViolation {
  constraintId: string;
  candidateId: string;
  metricName: string;
  actualValue: number;
  requiredValue: number;
  violationAmount: number;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  type: ConstraintType;
}

export interface NativeCADFeatureTree {
  features: Array<{
    featureId: string;
    type: 'BASE_SKETCH' | 'EXTRUDE_BOSS' | 'CUT_REVOLVE' | 'FILLET' | 'HOLE_PATTERN' | 'LATTICE_FILL';
    name: string;
    parameters: Record<string, number | string>;
    isSuppressed: boolean;
  }>;
  bRepValid: boolean;
  manifold: boolean;
  selfIntersecting: boolean;
}

export interface GeneratedDesignCandidate {
  candidateId: string;
  generationSessionId: string;
  candidateNumber: number;
  parentCandidateId?: string;
  revisionId: string;
  generationMethod: GenerationMethod;
  geometryHash: string;
  parameterHash: string;
  nativeCad: NativeCADFeatureTree;
  material: string;
  metrics: {
    massKg: number;
    maxVonMisesStressMPa: number;
    maxDisplacementMm: number;
    safetyFactorFoS: number;
    fatigueLifeCycles?: number;
    machiningTimeMin: number;
    costUSD: number;
    volumeM3: number;
  };
  evidence: {
    cadKernelOutput: string;
    femSolverOutput: string;
    camValidatorOutput: string;
    simulationConverged: boolean; // Rule 84: Non-converged prevents validation
  };
  feasibility: FeasibilityClassification; // FEASIBLE vs INFEASIBLE vs UNKNOWN (Rule 77: UNKNOWN != FEASIBLE)
  validationState: ValidationState;
  violations: ConstraintViolation[];
  paretoStatus: {
    isParetoOptimal: boolean;
    rank: number;
    dominatedByCount: number;
  };
  rankScore?: number;
  rankExplanation?: string;
  engineerSelection?: {
    isSelected: boolean;
    reason?: string;
    selectedBy?: string;
    selectedAt?: string;
  };
}

export interface GenerationBudget {
  maxCandidates: number;
  maxSolverRuns: number;
  maxComputeTimeSec: number;
  gpuWorkersAllocated: number;
}

export interface GenerativeDesignSession {
  sessionId: string;
  projectId: string;
  designId: string;
  sourceRevisionId: string;
  userId: string;
  requirementSet: EngineeringRequirementSet;
  designSpace: DesignSpace;
  parameterSpace: GenerativeParameterSpace;
  objectives: EngineeringObjective[];
  budget: GenerationBudget;
  aiModelVersion: string;
  generationPolicyVersion: string;
  randomSeed: number;
  status: GenerationStatus;
  createdAt: string;
  candidates: GeneratedDesignCandidate[];
  paretoFront: GeneratedDesignCandidate[];
  selectedCandidateId?: string;
  promotedRevisionId?: string;
}

export interface GenerativeEngineeringReport {
  reportId: string;
  sessionId: string;
  requirementSummary: string;
  totalCandidatesGenerated: number;
  feasibleCandidatesCount: number;
  paretoFrontCount: number;
  selectedCandidate?: GeneratedDesignCandidate;
  tradeoffAnalysis: Array<{ candidateId: string; massKg: number; maxStressMPa: number; costUSD: number; rank: number }>;
  digitalThreadChain: string[];
  provenance: {
    aiModel: string;
    policyVersion: string;
    cadKernel: string;
    femSolver: string;
    camValidator: string;
    seed: number;
    timestamp: string;
  };
}
