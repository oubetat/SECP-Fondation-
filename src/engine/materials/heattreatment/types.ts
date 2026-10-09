import { PropertyProvenance } from "../types";

export enum HeatTreatmentType {
  ANNEALING = "ANNEALING",
  NORMALIZING = "NORMALIZING",
  QUENCH_AND_TEMPER = "QUENCH_AND_TEMPER",
  SOLUTION_TREATMENT = "SOLUTION_TREATMENT",
  PRECIPITATION_AGING = "PRECIPITATION_AGING",
  STRESS_RELIEF = "STRESS_RELIEF"
}

export enum AtmosphereType {
  AIR = "AIR",
  VACUUM = "VACUUM",
  INERT_GAS = "INERT_GAS",
  REDUCING = "REDUCING",
  CONTROLLED = "CONTROLLED"
}

export enum CoolingMedium {
  WATER = "WATER",
  OIL = "OIL",
  POLYMER = "POLYMER",
  GAS = "GAS",
  BRINE = "BRINE",
  FURNACE = "FURNACE",
  AIR = "AIR"
}

export interface HeatingStage {
  startTemperature: number; // K
  targetTemperature: number; // K
  heatingRate: number; // K/s
  duration: number; // s
  atmosphere: AtmosphereType;
}

export interface SoakingStage {
  soakTemperature: number; // K
  soakDuration: number; // s
  temperatureUniformity: number; // ±K
  atmosphere: AtmosphereType;
}

export interface CoolingStage {
  startTemperature: number; // K
  endTemperature: number; // K
  coolingRate: number; // K/s
  medium: CoolingMedium;
  agitation: "NONE" | "LOW" | "MEDIUM" | "HIGH";
  atmosphere: AtmosphereType;
}

export interface ThermalCycle {
  cycleId: string;
  timePoints: number[]; // s, monotonic
  temperaturePoints: number[]; // K
  heatingStages: HeatingStage[];
  soakingStages: SoakingStage[];
  coolingStages: CoolingStage[];
  fingerprint: string;
}

export interface MicrostructureState {
  grainSize?: {
    value: number; // um or ASTM number
    unit: string;
    method: string;
  };
  phaseFractions: {
    phase: string;
    fraction: number; // 0 to 1
    method: string;
  }[];
  provenance: "MEASURED" | "SIMULATED" | "INFERRED" | "REFERENCE";
}

export interface TreatedMaterialCondition {
  conditionId: string;
  materialId: string;
  materialRevision: number;
  conditionName: string;
  heatTreatmentHistory: string[]; // list of process IDs
  microstructure?: MicrostructureState;
  properties: {
    hardness?: {
      value: number;
      scale: "HB" | "HRC" | "HV";
    };
    yieldStrength?: number; // Pa
    ultimateStrength?: number; // Pa
    elongation?: number; // fraction
  };
  provenance: PropertyProvenance;
  revision: number;
}

export interface HeatTreatmentEquipment {
  equipmentId: string;
  furnaceType: string;
  temperatureRange: { min: number; max: number }; // K
  calibrationStatus: "VALID" | "EXPIRED" | "NONE";
  calibrationDate?: string;
  calibrationRevision?: number;
}

export interface HeatTreatmentProcessWindow {
  temperatureRange: { min: number; max: number }; // K
  timeRange: { min: number; max: number }; // s
  coolingRateRange?: { min: number; max: number }; // K/s
}

export enum HeatTreatmentVerdict {
  COMPLIANT = "COMPLIANT",
  NON_COMPLIANT = "NON_COMPLIANT",
  INDETERMINATE = "INDETERMINATE",
  INVALID = "INVALID",
  OUTSIDE_VALIDITY_DOMAIN = "OUTSIDE_VALIDITY_DOMAIN"
}

export interface HeatTreatmentProcess {
  processId: string;
  processType: HeatTreatmentType;
  materialId: string;
  materialRevision: number;
  initialConditionId: string;
  targetConditionId: string;
  thermalCycle: ThermalCycle;
  equipment: HeatTreatmentEquipment;
  batchId: string;
  provenance: PropertyProvenance;
  revision: number;
}
