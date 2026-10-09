/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-061: Laminar Solver Types & Contracts
 */

export type Vector3D = readonly [number, number, number];

export enum LaminarFormulation {
  STEADY_INCOMPRESSIBLE_NAVIER_STOKES = 'STEADY_INCOMPRESSIBLE_NAVIER_STOKES',
  TRANSIENT_INCOMPRESSIBLE_NAVIER_STOKES = 'TRANSIENT_INCOMPRESSIBLE_NAVIER_STOKES'
}

export enum LaminarSolverVerdict {
  CONVERGED = 'CONVERGED',
  NOT_CONVERGED = 'NOT_CONVERGED',
  DIVERGED = 'DIVERGED',
  INVALID = 'INVALID',
  CONVERGED_WITH_CONSERVATION_FAILURE = 'CONVERGED_WITH_CONSERVATION_FAILURE',
  CONVERGED_WITH_UNPROVEN_PHYSICS = 'CONVERGED_WITH_UNPROVEN_PHYSICS',
  UNPROVEN = 'UNPROVEN'
}

export enum ConservationVerdict {
  CONSERVATIVE = 'CONSERVATIVE',
  NOT_CONSERVATIVE = 'NOT_CONSERVATIVE',
  UNPROVEN = 'UNPROVEN'
}

export enum EnergySolveStatus {
  SOLVED_AND_CONSERVATIVE = 'SOLVED_AND_CONSERVATIVE',
  SOLVED_NOT_CONSERVATIVE = 'SOLVED_NOT_CONSERVATIVE',
  NOT_SOLVED = 'NOT_SOLVED',
  UNPROVEN = 'UNPROVEN'
}

export enum VerificationVerdict {
  VERIFIED = 'VERIFIED',
  FAILED = 'FAILED',
  INCONCLUSIVE = 'INCONCLUSIVE',
  UNPROVEN = 'UNPROVEN'
}

export interface MaterialProperties {
  readonly density: number;       // kg/m^3
  readonly viscosity: number;     // Pa*s
  readonly specificHeatCv?: number; // J/(kg*K)
  readonly specificHeatCp?: number; // J/(kg*K)
  readonly thermalConductivity?: number; // W/(m*K)
  readonly isConstant: boolean;
}

export interface FieldState {
  readonly stateId: string;
  readonly velocity: readonly Vector3D[]; // cell-centered velocity
  readonly pressure: readonly number[];   // cell-centered pressure
  readonly temperature?: readonly number[]; // optional cell-centered temperature
  readonly dimensions: {
    readonly velocity: 'm/s';
    readonly pressure: 'Pa';
    readonly temperature: 'K';
  };
  readonly source: string;
  readonly hash: string;
}

export interface IterationResiduals {
  readonly continuityResidual: number;
  readonly momentumXResidual: number;
  readonly momentumYResidual: number;
  readonly momentumZResidual: number;
  readonly energyResidual?: number;
  readonly maxResidual: number;
}

export interface IterationConservationMetrics {
  readonly massImbalance: number;      // kg/s
  readonly momentumXImbalance: number;  // N
  readonly momentumYImbalance: number;  // N
  readonly momentumZImbalance: number;  // N
  readonly energyImbalance?: number;    // W
  readonly massVerdict: ConservationVerdict;
  readonly momentumVerdict: ConservationVerdict;
  readonly energyStatus: EnergySolveStatus;
}
