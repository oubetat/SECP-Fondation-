/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-061: Laminar Convergence Checker
 */

import { IterationResiduals, LaminarSolverVerdict } from './LaminarSolverTypes';
import { LaminarSolverConfig } from './LaminarSolverConfig';

export class LaminarConvergence {
  public static check(
    residuals: IterationResiduals,
    config: LaminarSolverConfig,
    iterationIndex: number
  ): LaminarSolverVerdict {
    if (residuals.maxResidual < config.absoluteContinuityTolerance) {
      return LaminarSolverVerdict.CONVERGED;
    }

    if (residuals.maxResidual > 1e10 || isNaN(residuals.maxResidual)) {
      return LaminarSolverVerdict.DIVERGED;
    }

    if (iterationIndex >= config.maxIterations) {
      return LaminarSolverVerdict.NOT_CONVERGED;
    }

    return LaminarSolverVerdict.NOT_CONVERGED;
  }
}
