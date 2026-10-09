/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-071: CFD Validation Framework Types & Interfaces
 */

export interface PhysicalReferenceData {
  readonly referenceId: string;
  readonly datasetName: string;
  readonly coordinates: readonly { x: number; y: number }[];
  readonly values: readonly number[];
  readonly uncertainty: readonly number[]; // Experimental uncertainty (U_exp)
}

export interface ValidationMetricResult {
  readonly L1Discrepancy: number;
  readonly L2Discrepancy: number;
  readonly LMaxDiscrepancy: number;
  readonly validationVerdict: 'VALIDATED' | 'NOT_VALIDATED' | 'INCONCLUSIVE';
}

export interface ValidationStudy {
  readonly studyId: string;
  readonly caseId: string;
  readonly referenceDatasetId: string;
  readonly verdict: string;
}
