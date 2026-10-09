/**
 * SECP Industrial OS - PATCH-269: Fatigue Analysis & Verification Kernel
 * Engineering Intelligence Layer - Fatigue System Data Types & Schemas
 */

import { PropertySource, MaterialTemperCondition } from './MaterialPropertyTypes267';
import { TemperatureUnit } from './TemperaturePropertyTypes268';

export type MeanStressCorrectionModel = 'NONE' | 'GOODMAN' | 'GERBER' | 'SODERBERG';

export type FatigueMethod = 'STRESS_LIFE_SN' | 'STRAIN_LIFE_EN' | 'CONSTANT_AMPLITUDE' | 'RAINFLOW_MINER';

export type FailureCriterion =
  | 'DATASET_THRESHOLD'
  | 'CRACK_INITIATION'
  | 'TOTAL_STRAIN'
  | 'ENDURANCE_LIMIT';

export type FatigueClassification =
  | 'SAFE_UNDER_CRITERION'
  | 'FINITE_LIFE'
  | 'FAILURE_PREDICTED'
  | 'OUT_OF_VALIDITY'
  | 'INSUFFICIENT_DATA';

export type FatigueErrorCode =
  | 'INSUFFICIENT_FATIGUE_DATA'
  | 'MATERIAL_DATASET_MISMATCH'
  | 'OUT_OF_VALIDITY_RANGE'
  | 'UNIT_VALIDATION_FAILED'
  | 'INVALID_FEM_INPUT'
  | 'MODEL_OUT_OF_VALIDITY'
  | 'FATIGUE_SOURCE_CONFLICT';

export interface SNDataPoint {
  pointId: string;
  stressValue: number; // e.g., MPa or Pa
  stressUnit: string;
  stressCanonicalPa: number;
  cyclesToFailure: number; // N_f (dimensionless)
  temperatureKelvin: number;
  loadRatioR: number; // R = sigma_min / sigma_max
  condition?: MaterialTemperCondition | string;
  source?: PropertySource;
  evidenceId?: string;
}

export interface SNFittedModel {
  modelType: 'BASQUIN' | 'LOG_LINEAR' | 'KOHOUT_VECHET';
  basquinA?: number; // S_f = A * (N_f)^b
  basquinB?: number;
  fittingErrorR2?: number;
  validCyclesRange: {
    minCycles: number;
    maxCycles: number;
  };
  validTemperatureKelvinRange: {
    min: number;
    max: number;
  };
  fittedBy?: string;
  fitDate?: string;
}

export interface SNDataset {
  datasetId: string;
  materialId: string;
  materialRevision: number;
  datasetRevision: number;
  condition: MaterialTemperCondition | string;
  rawPoints: SNDataPoint[];
  fittedModel?: SNFittedModel;
  enduranceLimitPa?: number; // S_e in Pa
  enduranceCyclesThreshold?: number; // e.g. 1e7 cycles
  validityRange: {
    minTemperatureKelvin: number;
    maxTemperatureKelvin: number;
    minStressPa: number;
    maxStressPa: number;
  };
  propertyUnit: string;
  canonicalUnit: string;
  source: PropertySource;
  status: 'DRAFT' | 'REVIEW' | 'VALIDATED' | 'APPROVED';
  datasetHash: string;
  createdDate: string;
}

export interface StressCycleParameters {
  maxStressPa: number;
  minStressPa: number;
  stressAmplitudePa: number;
  meanStressPa: number;
  stressRangePa: number;
  loadRatioR: number;
  frequencyHz?: number;
}

export interface StressHistoryPoint {
  timestampSec: number;
  stressPa: number; // Equivalent Von Mises or 1D axial stress
  temperatureK?: number;
  loadCaseId?: string;
  elementOrNodeId?: string;
}

export interface StrainHistoryPoint {
  timestampSec: number;
  totalStrain: number;
  elasticStrain?: number;
  plasticStrain?: number;
  temperatureK?: number;
}

export interface RainflowCycle {
  cycleId: string;
  stressRangePa: number;
  meanStressPa: number;
  stressAmpPa: number;
  minStressPa: number;
  maxStressPa: number;
  loadRatioR: number;
  count: number; // 0.5 for half cycle (reversal), 1.0 for full cycle
  startIdx: number;
  endIdx: number;
}

export interface RainflowHistogramBin {
  binId: string;
  minRangePa: number;
  maxRangePa: number;
  meanStressPa: number;
  cycleCount: number;
  temperatureK: number;
}

export interface CycleDamageResult {
  cycleId: string;
  stressAmpPa: number;
  meanStressPa: number;
  equivalentAmpPa: number;
  appliedCycles: number;
  allowableCyclesNf: number;
  damage: number; // n_i / N_i
}

export interface CumulativeDamageResult {
  totalDamage: number; // D = sum(n_i / N_i)
  isFailurePredicted: boolean;
  damageThreshold: number; // e.g., 1.0
  equivalentAllowableCycles: number;
  perCycleGroupDamage: CycleDamageResult[];
  modelLimitationNotice: string;
}

export interface ElementFatigueResult {
  elementId: string;
  nodeId?: string;
  maxStressPa: number;
  minStressPa: number;
  stressAmpPa: number;
  meanStressPa: number;
  loadRatioR: number;
  equivalentAmpPa: number;
  meanStressModelUsed: MeanStressCorrectionModel;
  predictedCyclesToFailure: number;
  damagePerBlock: number;
  fatigueSafetyFactor: number;
  classification: FatigueClassification;
}

export interface CriticalFatigueLocation {
  elementId: string;
  nodeId?: string;
  minCyclesToFailure: number;
  maxDamage: number;
  minFatigueSafetyFactor: number;
  locationCoordinates?: [number, number, number];
}

export interface FEMStressInput {
  meshId: string;
  meshRevision: number;
  loadCaseId: string;
  elementStresses: {
    elementId: string;
    nodeId?: string;
    stressPa: number; // Von Mises or Max Principal
  }[];
  isValidFEM: boolean;
  provenanceHash: string;
}

export interface FatigueAnalysis {
  analysisId: string;
  componentId: string;
  meshId: string;
  materialId: string;
  materialRevision: number;
  datasetRevision: number;
  fatigueDatasetId: string;
  loadMethod: FatigueMethod;
  constantLoadParams?: StressCycleParameters;
  stressHistory?: StressHistoryPoint[];
  temperatureK: number;
  temperatureUnit: TemperatureUnit;
  meanStressModel: MeanStressCorrectionModel;
  failureCriterion: FailureCriterion;
  elementResults: ElementFatigueResult[];
  criticalLocation: CriticalFatigueLocation;
  cumulativeDamage?: CumulativeDamageResult;
  classification: FatigueClassification;
  evidenceHash: string;
  createdDate: string;
  status: 'DRAFT' | 'COMPLETED' | 'VALIDATED' | 'FAILED';
  errorMessage?: string;
  errorCode?: FatigueErrorCode;
}

export interface FatigueAnalysisSnapshot {
  snapshotId: string;
  analysisId: string;
  meshRevision: number;
  materialRevision: number;
  datasetRevision: number;
  loadHistoryHash: string;
  temperatureK: number;
  solverVersion: string;
  resultHash: string;
  snapshotHash: string; // Cryptographic SHA-256 fingerprint
  createdDate: string;
}

export interface FatigueEngineeringReport {
  analysisId: string;
  componentId: string;
  materialName: string;
  materialGrade: string;
  materialCondition: string;
  temperatureK: number;
  temperatureUnit: TemperatureUnit;
  loadMethod: FatigueMethod;
  meanStressCorrection: MeanStressCorrectionModel;
  failureCriterion: FailureCriterion;
  fatigueDatasetSource: string;
  summary: {
    minLifeCycles: number;
    maxDamagePerBlock: number;
    minFatigueSafetyFactor: number;
    classification: FatigueClassification;
  };
  criticalLocation: CriticalFatigueLocation;
  evidenceHash: string;
  digitalCertificateSHA256: string;
  timestamp: string;
  limitations: string[];
}
