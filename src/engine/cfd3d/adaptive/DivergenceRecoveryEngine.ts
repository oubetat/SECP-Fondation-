/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * G1-E: Divergence Recovery Engine
 *
 * Provides real-time detection of numerical divergence and automated recovery 
 * through complete state backtracking (velocity, pressure, turbulence, time-step)
 * and numerical hardening (CFL/Relaxation reduction).
 */

import { DivergenceRecoveryRecord } from './AdaptiveCFDTypes';

export interface RecoveryState {
  u: number[];
  v: number[];
  w: number[];
  p: number[];
  k?: number[];
  omega?: number[];
  nut?: number[];
  eps?: number[];
  dt?: number;
  iteration: number;
}

export interface DivergenceCheckResult {
  isDiverging: boolean;
  reason?: string;
}

export interface RecoveryResult {
  success: boolean;
  restoredState?: RecoveryState;
}

export class DivergenceRecoveryEngine {
  private checkpoints: Map<number, RecoveryState> = new Map();
  private recoveryLog: DivergenceRecoveryRecord[] = [];
  private readonly maxCheckpoints = 5;
  private lastSavedIteration = 0;

  /**
   * Checks for numerical instability markers.
   */
  public checkDivergence(
    iter: number,
    u: number[],
    v: number[],
    w: number[],
    p: number[],
    refVel: number,
    currentResidual: number,
    prevResidual: number
  ): DivergenceCheckResult {
    // 1. NaN/Infinity Check
    if (this.hasNonFinite(u) || this.hasNonFinite(v) || this.hasNonFinite(w) || this.hasNonFinite(p)) {
      return { isDiverging: true, reason: 'NaN_OR_INF_DETECTED' };
    }

    // 2. Residual Explosion (100x jump)
    if (iter > 5 && currentResidual > prevResidual * 100) {
      return { isDiverging: true, reason: 'RESIDUAL_EXPLOSION' };
    }

    // 3. Unphysical Velocity
    const maxU = Math.max(...u.map(Math.abs));
    if (maxU > Math.max(1000.0, refVel * 10)) {
      return { isDiverging: true, reason: 'UNPHYSICAL_VELOCITY' };
    }

    return { isDiverging: false };
  }

  /**
   * Attempts to restore from the last good checkpoint.
   */
  public recover(iter: number, reason: string): RecoveryResult {
    const checkpointIters = Array.from(this.checkpoints.keys()).sort((a, b) => b - a);
    const lastIter = checkpointIters.find(i => i < iter);

    if (lastIter !== undefined) {
      const state = this.checkpoints.get(lastIter)!;
      const record: DivergenceRecoveryRecord = {
        eventId: `REC_${Date.now()}`,
        iteration: iter,
        triggerReason: reason,
        recoveryActionsTaken: ['STATE_BACKTRACK', 'CFL_REDUCTION_REQUESTED'],
        previousGoodStateIteration: lastIter,
        successfulRecovery: true
      };
      this.recoveryLog.push(record);
      return { success: true, restoredState: state };
    }

    return { success: false };
  }

  /**
   * Saves a full state checkpoint for potential recovery.
   */
  public saveCheckpoint(
    iter: number,
    u: number[],
    v: number[],
    w: number[],
    p: number[],
    residual: number,
    k?: number[],
    omega?: number[],
    nut?: number[],
    eps?: number[],
    dt?: number
  ): void {
    this.checkpoints.set(iter, {
      iteration: iter,
      u: [...u],
      v: [...v],
      w: [...w],
      p: [...p],
      k: k ? [...k] : undefined,
      omega: omega ? [...omega] : undefined,
      nut: nut ? [...nut] : undefined,
      eps: eps ? [...eps] : undefined,
      dt
    });

    this.lastSavedIteration = iter;

    // Prune old checkpoints
    if (this.checkpoints.size > this.maxCheckpoints) {
      const first = Array.from(this.checkpoints.keys()).sort((a, b) => a - b)[0];
      this.checkpoints.delete(first);
    }
  }

  public getRecoveryLog(): DivergenceRecoveryRecord[] {
    return Object.freeze([...this.recoveryLog]);
  }

  private hasNonFinite(arr: number[]): boolean {
    for (let i = 0; i < arr.length; i++) {
      if (!Number.isFinite(arr[i])) return true;
    }
    return false;
  }
}
