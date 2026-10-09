/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-067: Transient Solver Replay Mechanism
 */

import { TransientModel, TransientSolverState } from './TransientModel';

export class TransientSolverReplay {
  public static replayTransientRun(
    initialState: readonly number[],
    rhsHistory: readonly (readonly number[])[],
    dtSequence: readonly number[],
    startTime: number
  ): TransientSolverState[] {
    const model = new TransientModel();
    const states: TransientSolverState[] = [];
    let current = { time: startTime, timestepIndex: 0, stateValues: initialState };
    states.push(current);

    const steps = dtSequence.length;
    for (let i = 0; i < steps; i++) {
      const dt = dtSequence[i];
      const rhs = rhsHistory[i];
      current = model.advanceSolve(current.stateValues, rhs, dt, current.time, current.timestepIndex);
      states.push(current);
    }

    return states;
  }
}
