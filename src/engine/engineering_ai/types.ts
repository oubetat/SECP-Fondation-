export type EngineeringAIModelType =
  | 'SURROGATE_MODEL'
  | 'REGRESSION_MODEL'
  | 'CLASSIFICATION_MODEL'
  | 'ANOMALY_DETECTOR'
  | 'TIME_SERIES_MODEL'
  | 'GRAPH_MODEL'
  | 'GEOMETRIC_MODEL'
  | 'PHYSICS_INFORMED_MODEL'
  | 'OPTIMIZATION_MODEL'
  | 'GENERATIVE_MODEL'
  | 'FOUNDATION_MODEL'
  | 'HYBRID_PHYSICS_AI_MODEL';

export type EngineeringAIModelStatus =
  | 'DRAFT'
  | 'TRAINING'
  | 'EVALUATING'
  | 'QUALIFIED'
  | 'ACTIVE'
  | 'DEPRECATED'
  | 'RETIRED'
  | 'QUARANTINED';

export type UncertaintyType =
  | 'ALEATORIC'
  | 'EPISTEMIC'
  | 'MODEL'
  | 'DATA'
  | 'MEASUREMENT'
  | 'NUMERICAL'
  | 'TOTAL';

export type OODStatus =
  | 'IN_DOMAIN'
  | 'NEAR_BOUNDARY'
  | 'OUT_OF_DISTRIBUTION'
  | 'UNKNOWN';

export type AIGuardrailVerdict =
  | 'ALLOWED'
  | 'ALLOWED_WITH_WARNING'
  | 'REJECTED'
  | 'OUT_OF_DOMAIN'
  | 'INSUFFICIENT_EVIDENCE'
  | 'PHYSICS_VIOLATION'
  | 'MODEL_NOT_QUALIFIED';

export type AIVerificationVerdict =
  | 'VERIFIED'
  | 'NOT_VERIFIED'
  | 'OUT_OF_DOMAIN'
  | 'PHYSICS_FAILURE'
  | 'INSUFFICIENT_EVIDENCE'
  | 'REPRODUCIBILITY_FAILURE'
  | 'INVALID'
  | 'MODEL_INTEGRITY_FAILURE'
  | 'FUTURE_DATA_LEAKAGE';

export interface AIInputRange {
  field: string;
  min: number;
  max: number;
  unit: string;
}

export interface AIInputContract {
  schemaId: string;
  units: Record<string, string>;
  dimensions: Record<string, number[]>;
  ranges: AIInputRange[];
  requiredFields: string[];
  optionalFields: string[];
  coordinateSystem: string;
  referenceFrame: string;
  validityRules: string[];
}

export interface AIOutputContract {
  outputType: string;
  unit: string;
  validRange: [number, number];
  supportUncertainty: boolean;
  limitations: string[];
}

export interface EngineeringAIModel {
  modelId: string;
  modelName: string;
  modelType: EngineeringAIModelType;
  version: string;
  domain: string;
  architecture: string;
  trainingDatasetId: string;
  featureSchemaId: string;
  inputContract: AIInputContract;
  outputContract: AIOutputContract;
  parameterHash: string;
  modelHash: string;
  weights: Record<string, number>;
  createdAt: string;
  status: EngineeringAIModelStatus;
  configuration?: Record<string, any>;
  configurationHash?: string;
  weightsHash?: string;
  modelBinaryHash?: string;
  runtimeIdentity?: string;
}

export interface EngineeringAIContext {
  contextId: string;
  geometryState: Record<string, any>;
  materialState: Record<string, any>;
  physicsState: Record<string, any>;
  manufacturingState: Record<string, any>;
  assemblyState: Record<string, any>;
  telemetryState: Record<string, any>;
  configurationState: Record<string, any>;
  evidenceSnapshotHash: string;
  timestamp: string;
  contextHash: string;
  nonEngineeringMetadata?: Record<string, any>;
  crossDomainHandoffId?: string;
}

export interface EngineeringFeatureSchema {
  featureId: string;
  name: string;
  type: string;
  unit: string;
  source: string;
  transformation: string;
  version: string;
  hash: string;
}

export interface FeatureVector {
  schemaId: string;
  features: Record<string, number>;
  featureHash: string;
}

export interface AIUncertainty {
  type: UncertaintyType;
  value: number;
  confidenceInterval: [number, number];
}

export interface AIInferenceRecord {
  inferenceId: string;
  occurrenceId?: string;
  modelId: string;
  modelVersion: string;
  contextHash: string;
  inputHash: string;
  featureHash: string;
  outputHash: string;
  resultDigest?: string;
  executionHash: string;
  executionIdentity?: string;
  timestamp: string;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  runtimeVersion: string;
  status: 'SUCCESS' | 'OOD' | 'PHYSICS_VIOLATION' | 'REJECTED';
  determinism: 'DETERMINISTIC' | 'NON_DETERMINISTIC';
  seed?: number;
  inputs: Record<string, any>;
  prediction: number | Record<string, any>;
  uncertainty: AIUncertainty;
  oodStatus: OODStatus;
  guardrailVerdict: AIGuardrailVerdict;
  provenanceRecord?: AIProvenanceRecord;
}

export interface AIProvenanceRecord {
  inferenceId: string;
  occurrenceId?: string;
  modelId: string;
  modelVersion: string;
  modelHash?: string;
  weightsHash?: string;
  datasetId: string;
  featureSchemaId: string;
  runtimeVersion: string;
  operator: string;
  canonicalRevisionId?: string;
  canonicalRevisionHash?: string;
  contextHash: string;
  inputHash?: string;
  outputHash?: string;
  executionHash?: string;
  provenanceHash?: string;
  timestamp: string;
}

export interface AIPhysicsResidual {
  aiPrediction: number;
  physicsValue: number;
  absoluteError: number;
  relativeError: number;
  isWithinTolerance: boolean;
}

export interface AIDeploymentRecord {
  deploymentId: string;
  modelId: string;
  modelVersion: string;
  environment: string;
  deployedAt: string;
  deployedBy: string;
  status: 'ACTIVE' | 'ROLLED_BACK' | 'SUPERSEDED';
}
