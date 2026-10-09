import { PropertyProvenance, MaterialStatus } from "../types";

export enum TemperatureUnit {
  KELVIN = 'K',
  CELSIUS = '°C',
  FAHRENHEIT = '°F'
}

export enum InterpolationPolicy {
  LINEAR = 'LINEAR',
  MONOTONIC = 'MONOTONIC',
  STEP = 'STEP'
}

export enum ExtrapolationPolicy {
  DISALLOW = 'DISALLOW',
  WARN = 'WARN',
  ALLOW_WITH_LIMIT = 'ALLOW_WITH_LIMIT'
}

export enum ResolutionStatus {
  EXACT_DATA_POINT = 'EXACT_DATA_POINT',
  INTERPOLATED = 'INTERPOLATED',
  ANALYTICAL = 'ANALYTICAL',
  PIECEWISE = 'PIECEWISE',
  EXTRAPOLATED = 'EXTRAPOLATED',
  OUTSIDE_DOMAIN = 'OUTSIDE_DOMAIN',
  MISSING_PROPERTY = 'MISSING_PROPERTY',
  CONFLICT = 'CONFLICT',
  INVALID_DATA = 'INVALID_DATA',
  PHASE_MISMATCH = 'PHASE_MISMATCH'
}

export interface TemperatureCoordinate {
  value: number;
  unit: TemperatureUnit;
}

export interface TemperatureValidityDomain {
  tMin: number; // In Kelvin
  tMax: number; // In Kelvin
  unit: TemperatureUnit.KELVIN;
}

export interface TemperaturePropertyPoint {
  temperature: number;
  unit: TemperatureUnit;
  normalizedTemperature: number; // Always Kelvin
  value: number;
  valueUnit: string;
}

export interface TemperatureDependentProperty {
  propertyId: string;
  materialId: string;
  revision: number;
  propertyName: string;
  valueUnit: string;
  validityDomain: TemperatureValidityDomain;
  interpolationPolicy: InterpolationPolicy;
  extrapolationPolicy: ExtrapolationPolicy;
  points: TemperaturePropertyPoint[];
  provenance: PropertyProvenance;
  validationStatus: MaterialStatus;
}
