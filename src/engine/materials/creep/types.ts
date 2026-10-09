import { PropertyProvenance } from "../types";

export enum TimeUnit {
  SECOND = 's',
  MINUTE = 'min',
  HOUR = 'h',
  DAY = 'day',
  YEAR = 'year'
}

export interface TimeCoordinate {
  value: number;
  unit: TimeUnit;
  normalizedSeconds: number;
}

export interface CreepMaterialState {
  creepStrainTensor: number[]; // Voigt notation [11, 22, 33, 12, 23, 13]
  equivalentCreepStrain: number;
  creepStrainRate: number;
  internalVariables: Record<string, number>;
  accumulatedTime: number; // in seconds
  temperature: number; // in Kelvin
  stressState: number[]; // Voigt notation
  revision: number;
  converged: boolean;
  timestamp: string;
}

export interface CreepTrialState extends CreepMaterialState {
  trialCreepStrainRate: number;
  deltaCreepStrain: number[];
}

export enum CreepModelType {
  NORTON = 'NORTON',
  POWER_LAW = 'POWER_LAW',
  TIME_HARDENING = 'TIME_HARDENING',
  STRAIN_HARDENING = 'STRAIN_HARDENING'
}

export interface CreepModelConfig {
  modelId: string;
  name: string;
  type: CreepModelType;
  parameters: Record<string, number>;
  provenance: PropertyProvenance;
}

export enum CreepVerdict {
  CONVERGED = 'CREEP_CONVERGED',
  NOT_CONVERGED = 'CREEP_NOT_CONVERGED',
  FAILURE = 'CREEP_FAILURE',
  OUTSIDE_DOMAIN = 'OUTSIDE_VALIDITY_DOMAIN',
  INVALID_STEP = 'INVALID_TIME_STEP'
}
