/**
 * SECP Industrial OS - PATCH-308 Design Alternatives Types
 * Multi-objective design space exploration, candidate lifecycle, native parametric variants,
 * solver evaluation metrics, Pareto optimality analysis, comparison matrices, and PLM branch linkage.
 */

export type AlternativeStatus =
  | 'DRAFT'
  | 'GENERATED'
  | 'VALIDATING'
  | 'VALIDATED'
  | 'FAILED'
  | 'REJECTED'
  | 'SELECTED'
  | 'ARCHIVED';

export type StrategyType =
  | 'PARAMETRIC'
  | 'FEATURE_BASED'
  | 'TOPOLOGY_BASED'
  | 'MATERIAL_BASED'
  | 'MANUFACTURING_BASED'
  | 'MULTI_OBJECTIVE';

export type RequirementSource =
  | 'USER'
  | 'STANDARD'
  | 'PROJECT'
  | 'ENGINEERING_RULE'
  | 'AI_PROPOSAL';

export type ObjectiveGoal =
  | 'MINIMIZE_MASS'
  | 'MAXIMIZE_STIFFNESS'
  | 'MINIMIZE_COST'
  | 'IMPROVE_MANUFACTURABILITY'
  | 'IMPROVE_THERMAL';

export interface PerformanceMetric {
  metricId: string;
  name: string;
  value: number;
  unit: string;
  source: RequirementSource;
  solver: string;
  solverVersion: string;
  executionId: string;
  timestamp: number;
}

export interface HardConstraint {
  constraintId: string;
  parameterName: string;
  operator: '<=' | '>=' | '==';
  targetValue: number;
  unit: string;
  source: RequirementSource;
}

export interface EngineeringObjective {
  objectiveId: string;
  goal: ObjectiveGoal;
  weight: number; // 0.0 to 1.0
  isPrimary: boolean;
}

export interface DesignAlternative {
  alternativeId: string;
  projectId: string;
  baseRevisionId: string;
  branchId: string;
  parentAlternativeId?: string;
  name: string;
  description: string;
  strategyType: StrategyType;
  designIntent: string;
  parameters: Record<string, number | string>;
  features: string[];
  materialName: string;
  manufacturingProcess: string;
  status: AlternativeStatus;
  cadValidated: boolean;
  physicsValidated: boolean;
  manufacturingValidated: boolean;
  metrics: Record<string, PerformanceMetric>;
  constraintResults: Record<string, { satisfied: boolean; details: string }>;
  overallScore: number;
  isParetoOptimal: boolean;
  failureReason?: string;
  createdBy: string;
  createdAt: number;
  digitalThreadToken: string;
}

export interface DesignAlternativeSet {
  setId: string;
  projectId: string;
  baseRevisionId: string;
  requirements: string[];
  objectives: EngineeringObjective[];
  hardConstraints: HardConstraint[];
  alternatives: DesignAlternative[];
  selectedAlternativeId?: string;
  createdAt: number;
}

export interface DesignComparisonMatrix {
  alternativeIds: string[];
  metricNames: string[];
  matrix: Record<string, Record<string, number | string>>; // alternativeId -> metricName -> value
  scores: Record<string, number>;
  paretoFront: string[];
}
