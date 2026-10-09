/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-061: Laminar Solver State Container
 */

import {
  FieldState,
  IterationResiduals,
  IterationConservationMetrics,
  LaminarSolverVerdict
} from './LaminarSolverTypes';

export interface LinearSolverIterationInfo {
  readonly momentumXIterations: number;
  readonly momentumYIterations: number;
  readonly momentumZIterations: number;
  readonly pressureIterations: number;
  readonly energyIterations?: number;
}

export class LaminarSolverState {
  public readonly iterationIndex: number;
  public readonly fieldState: FieldState;
  public readonly residuals: IterationResiduals;
  public readonly conservation: IterationConservationMetrics;
  public readonly linearSolverInfo: LinearSolverIterationInfo;
  public readonly convergenceState: LaminarSolverVerdict;
  public readonly timestamp: string;
  public readonly hash: string;

  constructor(
    iterationIndex: number,
    fieldState: FieldState,
    residuals: IterationResiduals,
    conservation: IterationConservationMetrics,
    linearSolverInfo: LinearSolverIterationInfo,
    convergenceState: LaminarSolverVerdict,
    timestamp?: string
  ) {
    this.iterationIndex = iterationIndex;
    this.fieldState = fieldState;
    this.residuals = residuals;
    this.conservation = conservation;
    this.linearSolverInfo = linearSolverInfo;
    this.convergenceState = convergenceState;
    this.timestamp = timestamp || new Date().toISOString();
    this.hash = this.computeHash();
  }

  private computeHash(): string {
    const raw = `${this.iterationIndex}:${this.fieldState.hash}:${this.residuals.maxResidual}:${this.convergenceState}`;
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      hash = (hash << 5) - hash + raw.charCodeAt(i);
      hash |= 0;
    }
    return `state-hash-${Math.abs(hash).toString(16)}`;
  }
}
