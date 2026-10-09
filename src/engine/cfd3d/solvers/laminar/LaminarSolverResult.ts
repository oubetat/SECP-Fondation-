/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-061: Laminar Solver Result Model
 */

import {
  LaminarSolverVerdict,
  IterationResiduals,
  IterationConservationMetrics,
  LaminarFormulation
} from './LaminarSolverTypes';
import { LaminarSolverFailureCode } from './LaminarFailure';

export interface LaminarSolverResultData {
  readonly runId: string;
  readonly solverVersion: string;
  readonly formulation: LaminarFormulation;
  readonly meshHash: string;
  readonly materialHash: string;
  readonly boundaryConditionHash: string;
  readonly initialStateHash: string;
  readonly configurationHash: string;
  readonly finalStateHash: string;
  readonly iterationCount: number;
  readonly convergenceState: LaminarSolverVerdict;
  readonly residualMetrics: IterationResiduals;
  readonly massConservation: IterationConservationMetrics;
  readonly momentumConservation: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  };
  readonly energyConservation?: IterationConservationMetrics;
  readonly failureCodes: readonly LaminarSolverFailureCode[];
  readonly diagnostics: readonly string[];
  readonly provenance: {
    readonly startTime: string;
    readonly endTime: string;
    readonly machineId?: string;
  };
  readonly evidenceHash: string;
}

export class LaminarSolverResult {
  public readonly data: LaminarSolverResultData;

  constructor(data: LaminarSolverResultData) {
    this.data = Object.freeze({ ...data });
  }

  public toJSON(): LaminarSolverResultData {
    return this.data;
  }
}
