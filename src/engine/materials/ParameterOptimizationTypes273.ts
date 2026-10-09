/**
 * PATCH-273: Real Parameter Optimization Types
 * CAD-bound parameter optimization contracts with Feature Tree & GCS driving dimensions.
 */

import { AnalysisResultsSummary } from './OptimizationTypes272';

export type ParameterCategory =
  | 'LENGTH'
  | 'WIDTH'
  | 'HEIGHT'
  | 'THICKNESS'
  | 'DIAMETER'
  | 'RADIUS'
  | 'FILLET_RADIUS'
  | 'CHAMFER_SIZE'
  | 'HOLE_DIAMETER'
  | 'HOLE_SPACING'
  | 'HOLE_POSITION'
  | 'ANGLE'
  | 'DRAFT_ANGLE'
  | 'PATTERN_COUNT'
  | 'PATTERN_SPACING';

export type ParameterDataType =
  | 'LENGTH'
  | 'ANGLE'
  | 'DIAMETER'
  | 'RADIUS'
  | 'INTEGER'
  | 'BOOLEAN'
  | 'ENUMERATION';

export type ParameterDomain = 'CONTINUOUS' | 'INTEGER' | 'DISCRETE';

export interface CADParameterBinding {
  parameterId: string;
  name: string;
  featureId: string;
  featureName: string;
  sketchDimensionId?: string;
  isDrivingDimension: boolean;
  isReferenceDimension: boolean;
  cadModelPath: string;
}

export interface CADParameter {
  parameterId: string;
  name: string;
  category: ParameterCategory;
  dataType: ParameterDataType;
  domain: ParameterDomain;
  binding: CADParameterBinding;
  unit: string;
  internalUnit: string;
  displayUnit: string;
  minValue: number;
  maxValue: number;
  defaultValue: number;
  currentValue: number;
  stepSize?: number;
  discreteValues?: number[];
  isLocked: boolean; // Protected / Locked Parameter
  groupId?: string;
  precision: number;
}

export type DependencyRuleType =
  | 'LESS_THAN'
  | 'GREATER_THAN'
  | 'EQUAL'
  | 'RATIO'
  | 'MINIMUM_WALL_THICKNESS'
  | 'HOLE_CLEARANCE';

export interface ParameterDependencyRule {
  dependencyId: string;
  sourceParameterId: string;
  targetParameterId: string;
  ruleType: DependencyRuleType;
  ratioOrValue: number;
  description: string;
}

export type CADRegenerationStatus =
  | 'SUCCESS'
  | 'SKETCH_REGENERATION_FAILED'
  | 'INVALID_GEOMETRY'
  | 'SELF_INTERSECTION'
  | 'ZERO_THICKNESS'
  | 'NEGATIVE_DIMENSIONS'
  | 'TOPOLOGY_REFERENCE_FAILURE'
  | 'PARAMETER_DEPENDENCY_ERROR';

export type ParameterCandidateStatus =
  | 'VALID'
  | 'INVALID'
  | 'FAILED_PHYSICS'
  | 'FAILED_CONSTRAINT'
  | 'INFEASIBLE'
  | 'CONVERGED'
  | 'REJECTED'
  | 'CAD_FAILED';

export interface ParameterDelta {
  parameterId: string;
  parameterName: string;
  baselineValue: number;
  candidateValue: number;
  deltaValue: number;
  deltaPct: number;
}

export interface ParameterCandidate {
  candidateId: string;
  iteration: number;
  parameterValues: Record<string, number>;
  deltas: ParameterDelta[];
  cadRevision: number;
  meshRevision: number;
  cadStatus: CADRegenerationStatus;
  bRepValid: boolean;
  meshValid: boolean;
  physicsResults: AnalysisResultsSummary;
  objectiveValues: Record<string, number>;
  compositeScore: number;
  constraintViolations: { constraintId: string; violationAmount: number; severity: string }[];
  isFeasible: boolean;
  status: ParameterCandidateStatus;
  parentCandidateId?: string;
  generationMethod: 'INITIAL_BASELINE' | 'PATTERN_SEARCH' | 'SENSITIVITY_GRADIENT' | 'MUTATION';
  evaluationHash: string;
  evaluationTimeMs: number;
}

export interface ParameterInfluence {
  parameterId: string;
  parameterName: string;
  sensitivityMass: number; // dMass / dParam
  sensitivityStress: number; // dStress / dParam
  sensitivityDisplacement: number; // dDisp / dParam
  sensitivityFoS: number; // dFoS / dParam
  influenceRank: number;
  isDrivingParameter: boolean;
}

export interface ParameterOptimizationSensitivity {
  studyId: string;
  influences: ParameterInfluence[];
  topDrivingParameters: string[];
  evaluationMethod: 'FINITE_DIFFERENCES' | 'ANALYTICAL' | 'ADJOINT';
}

export interface ParameterOptimizationConfiguration {
  algorithm: 'DIRECT_PATTERN_SEARCH' | 'SENSITIVITY_GUIDED' | 'DISCRETE_ENUMERATION' | 'HYBRID_MIXED';
  maxEvaluations: number;
  populationSize: number;
  parameterPrecision: number;
  maxAllowedDeltaPct: number;
  randomSeed: number;
  isDeterministic: boolean;
  tolerances: {
    objectiveTolerance: number;
    parameterTolerance: number;
  };
}

export type StudyStatus273 =
  | 'DRAFT'
  | 'QUEUED'
  | 'RUNNING'
  | 'PAUSED'
  | 'COMPLETED'
  | 'MAX_EVALUATIONS_REACHED'
  | 'FAILED'
  | 'CANCELLED';

export interface ParameterOptimizationEvidence {
  evidenceId: string;
  studyHash: string;
  baselineHash: string;
  bestCandidateHash: string;
  candidateHashes: string[];
  parameterHistory: Record<string, number>[];
  solverRevisions: { cadKernel: string; gcsSolver: string; femSolver: string; safetyEngine: string };
  digitalCertificateSHA256: string;
  timestamp: string;
}

export interface ParameterOptimizationSnapshot {
  snapshotId: string;
  timestamp: string;
  studyId: string;
  baselineRevision: number;
  optimalRevision: number;
  baselineCandidate: ParameterCandidate;
  optimalCandidate: ParameterCandidate;
  configuration: ParameterOptimizationConfiguration;
  evidenceHash: string;
}

export interface ParameterOptimizationStudy {
  studyId: string;
  name: string;
  baselineModelPath: string;
  modelRevision: number;
  parameters: CADParameter[];
  dependencies: ParameterDependencyRule[];
  baselineCandidate: ParameterCandidate;
  candidates: ParameterCandidate[];
  bestCandidate: ParameterCandidate;
  sensitivity: ParameterOptimizationSensitivity;
  configuration: ParameterOptimizationConfiguration;
  convergenceHistory: { iteration: number; bestScore: number; maxConstraintViolation: number }[];
  improvementReport: {
    massDeltaPct: number;
    stressDeltaPct: number;
    displacementDeltaPct: number;
    safetyFactorDeltaPct: number;
    overallScoreImprovementPct: number;
  };
  evidence: ParameterOptimizationEvidence;
  status: StudyStatus273;
  optimumClassification: 'MATHEMATICAL_OPTIMUM' | 'FEASIBLE_OPTIMUM' | 'LOCAL_OPTIMUM' | 'BEST_FOUND';
}
