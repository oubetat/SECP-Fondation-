/**
 * PATCH-177: FEM Benchmark Types & Data Contracts
 * 
 * Defines truth-focused data contracts for FEM solver benchmarks, metrics,
 * reference solutions, adversarial cases, tolerance policies, anti-fabrication audits,
 * and Hard Acceptance Gate 177 evaluation.
 */

export type FEMBenchmarkVerdict =
  | 'PASS'
  | 'FAIL'
  | 'UNPROVEN'
  | 'INCONCLUSIVE'
  | 'NOT_CONVERGED'
  | 'INVALID';

export type FEMBenchmarkCaseCategory =
  | 'AXIAL_BAR_1D'
  | 'CANTILEVER_BEAM'
  | 'UNIAXIAL_TENSION'
  | 'PATCH_TEST'
  | 'MESH_CONVERGENCE'
  | 'BOUNDARY_ROBUSTNESS'
  | 'GLOBAL_EQUILIBRIUM'
  | 'MATERIAL_SENSITIVITY'
  | 'LOAD_SCALING'
  | 'RIGID_BODY_ADVERSARIAL'
  | 'ADVERSARIAL_PATHOLOGY';

export interface FEMTolerancePolicy {
  referenceTolerancePercent: number;
  numericalTolerance: number;
  equilibriumToleranceN: number;
  convergenceTolerance: number;
  toleranceJustification: string;
}

export interface FEMBenchmarkMetrics {
  maxDisplacementMm: number;
  referenceDisplacementMm: number;
  displacementErrorPercent: number;

  maxVonMisesStressMPa: number;
  referenceStressMPa: number;
  stressErrorPercent: number;

  maxStrain: number;
  referenceStrain: number;
  strainErrorPercent: number;

  reactionForceErrorPercent: number;
  independentEquilibriumResidualN: number;
  relativeL2Error: number;

  dofCount: number;
  elementCount: number;
  nodeCount: number;
  runtimeMs: number;
  iterationCount: number;

  meshConvergenceTrend?: 'MONOTONIC_CONVERGENCE' | 'OSCILLATORY' | 'DIVERGENT' | 'UNPROVEN';
  loadProportionalityErrorPercent?: number;
  materialSensitivityRatioErrorPercent?: number;
}

export interface FEMBenchmarkCaseResult {
  caseId: string;
  caseName: string;
  category: FEMBenchmarkCaseCategory;
  verdict: FEMBenchmarkVerdict;

  metrics: FEMBenchmarkMetrics;
  tolerancePolicy: FEMTolerancePolicy;

  inputHash: string;
  solverConfigHash: string;
  executionEvidenceHash: string;

  details: string;
  failureReason?: string;
}

export interface FEMAntiFabricationAuditRecord {
  hardcodedValuesDetected: boolean;
  hardcodedRuntimeDetected: boolean;
  mockedSolverExecutionDetected: boolean;
  cachedResultReuseDetected: boolean;
  auditVerdict: 'PASS' | 'FAIL';
  flaggedItems: string[];
}

export interface FEMAdversarialTestResult {
  testId: string;
  testName: string;
  attackVector: string;
  expectedVerdict: FEMBenchmarkVerdict;
  actualVerdict: FEMBenchmarkVerdict;
  detectedBy: string;
  passed: boolean;
  details: string;
}

export interface Gate177CriterionResult {
  id: string;
  name: string;
  passed: boolean;
  score: number; // Max 12.5 points per criterion (8 * 12.5 = 100)
  details: string;
}

export interface Gate177EvaluationResult {
  passed: boolean;
  score: number;
  criteriaResults: Gate177CriterionResult[];
  attestationSignature: string;
}

export interface FinalFEMBenchmarkReport {
  benchmarkId: string;
  timestamp: string;
  summary: {
    totalCases: number;
    passed: number;
    failed: number;
    unproven: number;
    inconclusive: number;
    invalid: number;
    notConverged: number;
  };

  caseResults: FEMBenchmarkCaseResult[];
  adversarialResults: FEMAdversarialTestResult[];
  antiFabricationAudit: FEMAntiFabricationAuditRecord;
  determinismHashList: string[];
  isDeterministic: boolean;

  gateResult: Gate177EvaluationResult;
  finalVerdict: FEMBenchmarkVerdict;
}
