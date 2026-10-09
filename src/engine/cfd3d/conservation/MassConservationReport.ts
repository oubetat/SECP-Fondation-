/**
 * SECP Industrial OS v2 — Mass Conservation Framework
 * PATCH-057: Conservation Report
 */

import { GlobalMassBalanceResult, ControlVolumeMassBalance, MassConservationStatus } from './MassConservationTypes';
import { MassConservationPolicy } from './MassConservationPolicy';

export interface MassConservationReport {
  readonly formulation: string;
  readonly steady: boolean;
  readonly totalInflow: number;
  readonly totalOutflow: number;
  readonly netFlux: number;
  readonly accumulation: number;
  readonly globalImbalance: number;
  readonly normalizedGlobalImbalance: number;
  readonly maxLocalImbalance: number;
  readonly normalizedMaxLocalImbalance: number;
  readonly internalFaceImbalance: number;
  readonly status: MassConservationStatus;
  readonly diagnostics: string[];
  readonly meshHash: string;
  readonly fieldStateHash: string;
  readonly timestamp: string;
}
