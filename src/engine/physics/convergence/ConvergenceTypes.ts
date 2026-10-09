/**
 * SECP Industrial OS v2 — Convergence Types
 * PATCH-049: Numerical Convergence Framework
 */

export interface ResidualValue {
  quantity: string;
  value: number;
  normalized?: number;
}

export interface IterationRecord {
  iteration: number;
  simulationTime?: number;
  residuals: ResidualValue[];
  normalizedResiduals?: ResidualValue[];
  absoluteError?: number;
  relativeError?: number;
  nonlinearNorm?: number;
  linearNorm?: number;
  timestamp?: number;
  metadata?: Record<string, unknown>;
}

export type ConvergenceCriterionType = 
  | 'ABSOLUTE_RESIDUAL'
  | 'RELATIVE_RESIDUAL'
  | 'ABSOLUTE_ERROR'
  | 'RELATIVE_ERROR'
  | 'CHANGE_BETWEEN_ITERATIONS'
  | 'MAX_ITERATIONS'
  | 'STEADY_STATE'
  | 'TRANSIENT_STEP_CONVERGENCE';

export interface ConvergenceCriterion {
  type: ConvergenceCriterionType;
  quantity?: string; // Target field, e.g. "mass", "momentum", "energy", "displacement", "pressure"
  tolerance?: number;
  minimumIterations?: number;
  maximumIterations?: number;
  required: boolean;
  floor?: number; // Minimum floor for relative division
}

export type AggregationStrategy = 'ALL_REQUIRED' | 'ANY_REQUIRED' | 'WEIGHTED';

export type ConvergenceStatus = 
  | 'CONVERGED'
  | 'NOT_CONVERGED'
  | 'DIVERGED'
  | 'STAGNATED'
  | 'MAX_ITERATIONS_REACHED'
  | 'INSUFFICIENT_DATA'
  | 'INVALID';

export type DivergenceReason = 
  | 'DIVERGENCE_RESIDUAL_GROWTH'
  | 'NUMERICAL_OVERFLOW'
  | 'INVALID_VALUE'
  | 'OSCILLATORY_INSTABILITY'
  | 'UNKNOWN';

export type MonotonicityTrend = 
  | 'MONOTONIC_DECREASE'
  | 'NON_MONOTONIC'
  | 'MONOTONIC_INCREASE'
  | 'INSUFFICIENT_DATA';

export interface CriterionResult {
  criterion: ConvergenceCriterion;
  observedValue: number;
  tolerance: number;
  satisfied: boolean;
  iterationsEvaluated: number;
  reason: string;
}

export interface ConvergenceDiagnostic {
  type: 'STAGNATION' | 'DIVERGENCE' | 'OSCILLATION' | 'ANOMALY';
  message: string;
  iteration?: number;
  quantity?: string;
  details?: Record<string, unknown>;
}

export interface ConvergenceAssessment {
  status: ConvergenceStatus;
  criteriaResults: CriterionResult[];
  diagnostics: ConvergenceDiagnostic[];
  iterations: number;
  finalResiduals: ResidualValue[];
  trend: MonotonicityTrend;
  divergenceReason?: DivergenceReason;
  confidence?: 'HIGH' | 'MEDIUM' | 'LOW';
}
