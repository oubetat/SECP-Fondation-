/**
 * PATCH-178: Materials Benchmark Battery & Gate 178 Types
 *
 * Defines explicit truth verdicts, benchmark case categories, evidence packets,
 * error metrics, and gate criteria for materials evaluation in SECP.
 */

export type MaterialsBenchmarkVerdict =
  | 'PASS'
  | 'FAIL'
  | 'UNPROVEN'
  | 'INCONCLUSIVE'
  | 'INVALID'
  | 'NOT_SUPPORTED';

export type MaterialsCaseId =
  | 'BENCH-MAT-01'
  | 'BENCH-MAT-02'
  | 'BENCH-MAT-03'
  | 'BENCH-MAT-04'
  | 'BENCH-MAT-05'
  | 'BENCH-MAT-06'
  | 'BENCH-MAT-07'
  | 'BENCH-MAT-08'
  | 'BENCH-MAT-09'
  | 'BENCH-MAT-10'
  | 'BENCH-MAT-11'
  | 'BENCH-MAT-12'
  | 'BENCH-MAT-13'
  | 'BENCH-MAT-14'
  | 'BENCH-MAT-15'
  | 'BENCH-MAT-16';

export type MaterialsCaseCategory =
  | 'ELASTIC_CONSISTENCY'
  | 'UNIAXIAL_ELASTIC'
  | 'POISSON_RESPONSE'
  | 'SHEAR_RESPONSE'
  | 'BULK_VOLUMETRIC'
  | 'UNIT_CONSISTENCY'
  | 'DENSITY_MASS'
  | 'MATERIAL_SENSITIVITY'
  | 'TEMPERATURE_DEPENDENT'
  | 'PLASTICITY'
  | 'MATERIAL_HISTORY'
  | 'MATERIAL_PROVENANCE'
  | 'MATERIAL_TAMPER'
  | 'MATERIAL_COMPARISON'
  | 'EXTREME_INVALID'
  | 'SOLVER_INTEGRATION';

export interface MaterialsBenchmarkMetrics {
  absoluteError: number;
  relativeErrorPercent: number;
  stressErrorPercent: number;
  strainErrorPercent: number;
  displacementErrorPercent: number;
  propertyErrorPercent: number;
  unitConversionErrorPercent: number;
  reproducibilityVariance: number;
  runtimeMs: number;
  measuredValue: number;
  referenceValue: number;
  unit: string;
}

export interface MaterialsEvidencePacket {
  benchmarkId: string;
  materialId: string;
  materialVersion: number;
  materialProperties: Record<string, number>;
  units: string;
  modelIdentity: string;
  inputHash: string;
  solverConfiguration: string;
  referenceSource: string;
  referenceResult: number;
  measuredResult: number;
  errorMetrics: MaterialsBenchmarkMetrics;
  executionMetadata: Record<string, any>;
  verdict: MaterialsBenchmarkVerdict;
  evidenceHash: string;
}

export interface MaterialsBenchmarkCaseResult {
  caseId: MaterialsCaseId;
  caseName: string;
  category: MaterialsCaseCategory;
  materialName: string;
  verdict: MaterialsBenchmarkVerdict;
  metrics: MaterialsBenchmarkMetrics;
  details: string;
  evidencePacket: MaterialsEvidencePacket;
  evidenceHash: string;
}

export interface Gate178CriterionResult {
  id: string;
  name: string;
  passed: boolean;
  verdict: MaterialsBenchmarkVerdict;
  score: number;
  details: string;
}

export interface Gate178EvaluationResult {
  gateId: 'PATCH178_MATERIALS_BENCHMARK_GATE';
  passed: boolean;
  score: number;
  finalVerdict: MaterialsBenchmarkVerdict;
  criteriaResults: Gate178CriterionResult[];
  attestationSignature: string;
  timestamp: string;
}

export interface MaterialsAdversarialTestResult {
  testId: string;
  description: string;
  passed: boolean;
  verdict: MaterialsBenchmarkVerdict;
  details: string;
}

export interface MaterialsBenchmarkSuiteReport {
  timestamp: string;
  caseResults: MaterialsBenchmarkCaseResult[];
  adversarialResults: MaterialsAdversarialTestResult[];
  auditSummary: {
    passed: boolean;
    violationsCount: number;
    details: string[];
  };
  gateResult: Gate178EvaluationResult;
  finalVerdict: MaterialsBenchmarkVerdict;
  evidenceLedgerId: string;
}
