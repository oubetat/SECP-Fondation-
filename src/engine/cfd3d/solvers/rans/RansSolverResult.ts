/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-062: RANS Solver Result
 */

import { 
  RansSolverVerdict, 
  RansResidualMetrics, 
  RansFormulation,
  TurbulenceStateVerdict,
  RansClosureCapability
} from './RansSolverTypes';
import { RansSolverFailureCode } from './RansFailure';
import { ConservationVerdict, EnergySolveStatus } from '../laminar/LaminarSolverTypes';

export interface RansSolverResultData {
  readonly runId: string;
  readonly solverVersion: string;
  readonly formulation: RansFormulation;
  readonly meshHash: string;
  readonly materialHash: string;
  readonly boundaryConditionHash: string;
  readonly initialStateHash: string;
  readonly configHash: string;
  readonly finalStateHash: string;
  readonly iterationCount: number;
  readonly convergenceState: RansSolverVerdict;
  readonly turbulenceStateVerdict: TurbulenceStateVerdict;
  readonly closureCapability: RansClosureCapability;
  readonly residualMetrics: RansResidualMetrics;
  readonly massConservation: ConservationVerdict;
  readonly momentumConservation: ConservationVerdict;
  readonly energyStatus: EnergySolveStatus;
  readonly failureCodes: readonly RansSolverFailureCode[];
  readonly diagnostics: readonly string[];
  readonly timestamp: string;
}

export class RansSolverResult {
  public readonly data: RansSolverResultData;

  constructor(data: RansSolverResultData) {
    this.data = Object.freeze({ ...data });
  }
}
