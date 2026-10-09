export type SearchStrategyType = 'BAYESIAN_OPTIMIZATION' | 'GENETIC_ALGORITHM' | 'SIMULATED_ANNEALING' | 'PARTICLE_SWARM';

export interface EngineeringOptimizationProblem {
  problemId: string;
  title: string;
  description: string;
}

export interface OptimizationCandidate {
  id: string;
  massKg: number;
  maxStressMpa: number;
  maxDisplacementMm: number;
  paretoOptimal: boolean;
}

export interface AIOptimizationPolicy {
  maxIterations: number;
  convergenceThreshold: number;
}

export interface AIOptimizationSession {
  sessionId: string;
  status: 'COMPLETED' | 'RUNNING' | 'INITIALIZED';
  candidates: OptimizationCandidate[];
  bestCandidate?: OptimizationCandidate;
}
