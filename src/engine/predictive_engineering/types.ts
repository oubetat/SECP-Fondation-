export type PredictionStatus = 'CREATED' | 'INPUT_INVALID' | 'RUNNING' | 'COMPLETED' | 'PARTIAL' | 'UNCERTAIN' | 'OUT_OF_DOMAIN' | 'VALIDATED' | 'REJECTED' | 'FAILED' | 'STALE' | 'INVALID';
export type ModelStatus = 'REGISTERED' | 'VERSIONED' | 'TRACEABLE' | 'VALIDATED' | 'APPROVED' | 'DEPRECATED' | 'RETIRED';
export type UncertaintyType = 'ALEATORIC' | 'EPISTEMIC' | 'PARAMETRIC' | 'MODEL' | 'MEASUREMENT' | 'NUMERICAL' | 'TOTAL';
export type OODStatus = 'IN_DOMAIN' | 'NEAR_BOUNDARY' | 'OUT_OF_DISTRIBUTION' | 'UNKNOWN';
export type PredictionVerdict = 'PREDICTED' | 'VALIDATED' | 'UNCERTAIN' | 'OUT_OF_DOMAIN' | 'PHYSICS_INCONSISTENT' | 'MODEL_DISAGREEMENT' | 'REJECTED' | 'INVALID';

export interface PredictiveEngineeringRecord {
  predictionId: string;
  entityId: string;
  entityType: string;
  predictionType: string;
  modelId: string;
  modelVersion: string;
  inputStateId: string;
  inputStateHash: string;
  predictionVersion: number;
  createdAt: string;
  horizon: number;
  horizonUnit: string;
  predictionValue: number;
  predictionUnit: string;
  uncertainty: number;
  confidenceLevel: number;
  status: PredictionVerdict; // Using verdict as status for simplicity in this representation
  predictionRootHash: string;
  oodStatus: OODStatus;
  physicsPlausibility: boolean;
}

export interface PredictionModel {
  modelId: string;
  modelVersion: string;
  modelType: string;
  domain: string;
  status: ModelStatus;
  inputBounds: Record<string, { min: number, max: number }>;
  canonicalUnits: Record<string, string>;
  modelHash: string;
}

export interface PredictionInputSnapshot {
  snapshotId: string;
  geometryHash: string;
  materialHash: string;
  telemetryHash: string;
  configurationHash: string;
  features: Record<string, { value: number, unit: string }>;
  snapshotHash: string;
}

export interface UncertaintyEstimation {
  uncertaintyType: UncertaintyType;
  uncertaintyValue: number;
  confidenceLevel: number;
  lowerBound: number;
  upperBound: number;
}
