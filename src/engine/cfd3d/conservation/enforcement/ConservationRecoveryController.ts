/**
 * SECP Industrial OS v2 — Conservation Recovery Controller
 * Phase 16 (PATCH-175)
 *
 * Manages conservation checkpoints, state rollback on iteration rejection,
 * dynamic relaxation damping, CFL / time-step reduction, and solver recovery logging.
 */

import {
  ConservationCheckpoint,
  RecoveryActionLog
} from './ConservationEnforcementTypes';

export class ConservationRecoveryController {
  private checkpoints: ConservationCheckpoint[] = [];
  private maxCheckpoints: number = 5;
  private recoveryLogs: RecoveryActionLog[] = [];
  private consecutiveRejections: number = 0;
  private maxAllowedRejections: number = 6;

  public saveCheckpoint(
    iteration: number,
    u: number[],
    v: number[],
    w: number[],
    p: number[],
    massImbalance: number,
    T?: number[]
  ): void {
    const checkpoint: ConservationCheckpoint = {
      iteration,
      u: [...u],
      v: [...v],
      w: [...w],
      p: [...p],
      T: T ? [...T] : undefined,
      massImbalance,
      timestamp: performance.now()
    };

    this.checkpoints.push(checkpoint);
    if (this.checkpoints.length > this.maxCheckpoints) {
      this.checkpoints.shift();
    }
  }

  public getLatestCheckpoint(): ConservationCheckpoint | null {
    if (this.checkpoints.length === 0) return null;
    return this.checkpoints[this.checkpoints.length - 1];
  }

  public executeRecovery(
    iteration: number,
    triggerReason: string,
    currentAlphaU: number,
    currentAlphaP: number,
    currentDt: number
  ): {
    canRecover: boolean;
    restoredCheckpoint: ConservationCheckpoint | null;
    adjustedAlphaU: number;
    adjustedAlphaP: number;
    adjustedDt: number;
    actionLogs: RecoveryActionLog[];
  } {
    this.consecutiveRejections++;

    if (this.consecutiveRejections > this.maxAllowedRejections) {
      return {
        canRecover: false,
        restoredCheckpoint: null,
        adjustedAlphaU: currentAlphaU,
        adjustedAlphaP: currentAlphaP,
        adjustedDt: currentDt,
        actionLogs: this.recoveryLogs
      };
    }

    const checkpoint = this.getLatestCheckpoint();
    const newAlphaU = Math.max(0.1, currentAlphaU * 0.7);
    const newAlphaP = Math.max(0.05, currentAlphaP * 0.7);
    const newDt = Math.max(1e-7, currentDt * 0.5);

    const now = performance.now();
    const actions: RecoveryActionLog[] = [
      {
        iteration,
        trigger: triggerReason,
        actionTaken: 'RESTORE_CHECKPOINT',
        previousValue: iteration,
        adjustedValue: checkpoint ? checkpoint.iteration : 0,
        timestamp: now
      },
      {
        iteration,
        trigger: triggerReason,
        actionTaken: 'REDUCE_RELAXATION',
        previousValue: currentAlphaU,
        adjustedValue: newAlphaU,
        timestamp: now
      },
      {
        iteration,
        trigger: triggerReason,
        actionTaken: 'REDUCE_DT',
        previousValue: currentDt,
        adjustedValue: newDt,
        timestamp: now
      }
    ];

    this.recoveryLogs.push(...actions);

    return {
      canRecover: true,
      restoredCheckpoint: checkpoint,
      adjustedAlphaU: newAlphaU,
      adjustedAlphaP: newAlphaP,
      adjustedDt: newDt,
      actionLogs: actions
    };
  }

  public registerAcceptedIteration(): void {
    this.consecutiveRejections = 0;
  }

  public getRecoveryLogs(): RecoveryActionLog[] {
    return this.recoveryLogs;
  }

  public getRejectionCount(): number {
    return this.recoveryLogs.filter(l => l.actionTaken === 'RESTORE_CHECKPOINT').length;
  }
}
