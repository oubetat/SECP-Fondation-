export type ValidationVerdict =
  | 'VALIDATED'
  | 'PARTIALLY_VALIDATED'
  | 'NOT_VALIDATED'
  | 'UNPROVEN'
  | 'FAILED'
  | 'INCONCLUSIVE'
  | 'NOT_INDEPENDENT'
  | 'TAMPER_DETECTED';

export interface ValidationMetric {
  name: string;
  referenceValue: any;
  secpValue: any;
  absoluteError: number;
  relativeError: number;
  tolerance: number;
  verdict: ValidationVerdict;
}

export interface ValidationScenario {
  id: string;
  capability: string;
  benchmarkName: string;
  referenceSource: string;
  referenceMethod: string;
  secpMethod: string;
  independenceAssessment: 'INDEPENDENT' | 'NOT_INDEPENDENT';
  metrics: ValidationMetric[];
  verdict: ValidationVerdict;
  reproducibilityStatus: 'REPRODUCIBLE' | 'NOT_REPRODUCIBLE' | 'UNPROVEN';
  notes?: string;
}

export interface ValidationMatrixEntry {
  capability: string;
  benchmark: string;
  reference: string;
  secpResult: string;
  error: string;
  tolerance: string;
  evidence: string;
  independentVerification: string;
  verdict: ValidationVerdict;
}

export interface ExternalValidationReport {
  timestamp: string;
  benchmarkVersion: string;
  executiveVerdict: ValidationVerdict;
  independenceAuditVerdict: 'PASS' | 'FAIL';
  scenarios: ValidationScenario[];
  matrix: ValidationMatrixEntry[];
  unprovenAreas: string[];
}
