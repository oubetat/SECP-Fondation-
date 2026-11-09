export type SearchStrategyType =
  | 'BAYESIAN_OPTIMIZATION'
  | 'EVOLUTIONARY_SEARCH'
  | 'GENETIC_ALGORITHM'
  | 'SIMULATED_ANNEALING'
  | 'PARTICLE_SWARM'
  | 'GRADIENT_DESCENT';

export interface HardConstraintDefinition {
  constraintId: string;
  parameterName: string;
  operator: '<=' | '>=' | '==' | string;
  targetValue: number;
  unit?: string;
  source?: string;
}

export interface OptimizationVariable {
  name: string;
  min: number;
  max: number;
  step?: number;
  currentValue?: number;
  unit?: string;
}

export interface OptimizationObjective {
  objectiveId: string;
  name: string;
  goal: 'MINIMIZE' | 'MAXIMIZE' | string;
  unit?: string;
  weight?: number;
  source?: string;
}

export interface OptimizationStoppingCriteria {
  maxIterations: number;
  maxEvaluations?: number;
  maxRuntimeSeconds?: number;
  toleranceDelta?: number;
}

export interface EngineeringOptimizationProblem {
  problemId: string;
  title: string;
  description: string;
  variables: OptimizationVariable[];
  objectives?: OptimizationObjective[];
  constraints?: HardConstraintDefinition[];
  stoppingCriteria: OptimizationStoppingCriteria;
}

export interface OptimizationMetric {
  metricId?: string;
  name: string;
  value: number;
  unit?: string;
  source?: string;
  solver?: string;
}

export interface OptimizationCandidate {
  id?: string;
  candidateId: string;
  iteration?: number;
  parentCandidateId?: string;
  parameters: Record<string, number>;
  status: 'INITIAL' | 'SOLVING' | 'VALIDATED' | 'INFEASIBLE' | 'REGRESSION' | 'PARETO' | 'SELECTED' | string;
  cadValidated?: boolean;
  physicsValidated?: boolean;
  metrics: Record<string, { value: number; unit?: string; [key: string]: any }>;
  massKg?: number;
  maxStressMpa?: number;
  maxDisplacementMm?: number;
  constraintViolations?: any[];
  overallScore: number;
  isParetoOptimal: boolean;
  paretoOptimal?: boolean;
  candidateHash?: string;
  timestamp?: number;
}

export interface OptimizationEvaluation {
  evaluationId: string;
  candidateId: string;
  solver?: string;
  solverVersion?: string;
  inputHash?: string;
  executionId?: string;
  status?: string;
  metrics: Record<string, any>;
  runtimeMs?: number;
  resultHash?: string;
  timestamp?: number;
  success?: boolean;
  overallScore?: number;
  constraintViolations?: any[];
  executionDurationMs?: number;
}

export interface AIOptimizationPolicy {
  policyVersion?: string;
  autonomyLevel?: string;
  allowedSolvers?: string[];
  maxIterations?: number;
  maxEvaluations?: number;
  maxRuntimeSeconds?: number;
  convergenceThreshold?: number;
  maxCpuCores?: number;
  maxGpuUnits?: number;
  sandboxIsolated?: boolean;
  strategy?: SearchStrategyType;
}

export interface AIOptimizationSession {
  sessionId: string;
  projectId?: string;
  baseRevisionId?: string;
  problem: EngineeringOptimizationProblem;
  policy?: AIOptimizationPolicy;
  status: 'INITIALIZING' | 'INITIALIZED' | 'RUNNING' | 'CONVERGED' | 'STOPPED_MAX_ITERATIONS' | 'COMPLETED' | string;
  currentIteration: number;
  candidates: OptimizationCandidate[];
  bestCandidate?: OptimizationCandidate;
  createdAt?: number;
  updatedAt?: number;
}
