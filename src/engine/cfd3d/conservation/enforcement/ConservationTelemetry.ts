/**
 * SECP Industrial OS v2 — Conservation Telemetry Ledger
 * Phase 16 (PATCH-175)
 *
 * Immutable, chronological telemetry recording every accepted and rejected iteration,
 * state machine transitions, directional flux balances, and recovery triggers.
 */

import {
  ConservationIterationTelemetry,
  ConservationState
} from './ConservationEnforcementTypes';

export class ConservationTelemetry {
  private history: ConservationIterationTelemetry[] = [];
  private stateHistory: { iteration: number; state: ConservationState; timestamp: number }[] = [];

  public record(telemetry: ConservationIterationTelemetry): void {
    this.history.push(telemetry);
    this.stateHistory.push({
      iteration: telemetry.iteration,
      state: telemetry.state,
      timestamp: performance.now()
    });
  }

  public getHistory(): ConservationIterationTelemetry[] {
    return this.history;
  }

  public getAcceptedHistory(): ConservationIterationTelemetry[] {
    return this.history.filter(h => h.isAccepted);
  }

  public getRejectedHistory(): ConservationIterationTelemetry[] {
    return this.history.filter(h => !h.isAccepted);
  }

  public getSummary(): {
    totalIterations: number;
    acceptedIterations: number;
    rejectedIterations: number;
    finalMassImbalance: number;
    finalMomentumResidual: number;
    finalEnergyImbalance: number;
    finalContinuityRms: number;
    currentState: ConservationState;
  } {
    const total = this.history.length;
    const accepted = this.getAcceptedHistory();
    const rejected = this.getRejectedHistory();
    const latest = this.history[this.history.length - 1];

    return {
      totalIterations: total,
      acceptedIterations: accepted.length,
      rejectedIterations: rejected.length,
      finalMassImbalance: latest ? latest.mass.massImbalanceKgS : 0,
      finalMomentumResidual: latest ? latest.momentum.totalMomentumResidual : 0,
      finalEnergyImbalance: latest ? latest.energy.energyImbalanceW : 0,
      finalContinuityRms: latest ? latest.continuity.rmsContinuityDefectKgS : 0,
      currentState: latest ? latest.state : 'STABLE'
    };
  }

  public clear(): void {
    this.history = [];
    this.stateHistory = [];
  }
}
