/**
 * SECP CAD Kernel — GCS 3D Solver Entrance Point
 * Phase 2 (PATCH-026)
 */

import { Model3D } from './Constraint3DTypes';
import { Constraint3D } from './Constraint3DModel';
import { Constraint3DSolverResult } from './Constraint3DSolverResult';
import { Deterministic3DSolver } from './Deterministic3DSolver';

export class Constraint3DSolver {
  /**
   * Primary solver entry point. Solves the 3D model under the constraints
   * deterministically using a damped Gauss-Newton solver.
   */
  public static solve(
    model: Model3D,
    constraints: readonly Constraint3D[],
    options?: { maxIterations?: number; tolerance?: number }
  ): Constraint3DSolverResult {
    return Deterministic3DSolver.solve(model, constraints, options);
  }
}
