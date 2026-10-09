/**
 * SECP Industrial OS v2 — Flux Types
 * PATCH-053: Flux Framework
 */

export type Vector3 = [number, number, number];

export enum FluxVerdict {
  PASS = 'PASS',
  FAIL = 'FAIL',
  UNPROVEN = 'UNPROVEN',
  INCONCLUSIVE = 'INCONCLUSIVE',
  INVALID = 'INVALID',
  NOT_CONVERGED = 'NOT_CONVERGED'
}

export enum FluxDiagnostic {
  INVALID_STATE = 'INVALID_STATE',
  NEGATIVE_DENSITY = 'NEGATIVE_DENSITY',
  NON_POSITIVE_PRESSURE = 'NON_POSITIVE_PRESSURE',
  NON_FINITE_VALUE = 'NON_FINITE_VALUE',
  ZERO_NORMAL = 'ZERO_NORMAL',
  UNSUPPORTED_MODEL = 'UNSUPPORTED_MODEL',
  FLUX_NON_CONSERVATIVE = 'FLUX_NON_CONSERVATIVE',
  FLUX_SYMMETRY_FAILURE = 'FLUX_SYMMETRY_FAILURE',
  NUMERICAL_OVERFLOW = 'NUMERICAL_OVERFLOW'
}

export type BoundaryCapability = 'SUPPORTED' | 'PARTIAL' | 'UNSUPPORTED';

export interface PhysicsModel {
  readonly modelType: 'EULER_3D';
  readonly gamma: number;       // Ratio of specific heats, e.g. 1.4 for ideal air
  readonly gasConstant: number; // Specific gas constant R, e.g. 287.05 J/(kg·K)
}

export interface ConservativeState {
  readonly rho: number;      // Density (kg/m^3)
  readonly rhoU: number;     // Momentum X (kg/(m^2·s))
  readonly rhoV: number;     // Momentum Y (kg/(m^2·s))
  readonly rhoW: number;     // Momentum Z (kg/(m^2·s))
  readonly rhoE: number;     // Total energy per volume (J/m^3)
}

export interface PrimitiveState {
  readonly rho: number;      // Density (kg/m^3)
  readonly u: number;        // Velocity X (m/s)
  readonly v: number;        // Velocity Y (m/s)
  readonly w: number;        // Velocity Z (m/s)
  readonly p: number;        // Pressure (Pa)
  readonly T: number;        // Temperature (K)
}

export interface FluxResult {
  readonly flux: ConservativeState;
  readonly schemeId: string;
  readonly validity: boolean;
  readonly diagnostics: FluxDiagnostic[];
  readonly waveSpeed?: number;
  readonly evidenceMetadata?: Record<string, any>;
}

export interface BoundaryFluxResult {
  readonly capability: BoundaryCapability;
  readonly fluxResult: FluxResult;
  readonly diagnostics: FluxDiagnostic[];
}
