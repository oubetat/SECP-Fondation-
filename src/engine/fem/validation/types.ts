export enum ValidationVerdict {
  VALIDATED = 'VALIDATED',
  NOT_VALIDATED = 'NOT_VALIDATED',
  PARTIALLY_VALIDATED = 'PARTIALLY_VALIDATED',
  VALIDATION_FAILURE = 'VALIDATION_FAILURE',
  INSUFFICIENT_REFERENCE_DATA = 'INSUFFICIENT_REFERENCE_DATA',
  REFERENCE_DATA_INTEGRITY_FAILURE = 'REFERENCE_DATA_INTEGRITY_FAILURE',
  OUTSIDE_VALIDATION_DOMAIN = 'OUTSIDE_VALIDATION_DOMAIN',
  EXPERIMENTAL_CORRELATION_FAILURE = 'EXPERIMENTAL_CORRELATION_FAILURE',
  MATERIAL_CORRELATION_FAILURE = 'MATERIAL_CORRELATION_FAILURE',
  LOAD_CORRELATION_FAILURE = 'LOAD_CORRELATION_FAILURE',
  BC_CORRELATION_FAILURE = 'BC_CORRELATION_FAILURE',
  DISPLACEMENT_CORRELATION_FAILURE = 'DISPLACEMENT_CORRELATION_FAILURE',
  STRAIN_CORRELATION_FAILURE = 'STRAIN_CORRELATION_FAILURE',
  STRESS_CORRELATION_FAILURE = 'STRESS_CORRELATION_FAILURE',
  MODAL_CORRELATION_FAILURE = 'MODAL_CORRELATION_FAILURE',
  BUCKLING_CORRELATION_FAILURE = 'BUCKLING_CORRELATION_FAILURE',
  FATIGUE_CORRELATION_FAILURE = 'FATIGUE_CORRELATION_FAILURE',
  UNCERTAINTY_INCONCLUSIVE = 'UNCERTAINTY_INCONCLUSIVE',
  MODEL_FORM_UNCERTAINTY = 'MODEL_FORM_UNCERTAINTY',
  CALIBRATION_CONTAMINATION = 'CALIBRATION_CONTAMINATION',
  HOLDOUT_FAILURE = 'HOLDOUT_FAILURE',
  INDEPENDENT_VALIDATION_FAILURE = 'INDEPENDENT_VALIDATION_FAILURE',
  NUMERICAL_RESULT_INVALID = 'NUMERICAL_RESULT_INVALID'
}

export enum ValidationStatus {
  PASS = 'PASS',
  FAIL = 'FAIL',
  WARNING = 'WARNING',
  NOT_APPLICABLE = 'NOT_APPLICABLE',
  INCONCLUSIVE = 'INCONCLUSIVE'
}

export enum ReferenceSourceType {
  EXPERIMENTAL = 'EXPERIMENTAL',
  PUBLISHED_EXPERIMENT = 'PUBLISHED_EXPERIMENT',
  CERTIFIED_TEST = 'CERTIFIED_TEST',
  TRUSTED_REFERENCE_DATABASE = 'TRUSTED_REFERENCE_DATABASE',
  INDUSTRIAL_TEST = 'INDUSTRIAL_TEST',
  INTERLABORATORY_TEST = 'INTERLABORATORY_TEST'
}

export interface ReferenceDataset {
  datasetId: string;
  source: string;
  sourceType: ReferenceSourceType;
  acquisitionDate: string;
  datasetVersion: string;
  rawDataHash: string;
  units: string;
  data: any;
  uncertainty: number;
}

export interface ValidationMetricResult {
  metricId: string;
  description: string;
  measured: number;
  predicted: number;
  error: number;
  uncertainty: number;
  status: ValidationStatus;
}

export interface StructuralValidationEvidence {
  validationId: string;
  caseId: string;
  analysisId: string;
  referenceDatasetId: string;
  verdict: ValidationVerdict;
  metrics: ValidationMetricResult[];
  timestamp: string;
  provenanceHash: string;
}

export interface HardAcceptanceGate088Check {
  id: string;
  description: string;
  passed: boolean;
  details?: string;
}

export interface HardAcceptanceGate088Report {
  verdict: string;
  totalChecks: number;
  passedChecks: number;
  failedChecks: number;
  checks: HardAcceptanceGate088Check[];
  timestamp: string;
}
