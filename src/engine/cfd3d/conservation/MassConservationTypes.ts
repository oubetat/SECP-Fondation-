/**
 * SECP Industrial OS v2 — Mass Conservation Framework
 * PATCH-057: Core Types
 */

export enum MassConservationStatus {
  CONSERVATIVE = 'CONSERVATIVE',
  NOT_CONSERVATIVE = 'NOT_CONSERVATIVE',
  CONSERVATION_FAILURE = 'CONSERVATION_FAILURE',
  INVALID = 'INVALID',
  INCONCLUSIVE = 'INCONCLUSIVE',
  UNPROVEN = 'UNPROVEN'
}

export enum FluxOrientation {
  OUTWARD_POSITIVE = 'OUTWARD_POSITIVE',
  INWARD_POSITIVE = 'INWARD_POSITIVE'
}

export interface ControlVolumeMassBalance {
  readonly cellId: number;
  readonly inflow: number;
  readonly outflow: number;
  readonly accumulation: number;
  readonly imbalance: number;
  readonly normalizedImbalance: number;
  readonly finite: boolean;
  readonly diagnostics: string[];
}

export interface GlobalMassBalanceResult {
  readonly totalInflow: number;
  readonly totalOutflow: number;
  readonly netBoundaryFlux: number;
  readonly accumulation: number;
  readonly globalMassImbalance: number;
  readonly normalizedGlobalImbalance: number;
  readonly maxLocalImbalance: number;
  readonly normalizedMaxLocalImbalance: number;
  readonly internalFaceImbalance: number;
  readonly status: MassConservationStatus;
  readonly finite: boolean;
}
