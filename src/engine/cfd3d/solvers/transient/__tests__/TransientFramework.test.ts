/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-067: Transient Flow Core Framework Tests
 */

import { describe, it, expect } from 'vitest';
import { TransientModel } from '../TransientModel';
import { SinusoidalTimeFunction } from '../TransientTypes';
import { TransientRollbackManager } from '../TransientRollbackManager';
import { TransientCFLController } from '../TransientCFLController';
import { TransientStateHistory } from '../TransientStateHistory';
import { IndependentTransientVerifier } from '../IndependentTransientVerifier';
import { TransientSolverReplay } from '../TransientSolverReplay';
import { TransientCFDEvidence } from '../TransientCFDEvidence';

describe('PATCH-067: Transient Flow Core Framework Tests', () => {
  const model = new TransientModel();

  it('Verify Time Derivative and Explicit Euler Step Advancement', () => {
    const initialState = [10.0, 10.0];
    const rhs = [-1.0, -2.0];
    const dt = 0.5;

    const nextState = model.advanceSolve(initialState, rhs, dt, 0.0, 0);

    expect(nextState.time).toBe(0.5);
    expect(nextState.timestepIndex).toBe(1);
    expect(nextState.stateValues[0]).toBe(9.5); // 10.0 + 0.5 * -1.0 = 9.5
    expect(nextState.stateValues[1]).toBe(9.0); // 10.0 + 0.5 * -2.0 = 9.0
  });

  it('Verify Sinusoidal Boundary Forcing Function', () => {
    const fn = new SinusoidalTimeFunction(2.0, 10.0, 0.0); // amp=2.0, freq=10Hz
    
    // sin(0) = 0
    expect(fn.evaluate(0.0)).toBeCloseTo(0.0, 5);
    // sin(pi/2) = 1 -> t = 1/(4*10) = 0.025s
    expect(fn.evaluate(0.025)).toBeCloseTo(2.0, 5);
  });

  it('Verify Rollback Manager Integrity', () => {
    const manager = new TransientRollbackManager<number[]>();
    manager.saveState([1.0, 2.0], 'step-10-hash');

    const rollbackResult = manager.rollback('failed-step-11-hash');
    expect(rollbackResult.hash).toBe('step-10-hash');
    expect(rollbackResult.state[0]).toBe(1.0);
    expect(rollbackResult.state[1]).toBe(2.0);
  });

  it('Verify CFL Calculation', () => {
    const u = [100.0];
    const v = [0.0];
    const w = [0.0];
    const a = [340.0];
    const dt = 0.001;
    const dx = 0.5;

    const cfl = TransientCFLController.calculateCFL(dt, dx, u, v, w, a);
    expect(cfl).toBeCloseTo(((100.0 + 340.0) * 0.001) / 0.5, 5); // 440 * 0.001 / 0.5 = 0.88
  });

  it('Verify Hash Chain Construction', () => {
    const states = [[1.0, 1.0], [0.9, 0.9]];
    const times = [0.0, 0.1];
    const dt = [0.1];

    const chainHash = TransientCFDEvidence.computeHashChain(states, times, dt);
    expect(chainHash).toContain('state:1,1');
    expect(chainHash).toContain('state:0.9,0.9');
  });
});
