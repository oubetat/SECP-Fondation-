/**
 * SECP Industrial OS - PATCH-268: Temperature-Dependent Properties
 * Engineering Intelligence Layer - Temperature-Dependent Property System Data Types & Schema
 */

import { PropertySource, PropertyCategory, MaterialTemperCondition } from './MaterialPropertyTypes267';

export type TemperatureUnit = 'K' | 'C' | 'F';

export type InterpolationPolicy = 'LINEAR' | 'PIECEWISE_LINEAR' | 'TABULATED';

export type DatasetStatus = 'DRAFT' | 'REVIEW' | 'VALIDATED' | 'APPROVED' | 'DEPRECATED';

export type PropertyEvaluationStatus =
  | 'EXACT'
  | 'INTERPOLATED'
  | 'OUT_OF_VALIDITY_RANGE'
  | 'ESTIMATED'
  | 'ERROR';

export type InterpolationMethod =
  | 'EXACT_MATCH'
  | 'LINEAR_INTERPOLATION'
  | 'NONE'
  | 'FALLBACK_REFERENCE';

export type EvaluationValidityStatus =
  | 'VALID'
  | 'OUT_OF_RANGE'
  | 'INVALID_TEMPERATURE'
  | 'MISSING_DATA'
  | 'SOURCE_CONFLICT'
  | 'DUPLICATE_CONFLICT'
  | 'PHYSICAL_IMPLAUSIBILITY';

/**
 * Raw data point representing an experimental or published property value at a specific temperature.
 */
export interface TemperatureDataPoint {
  pointId: string;
  temperature: number;
  temperatureUnit: TemperatureUnit;
  temperatureKelvin: number;
  propertyValue: number;
  propertyUnit: string;
  canonicalValue: number; // SI canonical property value
  canonicalUnit: string;  // SI canonical property unit
  condition?: MaterialTemperCondition | string;
  source?: PropertySource;
  evidenceId?: string;
}

/**
 * Explicit derived mathematical curve representation if explicit curve fitting is performed.
 */
export interface DerivedCurveRepresentation {
  modelType: 'PIECEWISE_LINEAR' | 'POLYNOMIAL' | 'SPLINE';
  parameters: number[];
  fittingErrorR2?: number;
  validityRangeKelvin: {
    min: number;
    max: number;
  };
  fittedBy?: string;
  fitDate?: string;
  sourceEvidenceId?: string;
}

/**
 * Temperature-Property Dataset representing property values vs temperature for a material, revision, and condition.
 */
export interface TemperaturePropertyDataset {
  datasetId: string;
  materialId: string;
  materialRevision: number;
  propertyType: string;
  category: PropertyCategory;
  datasetRevision: number;
  condition: MaterialTemperCondition | string;
  rawPoints: TemperatureDataPoint[];
  derivedRepresentation?: DerivedCurveRepresentation;
  interpolationPolicy: InterpolationPolicy;
  validityRange: {
    minTemperatureKelvin: number;
    maxTemperatureKelvin: number;
  };
  referenceTemperatureKelvin?: number; // e.g., 293.15 K (20 °C) for thermal expansion
  propertyUnit: string;
  canonicalUnit: string;
  source: PropertySource;
  status: DatasetStatus;
  datasetHash: string; // SHA-256 fingerprint of the dataset
  createdDate: string;
  approvedBy?: string;
}

/**
 * Strongly typed property evaluation output. No bare numerical outputs.
 */
export interface EvaluatedPropertyValue {
  value: number; // Evaluated property value in requested or native property unit
  unit: string;
  canonicalValue: number; // SI canonical property value
  canonicalUnit: string;
  temperatureRequested: {
    value: number;
    unit: TemperatureUnit;
    kelvin: number;
  };
  propertyType: string;
  materialId: string;
  materialRevision: number;
  condition: string;
  datasetRevision: number;
  evaluationStatus: PropertyEvaluationStatus;
  interpolationMethod: InterpolationMethod;
  validityStatus: EvaluationValidityStatus;
  source: PropertySource;
  evidenceHash: string;
  details: string;
  referenceTemperatureKelvin?: number;
  rawDatasetPoints?: { temperatureK: number; value: number }[];
}

/**
 * Temperature-dependent material property container.
 */
export interface TemperatureDependentProperty {
  propertyId: string;
  materialId: string;
  materialRevision: number;
  propertyType: string;
  category: PropertyCategory;
  datasets: TemperaturePropertyDataset[];
  activeDatasetRevision: number;
}

/**
 * Contract defining solver capabilities and temperature-dependent material compatibility.
 */
export interface TemperatureDependentMaterialContract {
  solverId: string;
  solverName: string;
  supportsTemperatureDependentProperties: boolean;
  supportedProperties: string[];
  requiresReferenceTemperatureFallback: boolean;
  supportsSpatialTemperatureField: boolean;
  supportsTimeDependentTemperature: boolean;
}

/**
 * Immutable snapshot for reproducible simulation execution.
 */
export interface MaterialPropertySnapshot268 {
  snapshotId: string;
  timestamp: string;
  materialId: string;
  materialName: string;
  materialRevision: number;
  datasetRevisions: Record<string, number>; // propertyType -> datasetRevision
  datasetHashes: Record<string, string>;       // propertyType -> datasetHash
  temperaturePolicy: {
    allowExtrapolation: boolean;
    referenceTemperatureFallback: boolean;
  };
  evaluatedValuesCache: EvaluatedPropertyValue[];
  snapshotHash: string;
}

/**
 * Query options for evaluating temperature-dependent properties.
 */
export interface PropertyEvaluationQuery {
  materialId: string;
  materialRevision?: number;
  propertyType: string;
  condition?: MaterialTemperCondition | string;
  temperature: number;
  temperatureUnit: TemperatureUnit;
  datasetRevision?: number;
  allowReferenceFallback?: boolean;
}

/**
 * Physical plausibility report for temperature datasets.
 */
export interface TemperatureDatasetPlausibilityReport {
  datasetId: string;
  isValid: boolean;
  hasNegativeAbsoluteTemp: boolean;
  hasDuplicateTemperatures: boolean;
  hasPhysicalImplausibilities: boolean;
  hasSourceConflict: boolean;
  messages: string[];
}
