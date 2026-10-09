/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-067: Transient Model Solver
 */

import { TemporalDiscretization } from './TemporalDiscretization';
import { TransientStateValidator } from './TransientStateValidator';

export interface TransientSolverState {
  readonly time: number;
  readonly timestepIndex: number;
  readonly stateValues: readonly number[];
}

export class TransientModel {
  public readonly modelId = 'transient.flow-model';
  public readonly version = '1.0.0';

  public advanceSolve(
    stateValues: readonly number[],
    rhs: readonly number[],
    dt: number,
    currentTime: number,
    timestepIndex: number
  ): TransientSolverState {
    const previousTime = currentTime;
    const nextTime = currentTime + dt;

    const validation = TransientStateValidator.validateTimeStep(dt, nextTime, previousTime);
    if (!validation.valid) {
      throw new Error(`TRANSIENT_SOLVER_ERROR: ${validation.error} - ${validation.detail}`);
    }

    const nextValues = TemporalDiscretization.advanceExplicitEuler(stateValues, rhs, dt);

    return {
      time: nextTime,
      timestepIndex: timestepIndex + 1,
      stateValues: nextValues
    };
  }
}
