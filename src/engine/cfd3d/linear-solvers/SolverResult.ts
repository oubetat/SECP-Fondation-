/**
 * SECP Industrial OS v2 — Linear Solvers Architecture
 * PATCH-055: Solver Result Contract
 */

import { SparseVector } from './SparseVector';
import { SolverDiagnostic } from './SolverDiagnostics';

export type SolverStatus = 
  | 'CONVERGED'
  | 'NOT_CONVERGED'
  | 'DIVERGED'
  | 'INVALID_SYSTEM'
  | 'BREAKDOWN'
  | 'MAX_ITERATIONS'
  | 'UNSUPPORTED'
  | 'INCONCLUSIVE';

export interface ResidualNorms {
  readonly l2: number;
  readonly linfinity: number;
  readonly normalized: number;
}

export interface SolverResult {
  readonly solution: SparseVector;
  readonly status: SolverStatus;
  readonly iterations: number;
  readonly initialResidual: ResidualNorms;
  readonly finalResidual: ResidualNorms;
  readonly residualHistory: number[];
  readonly convergence: boolean;
  readonly diagnostics: SolverDiagnostic[];
  readonly solverId: string;
  readonly configurationHash: string;
}
