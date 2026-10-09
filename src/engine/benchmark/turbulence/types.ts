/**
 * PATCH-176: CFD Turbulence Benchmark & Hard Acceptance Gate 176
 * Type Definitions & Data Models
 */

export type TurbulenceModelName =
  | 'LAMINAR'
  | 'K_EPSILON'
  | 'K_OMEGA'
  | 'SST_K_OMEGA'
  | 'SPALART_ALLMARAS'
  | 'RANS_RSM';

export type ImplementationStatus =
  | 'IMPLEMENTED'
  | 'PARTIALLY_IMPLEMENTED'
  | 'ABSTRACT_ONLY'
  | 'NOT_IMPLEMENTED';

export type SolverIntegrationStatus =
  | 'FULLY_INTEGRATED'
  | 'PARTIALLY_INTEGRATED'
  | 'DECOUPLED'
  | 'NOT_INTEGRATED';

export type ExecutionStatus =
  | 'EXECUTED'
  | 'STATIC_EXECUTION'
  | 'FROZEN_FIELDS'
  | 'NOT_EXECUTED';

export type VerificationStatus =
  | 'VERIFIED'
  | 'PARTIALLY_VERIFIED'
  | 'UNVERIFIED';

export type ValidationStatus =
  | 'VALIDATED'
  | 'UNPROVEN'
  | 'FAILED_VALIDATION';

export interface TurbulenceModelAuditRecord {
  model: TurbulenceModelName;
  displayName: string;
  implementation: ImplementationStatus;
  solverIntegration: SolverIntegrationStatus;
  execution: ExecutionStatus;
  verification: VerificationStatus;
  validation: ValidationStatus;
  dynamicTransportUpdated: boolean;
  notes: string;
}

export interface ExecutionPathAudit {
  laminarToTurbulenceDiffDetected: boolean;
  velocityMaxDiffPercent: number;
  viscosityMaxDiffPercent: number;
  pressureDropDiffPercent: number;
  turbulentViscosityActive: boolean;
  isTurbulenceFieldDynamic: boolean; // Checks if k/eps evolves between iterations or remains frozen
  executionPathStatus: 'DYNAMIC_TURBULENCE_ACTIVE' | 'STATIC_TURBULENCE_EFFECTIVE' | 'DECOUPLED_FROZEN' | 'IDENTICAL_TO_LAMINAR';
  details: string;
}

export type BenchmarkCaseId =
  | 'TC-TURB-01-CHANNEL'
  | 'TC-TURB-02-PIPE'
  | 'TC-TURB-03-FLAT-PLATE'
  | 'TC-TURB-04-ADVERSE-PRESSURE';

export interface ReynoldsCalculationInput {
  fluidDensity: number;
  fluidViscosity: number;
  bulkVelocity: number;
  characteristicLength: number;
  calculatedReynoldsNumber: number;
  reynoldsFormula: string;
  flowRegimeClassification: 'LAMINAR' | 'TRANSITIONAL' | 'TURBULENT';
}

export interface WallTreatmentAudit {
  yPlusMin: number;
  yPlusMax: number;
  yPlusMean: number;
  wallDistanceCalculated: boolean;
  wallShearPa: number;
  frictionVelocityUTau: number;
  wallFunctionType: 'STANDARD_LOG_LAW' | 'LOW_RE_DAMPING' | 'NO_WALL_FUNCTION' | 'UNPROVEN';
  nearWallMeshResolutionOK: boolean;
  details: string;
}

export interface TurbulentQuantitiesReport {
  kMin: number;
  kMax: number;
  kMean: number;
  epsMin: number;
  epsMax: number;
  epsMean: number;
  nutMin: number;
  nutMax: number;
  nutMean: number;
  turbulentToLaminarViscosityRatioMax: number;
  hasNaN: boolean;
  hasInf: boolean;
  hasNegativeK: boolean;
  hasNegativeEps: boolean;
  isPhysicallyBounded: boolean;
  isDecoupledFromSolver: boolean;
}

export interface ViscosityVerificationResult {
  isNutCalculatedFromModel: boolean;
  isNutConstant: boolean;
  nutFormulaUsed: string;
  nutMaxPaS: number;
  momentumDiffusionConductanceAltered: boolean;
  impactOnWallShearPercent: number;
  status: 'DYNAMIC_VISCOSITY_VERIFIED' | 'STATIC_VISCOSITY_EFFECTIVE' | 'FROZEN_CONSTANT' | 'FAIL';
}

export interface MeshSensitivityPoint {
  meshLevel: 'COARSE' | 'MEDIUM' | 'FINE';
  cellCount: number;
  maxVelocityMS: number;
  pressureDropPa: number;
  wallShearPa: number;
  maxNutPaS: number;
  continuityResidual: number;
  massErrorPercent: number;
}

export interface MeshSensitivityStudy {
  caseId: BenchmarkCaseId;
  points: MeshSensitivityPoint[];
  velocityGCIPercent: number; // Grid Convergence Index
  frictionGCIPercent: number;
  isGridConverging: boolean;
  convergenceTrend: 'MONOTONIC_CONVERGENCE' | 'OSCILLATORY' | 'DIVERGENT' | 'STAGNANT';
  status: 'CONVERGED' | 'NOT_CONVERGED' | 'UNPROVEN';
}

export interface NumericalStabilityAudit {
  initialConditionSensitivity: 'ROBUST' | 'MODERATE' | 'SENSITIVE' | 'UNSTABLE';
  underRelaxationStability: 'STABLE_RANGE' | 'NARROW_RANGE' | 'UNSTABLE';
  meshDensityStability: 'STABLE' | 'SENSITIVE';
  turbulenceInitSensitivity: 'ROBUST' | 'HIGHLY_SENSITIVE';
  overallStabilityVerdict: 'STABLE' | 'SENSITIVE' | 'UNSTABLE';
}

export interface ModelComparisonResult {
  caseId: BenchmarkCaseId;
  model: TurbulenceModelName;
  iterationsToConverge: number;
  finalContinuityResidual: number;
  massImbalancePercent: number;
  pressureDropPa: number;
  wallShearPa: number;
  maxNutPaS: number;
  referenceFrictionErrorPercent: number;
  convergenceStatus: 'CONVERGED' | 'NOT_CONVERGED' | 'DIVERGED';
}

export interface ReferenceValidationResult {
  caseId: BenchmarkCaseId;
  caseName: string;
  calculatedValue: number;
  referenceValue: number;
  metricName: string;
  unit: string;
  referenceSource: string; // e.g. "Moody / Colebrook-White Correlation (1939)" or "Dean Channel Profile (1978)"
  absoluteError: number;
  relativeErrorPercent: number;
  normalizedError: number;
  tolerancePercent: number;
  status: 'PASS' | 'FAIL' | 'UNPROVEN';
}

export interface AntiFabricationAuditRecord {
  hardcodedMetricsDetected: boolean;
  fabricatedReferenceConstantsFound: boolean;
  fakeConvergenceResidualsFound: boolean;
  syntheticTimeoutSimulationFound: boolean;
  unusedModelsFlagged: string[];
  frozenFieldsFlagged: string[];
  auditVerdict: 'PASS' | 'FAIL';
  flaggedItems: string[];
}

export interface AdversarialTurbulenceTestResult {
  testId: string;
  testName: string;
  attackVector: string;
  expectedOutcome: 'INVALID' | 'FAIL' | 'NOT_CONVERGED' | 'UNPROVEN';
  actualOutcome: 'INVALID' | 'FAIL' | 'NOT_CONVERGED' | 'UNPROVEN' | 'PASS_UNEXPECTED';
  detectedBy: string;
  passed: boolean; // True if adversarial attack was correctly intercepted
  details: string;
}

export interface DeterminismResult {
  isDeterministic: boolean;
  isReproducible: boolean;
  runsTested: number;
  resultHashesMatch: boolean;
  residualHistoriesMatch: boolean;
  hashList: string[];
  status: 'DETERMINISTIC' | 'REPRODUCIBLE' | 'NUMERICALLY_TOLERANT' | 'NON_REPRODUCIBLE';
}

export interface TurbulenceEvidencePacket {
  benchmarkId: string;
  caseId: BenchmarkCaseId;
  geometryHash: string;
  meshHash: string;
  inputHash: string;
  solverVersion: string;
  turbulenceModel: TurbulenceModelName;
  reynoldsInput: ReynoldsCalculationInput;
  boundaryConditions: Record<string, unknown>;
  iterationCount: number;
  convergenceStatus: string;
  conservationMetrics: {
    massErrorPercent: number;
    momentumErrorPercent: number;
  };
  turbulenceMetrics: TurbulentQuantitiesReport;
  referenceValidation: ReferenceValidationResult;
  resultHash: string;
  timestamp: string;
  runtimeEnvironment: string;
  verdict: TurbulenceVerdict;
  attestationSignature: string;
}

export type TurbulenceVerdict =
  | 'PASS'
  | 'FAIL'
  | 'UNPROVEN'
  | 'NOT_CONVERGED'
  | 'INVALID'
  | 'CONSERVATION_FAILURE';

export interface FinalTurbulenceBenchmarkReport {
  benchmarkId: string;
  timestamp: string;
  discoveredModels: TurbulenceModelAuditRecord[];
  executedModelsCount: number;
  verifiedModelsCount: number;
  executionPathAudit: ExecutionPathAudit;
  canonicalCasesSummary: {
    totalCases: number;
    converged: number;
    notConverged: number;
    invalid: number;
    failed: number;
    unproven: number;
  };
  worstReferenceErrorPercent: number;
  worstConservationErrorPercent: number;
  meshSensitivitySummary: {
    casesEvaluated: number;
    convergedCases: number;
    overallStatus: 'CONVERGED' | 'NOT_CONVERGED' | 'UNPROVEN';
  };
  stabilityAudit: NumericalStabilityAudit;
  antiFabricationAudit: AntiFabricationAuditRecord;
  adversarialSuiteSummary: {
    totalAttacks: number;
    successfullyIntercepted: number;
    catchRatePercent: number;
    passed: boolean;
  };
  determinismResult: DeterminismResult;
  gate176Result: {
    passed: boolean;
    score: number; // Out of 100
    criteriaResults: Array<{ id: string; name: string; passed: boolean; score: number; details: string }>;
    attestationSignature: string;
  };
  finalVerdict: TurbulenceVerdict;
}
