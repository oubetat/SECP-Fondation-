/**
 * SECP Industrial OS v2 — Linear Solvers Architecture
 * PATCH-055: Solver Configuration
 */

export interface SolverConfiguration {
  readonly absoluteTolerance: number;
  readonly relativeTolerance: number;
  readonly maxIterations: number;
  readonly divergenceThreshold: number;
  readonly stagnationWindow: number;
}

export const DEFAULT_SOLVER_CONFIGURATION: SolverConfiguration = {
  absoluteTolerance: 1e-8,
  relativeTolerance: 1e-6,
  maxIterations: 1000,
  divergenceThreshold: 1e6,
  stagnationWindow: 20
};
