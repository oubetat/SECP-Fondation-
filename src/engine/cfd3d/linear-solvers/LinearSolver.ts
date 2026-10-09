/**
 * SECP Industrial OS v2 — Linear Solvers Architecture
 * PATCH-055: LinearSolver Interface
 */

import { LinearSystem } from './LinearSystem';
import { SolverConfiguration } from './SolverConfiguration';
import { SolverResult } from './SolverResult';
import { Preconditioner } from './Preconditioner';

export interface LinearSolver {
  readonly id: string;
  readonly version: string;

  solve(
    system: LinearSystem,
    configuration: SolverConfiguration,
    preconditioner?: Preconditioner
  ): SolverResult;
}
