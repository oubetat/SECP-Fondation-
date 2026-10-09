export type DesignVariableType =
  | 'CONTINUOUS'
  | 'INTEGER'
  | 'DISCRETE'
  | 'CATEGORICAL'
  | 'BOOLEAN'
  | 'GEOMETRIC'
  | 'MATERIAL'
  | 'PROCESS'
  | 'BOUNDARY_CONDITION'
  | 'MESH_PARAMETER';

export type ConstraintSeverity = 'HARD_CONSTRAINT' | 'SOFT_CONSTRAINT';

export type ObjectiveDirection = 'MINIMIZE' | 'MAXIMIZE' | 'TARGET';

export type OptimizationVerdict =
  | 'VERIFIED_OPTIMUM'
  | 'VERIFIED_PARETO_OPTIMUM'
  | 'FEASIBLE_DESIGN'
  | 'FEASIBLE_NON_OPTIMAL'
  | 'LOCAL_OPTIMUM'
  | 'GLOBAL_OPTIMUM_NOT_PROVEN'
  | 'INFEASIBLE'
  | 'BUDGET_EXHAUSTED'
  | 'CONVERGENCE_FAILURE'
  | 'VERIFICATION_FAILURE'
  | 'INSUFFICIENT_EVIDENCE'
  | 'NO_VERIFIED_OPTIMUM_FOUND';

export type CandidateStatus =
  | 'GENERATED'
  | 'GEOMETRY_CHECKED'
  | 'SIMULATION_QUEUED'
  | 'SIMULATED'
  | 'EVALUATED'
  | 'FEASIBLE'
  | 'INFEASIBLE'
  | 'VERIFIED'
  | 'REJECTED';

export interface DesignVariable {
  variableId: string;
  name: string;
  type: DesignVariableType;
  unit: string;
  lowerBound: number;
  upperBound: number;
  defaultValue: number;
  step?: number;
  discreteValues?: any[];
  dependencies?: string[];
}

export interface EngineeringConstraint {
  constraintId: string;
  expression: string;
  type: string;
  operator: '<=' | '>=' | '==' | 'IN_RANGE' | 'NOT_IN_RANGE' | 'DISCRETE_MATCH' | 'BOOLEAN';
  limit: number | [number, number];
  unit: string;
  tolerance: number;
  severity: ConstraintSeverity;
}

export interface OptimizationObjective {
  objectiveId: string;
  name: string;
  expression: string;
  direction: ObjectiveDirection;
  weight: number;
  priority: number;
  unit: string;
}

export interface OptimizationProblem {
  problemId: string;
  designId: string;
  variables: DesignVariable[];
  objectives: OptimizationObjective[];
  constraints: EngineeringConstraint[];
  terminationCriteria: {
    maxEvaluations: number;
    maxIterations: number;
    objectiveTolerance: number;
  };
}

export interface OptimizationCandidate {
  candidateId: string;
  designVariables: Record<string, any>;
  geometryHash: string;
  simulationId?: string;
  objectiveValues: Record<string, number>;
  constraintViolations: ConstraintViolation[];
  feasibility: boolean;
  status: CandidateStatus;
  verificationStatus: 'PENDING' | 'PASSED' | 'FAILED';
}

export interface ConstraintViolation {
  constraintId: string;
  observedValue: number;
  limit: number | [number, number];
  violationAmount: number;
  severity: ConstraintSeverity;
}

export interface OptimizationEvidenceBundle {
  problemId: string;
  optimizationHash: string;
  candidateHistory: OptimizationCandidate[];
  finalVerdict: OptimizationVerdict;
  verificationResults: any;
}
