/**
 * PATCH-272: Real Engineering Optimization Types
 * Multi-objective, CAD-bound, physics-rebuilding optimization kernel data contracts.
 */

import { StressTensor3D } from './FailureTypes270';
import { SafetyAssessment } from './SafetyTypes271';

export type VariableCategory =
  | 'DIMENSION'
  | 'THICKNESS'
  | 'DIAMETER'
  | 'LENGTH'
  | 'WIDTH'
  | 'HEIGHT'
  | 'FILLET_RADIUS'
  | 'HOLE_DIAMETER'
  | 'HOLE_POSITION'
  | 'MATERIAL_SELECTION'
  | 'GEOMETRIC_PARAMETER'
  | 'ENERGY_CAPACITY'
  | 'PROPULSION_PARAMETER'
  | 'MISSION_PARAMETER';

export interface ParameterBinding {
  variableId: string;
  cadParameterName: string;
  featureId: string;
  geometryId: string;
  meshRegionId: string;
}

export interface DesignVariable {
  variableId: string;
  name: string;
  category: VariableCategory;
  binding: ParameterBinding;
  minValue: number;
  maxValue: number;
  defaultValue: number;
  currentValue: number;
  unit: string;
  isLocked: boolean; // Protected parameter
  isValid: boolean;
  source: string;
}

export type DependencyOperator = 'LESS_THAN' | 'GREATER_THAN' | 'RATIO' | 'EQUAL';

export interface ParameterDependency {
  dependencyId: string;
  sourceVariableId: string;
  targetVariableId: string;
  operator: DependencyOperator;
  ratioOrValue: number;
  description: string;
}

export type ConstraintType =
  | 'GEOMETRIC'
  | 'STRUCTURAL_STRESS'
  | 'STRUCTURAL_DISPLACEMENT'
  | 'STRUCTURAL_BUCKLING'
  | 'SAFETY_FACTOR'
  | 'FAILURE_INDEX'
  | 'FATIGUE_LIFE'
  | 'THERMAL_TEMPERATURE'
  | 'CFD_PRESSURE_DROP'
  | 'PROPULSION_THRUST_MARGIN'
  | 'MISSION_ENERGY_LIMIT'
  | 'MISSION_ENDURANCE_LIMIT';

export type ConstraintOperator = 'LE' | 'GE' | 'EQ';
export type ConstraintSeverity = 'WARNING' | 'CONSTRAINT' | 'HARD_CONSTRAINT';

export interface EngineeringConstraint {
  constraintId: string;
  type: ConstraintType;
  name: string;
  limitValue: number;
  operator: ConstraintOperator;
  achievedValue: number;
  unit: string;
  severity: ConstraintSeverity;
  isSatisfied: boolean;
  violationAmount: number;
  sourceRule: string;
}

export type ObjectiveType =
  | 'MINIMIZE_MASS'
  | 'MINIMIZE_VOLUME'
  | 'MINIMIZE_COST'
  | 'MINIMIZE_DISPLACEMENT'
  | 'MAXIMIZE_STIFFNESS'
  | 'MINIMIZE_PRESSURE_DROP'
  | 'MAXIMIZE_MISSION_ENDURANCE'
  | 'MINIMIZE_ENERGY_CONSUMPTION'
  | 'MAXIMIZE_THRUST_MARGIN';

export type ObjectiveDirection = 'MINIMIZE' | 'MAXIMIZE' | 'TARGET';

export interface OptimizationObjective {
  objectiveId: string;
  type: ObjectiveType;
  name: string;
  direction: ObjectiveDirection;
  targetValue?: number;
  unit: string;
  weight: number;
  rawBaselineValue: number;
  rawCurrentValue: number;
  normalizedValue: number;
}

export type CandidateStatus =
  | 'VALID'
  | 'INVALID'
  | 'FAILED_PHYSICS'
  | 'FAILED_CONSTRAINT'
  | 'INFEASIBLE'
  | 'CONVERGED'
  | 'REJECTED'
  | 'CAD_REGENERATION_FAILED';

export interface AnalysisResultsSummary {
  massKg: number;
  volumeM3: number;
  manufacturingCostUSD: number;
  maxVonMisesStressPa: number;
  maxDisplacementMm: number;
  safetyFactorFoS: number;
  failureIndex: number;
  fatigueDamageRatio: number;
  maxTempC: number;
  pressureDropPa: number;
  femSolverStatus: 'PROVEN' | 'SIMULATED' | 'FAILED';
  cfdSolverStatus: 'PROVEN' | 'SIMULATED' | 'FAILED' | 'NOT_APPLICABLE';
  // Multidisciplinary Drone Metrics
  missionEnduranceS?: number;
  totalEnergyConsumedJ?: number;
  thrustMargin?: number;
  payloadMassKg?: number;
}

export interface DesignCandidate {
  candidateId: string;
  iteration: number;
  parameters: Record<string, number>;
  cadRevision: number;
  meshRevision: number;
  cadRegenerationSuccess: boolean;
  bRepTopologyValid: boolean;
  meshIntegrityValid: boolean;
  analysisResults: AnalysisResultsSummary;
  constraints: EngineeringConstraint[];
  objectives: OptimizationObjective[];
  compositeObjectiveScore: number;
  isFeasible: boolean;
  status: CandidateStatus;
  parentCandidateId?: string;
  generationMethod: 'INITIAL_BASELINE' | 'GRADIENT_STEP' | 'PATTERN_SEARCH' | 'MUTATION';
  evaluationHash: string;
  evaluationTimeMs: number;
}

export interface ParetoFront {
  nonDominatedCandidates: DesignCandidate[];
  dominatedCandidates: DesignCandidate[];
  tradeOffMatrix: { candidateA: string; candidateB: string; dominance: 'DOMINATES' | 'DOMINATED' | 'INCOMPARABLE' }[];
}

export type OptimizationAlgorithm =
  | 'GRADIENT_DESCENT'
  | 'DIRECT_PATTERN_SEARCH'
  | 'GENETIC_ALGORITHM'
  | 'HYBRID_GLOBAL_LOCAL';

export interface OptimizationConfiguration {
  algorithm: OptimizationAlgorithm;
  maxEvaluations: number;
  populationSize: number;
  tolerances: {
    objectiveTolerance: number;
    parameterTolerance: number;
    constraintTolerance: number;
  };
  parallelism: number;
  randomSeed: number;
  isDeterministic: boolean;
  convergenceCriteria: {
    maxConsecutiveNoImprovement: number;
    targetObjectiveThreshold?: number;
  };
  customSolver?: (params: Record<string, number>, materialId: string) => Promise<AnalysisResultsSummary>;
}

export type OptimizationStudyStatus =
  | 'DRAFT'
  | 'QUEUED'
  | 'RUNNING'
  | 'PAUSED'
  | 'COMPLETED'
  | 'MAX_EVALUATIONS_REACHED'
  | 'FAILED'
  | 'CANCELLED';

export interface OptimizationImprovementMetrics {
  massReductionPct: number;
  stressReductionPct: number;
  displacementReductionPct: number;
  safetyFactorIncreasePct: number;
  overallImprovementPct: number;
}

export interface OptimizationSnapshot {
  snapshotId: string;
  timestamp: string;
  studyId: string;
  modelRevision: number;
  materialRevision: number;
  baselineCandidate: DesignCandidate;
  optimalCandidate: DesignCandidate;
  configuration: OptimizationConfiguration;
  evidenceHash: string;
}

export interface OptimizationEvidence {
  evidenceId: string;
  studyHash: string;
  baselineHash: string;
  optimalCandidateHash: string;
  candidateHashes: string[];
  parameterHistory: Record<string, number>[];
  solverRevisions: { cadKernel: string; femSolver: string; cfdSolver: string; safetyEngine: string };
  digitalCertificateSHA256: string;
  timestamp: string;
}

export interface OptimizationStudy {
  studyId: string;
  name: string;
  modelRevision: number;
  variables: DesignVariable[];
  dependencies: ParameterDependency[];
  objectives: OptimizationObjective[];
  constraints: EngineeringConstraint[];
  configuration: OptimizationConfiguration;
  candidates: DesignCandidate[];
  baselineCandidate: DesignCandidate;
  bestCandidate: DesignCandidate;
  paretoFront: ParetoFront;
  improvementMetrics: OptimizationImprovementMetrics;
  convergenceData: { iteration: number; bestObjective: number; maxConstraintViolation: number }[];
  evidence: OptimizationEvidence;
  status: OptimizationStudyStatus;
  benchmarkValidation?: {
    isBenchmark: boolean;
    analyticalOptimumValue: number;
    achievedErrorPct: number;
    validationStatus: 'PASSED' | 'FAILED';
  };
}
