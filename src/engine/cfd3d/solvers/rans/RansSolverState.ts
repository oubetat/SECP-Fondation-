/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-062: RANS Solver State
 */

import { RansFieldState, RansResidualMetrics, RansSolverVerdict } from './RansSolverTypes';

export class RansSolverState {
  public readonly iterationIndex: number;
  public readonly fieldState: RansFieldState;
  public readonly residuals: RansResidualMetrics;
  public readonly verdict: RansSolverVerdict;
  public readonly hash: string;

  constructor(
    iterationIndex: number,
    fieldState: RansFieldState,
    residuals: RansResidualMetrics,
    verdict: RansSolverVerdict
  ) {
    this.iterationIndex = iterationIndex;
    this.fieldState = fieldState;
    this.residuals = residuals;
    this.verdict = verdict;
    this.hash = this.computeHash();
  }

  private computeHash(): string {
    const raw = `${this.iterationIndex}:${this.fieldState.hash}:${this.residuals.maxResidual}`;
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      hash = (hash << 5) - hash + raw.charCodeAt(i);
      hash |= 0;
    }
    return `rans-state-hash-${Math.abs(hash).toString(16)}`;
  }
}
