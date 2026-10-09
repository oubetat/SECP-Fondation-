/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-062: RANS Solver Types & Contracts
 */

import { Vector3D } from '../laminar/LaminarSolverTypes';

export enum RansFormulation {
  STEADY_INCOMPRESSIBLE_RANS = 'STEADY_INCOMPRESSIBLE_RANS',
  TRANSIENT_INCOMPRESSIBLE_RANS = 'TRANSIENT_INCOMPRESSIBLE_RANS'
}

export enum RansSolverVerdict {
  CONVERGED = 'CONVERGED',
  NOT_CONVERGED = 'NOT_CONVERGED',
  DIVERGED = 'DIVERGED',
  INVALID = 'INVALID',
  CONVERGED_WITH_CONSERVATION_FAILURE = 'CONVERGED_WITH_CONSERVATION_FAILURE',
  CONVERGED_WITH_UNPROVEN_PHYSICS = 'CONVERGED_WITH_UNPROVEN_PHYSICS',
  UNPROVEN = 'UNPROVEN'
}

export enum TurbulenceStateVerdict {
  VALID = 'VALID',
  INVALID = 'INVALID',
  NOT_CONVERGED = 'NOT_CONVERGED',
  UNPROVEN = 'UNPROVEN'
}

export enum RansClosureCapability {
  AVAILABLE = 'AVAILABLE',
  UNAVAILABLE = 'UNAVAILABLE',
  UNPROVEN = 'UNPROVEN',
  INVALID = 'INVALID'
}

export interface RansTurbulenceVariables {
  readonly k?: readonly number[];      // Turbulent kinetic energy
  readonly omega?: readonly number[];  // Specific dissipation rate
  readonly epsilon?: readonly number[]; // Dissipation rate
  readonly nuTilda?: readonly number[]; // Spalart-Allmaras variable
}

export interface ReynoldsStressField {
  readonly Rxx: readonly number[];
  readonly Ryy: readonly number[];
  readonly Rzz: readonly number[];
  readonly Rxy: readonly number[];
  readonly Rxz: readonly number[];
  readonly Ryz: readonly number[];
}

export interface RansFieldState {
  readonly stateId: string;
  readonly meanVelocity: readonly Vector3D[];
  readonly meanPressure: readonly number[];
  readonly turbulenceVariables: RansTurbulenceVariables;
  readonly turbulentViscosity: readonly number[];
  readonly reynoldsStress?: ReynoldsStressField;
  readonly gradients?: {
    readonly grad_U?: readonly Vector3D[][];
    readonly grad_k?: readonly Vector3D[];
    readonly grad_omega?: readonly Vector3D[];
  };
  readonly hash: string;
  readonly timestamp: string;
}

export interface RansResidualMetrics {
  readonly continuity: number;
  readonly momentum: Vector3D;
  readonly turbulence: {
    readonly k?: number;
    readonly omega?: number;
    readonly epsilon?: number;
  };
  readonly maxResidual: number;
}
