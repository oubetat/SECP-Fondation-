/**
 * SECP Industrial OS v2 — Energy Conservation Framework
 * PATCH-059: Core Types & Enums
 */

export enum EnergyConservationStatus {
  CONSERVATIVE = 'CONSERVATIVE',
  NOT_CONSERVATIVE = 'NOT_CONSERVATIVE',
  CONSERVATION_FAILURE = 'CONSERVATION_FAILURE',
  INVALID = 'INVALID',
  INCONCLUSIVE = 'INCONCLUSIVE',
  UNPROVEN = 'UNPROVEN'
}

export enum EnergyFormulation {
  INTERNAL_ENERGY = 'INTERNAL_ENERGY',
  TOTAL_ENERGY = 'TOTAL_ENERGY',
  ENTHALPY = 'ENTHALPY',
  TOTAL_ENTHALPY = 'TOTAL_ENTHALPY',
  TEMPERATURE_BASED = 'TEMPERATURE_BASED',
  UNKNOWN = 'UNKNOWN'
}

export enum ThermalBoundaryType {
  ADIABATIC = 'ADIABATIC',
  FIXED_TEMPERATURE = 'FIXED_TEMPERATURE',
  FIXED_HEAT_FLUX = 'FIXED_HEAT_FLUX',
  CONVECTIVE_HEAT_TRANSFER = 'CONVECTIVE_HEAT_TRANSFER',
  RADIATION = 'RADIATION'
}

export interface ControlVolumeEnergyBalance {
  readonly cellId: number;
  readonly accumulation: number;
  readonly netConvectiveFlux: number;
  readonly pressureWork: number;
  readonly viscousWork: number;
  readonly conductiveHeatFlux: number;
  readonly volumetricHeatSource: number;
  readonly bodyForcePower: number;
  readonly explicitSources: number;
  readonly imbalance: number;
  readonly normalizedImbalance: number;
  readonly finite: boolean;
  readonly diagnostics: string[];
}

export interface GlobalEnergyBalanceResult {
  readonly totalConvectiveFlux: number;
  readonly totalPressureWork: number;
  readonly totalViscousWork: number;
  readonly totalConductiveHeatFlux: number;
  readonly totalVolumetricHeatSource: number;
  readonly totalBodyForcePower: number;
  readonly totalAccumulation: number;
  readonly globalImbalance: number;
  readonly normalizedGlobalImbalance: number;
  readonly maxLocalImbalance: number;
  readonly normalizedMaxLocalImbalance: number;
  readonly internalFaceImbalance: number;
  readonly status: EnergyConservationStatus;
  readonly formulation: EnergyFormulation;
  readonly finite: boolean;
}
