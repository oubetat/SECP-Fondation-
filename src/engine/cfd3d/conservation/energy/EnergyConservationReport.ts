/**
 * SECP Industrial OS v2 — Energy Conservation Framework
 * PATCH-059: Energy Conservation Report Interface
 */

import { EnergyConservationStatus, EnergyFormulation } from './EnergyConservationTypes';

export interface EnergyConservationReport {
  readonly formulation: EnergyFormulation;
  readonly steady: boolean;
  readonly totalConvectiveFlux: number;
  readonly pressureWork: number;
  readonly viscousWork: number;
  readonly conductiveHeatTransfer: number;
  readonly volumetricHeatSource: number;
  readonly bodyForcePower: number;
  readonly accumulation: number;
  readonly globalImbalance: number;
  readonly normalizedGlobalImbalance: number;
  readonly maxLocalImbalance: number;
  readonly normalizedMaxLocalImbalance: number;
  readonly internalFaceImbalance: number;
  readonly status: EnergyConservationStatus;
  readonly diagnostics: string[];
  readonly meshHash: string;
  readonly fieldStateHash: string;
  readonly timestamp: string;
}
