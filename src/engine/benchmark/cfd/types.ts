/**
 * SECP Industrial OS v2 — Computational Fluid Dynamics (CFD) Benchmark Types
 * Phase 15 (PATCH-174)
 * 
 * Defines type contracts, evidence structures, verdict models, and classification
 * categories for the independent adversarial CFD Benchmark Battery.
 */

export type CFDCategory =
  | 'A_ANALYTICAL_VERIFICATION'
  | 'B_CONSERVATION'
  | 'C_CONVERGENCE'
  | 'D_MESH_INDEPENDENCE'
  | 'E_BOUNDARY_CONDITIONS'
  | 'F_NUMERICAL_STABILITY'
  | 'G_ADVERSARIAL_CFD'
  | 'H_DETERMINISM_REPRODUCIBILITY'
  | 'I_PERFORMANCE'
  | 'J_REGRESSION';

export type CFDVerdict =
  | 'PASS'
  | 'FAIL'
  | 'UNPROVEN'
  | 'CONVERGED'
  | 'NOT_CONVERGED'
  | 'DIVERGED'
  | 'STAGNATED'
  | 'CONSERVATION_FAILURE'
  | 'MESH_DEPENDENT'
  | 'NUMERICAL_FAILURE'
  | 'INVALID_INPUT'
  | 'NON_DETERMINISTIC'
  | 'TIMEOUT'
  | 'RESOURCE_EXHAUSTED';

export interface CFDResidualsRecord {
  continuity: number;
  uMomentum: number;
  vMomentum: number;
  wMomentum: number;
  energyResidual: number | 'UNPROVEN';
}

export interface CFDMassBalanceRecord {
  totalInflowKgS: number;
  totalOutflowKgS: number;
  netImbalanceKgS: number;
  relativeImbalancePercent: number;
  isConserved: boolean;
}

export interface CFDMomentumBalanceRecord {
  pressureForceXN: number;
  viscousForceXN: number;
  netForceXN: number;
  momentumFluxNetXN: number;
  residualImbalanceN: number;
  isConserved: boolean;
}

export interface CFDEnergyBalanceRecord {
  status: 'UNPROVEN' | 'ABSENT' | 'VERIFIED';
  inletEnergyW?: number;
  outletEnergyW?: number;
  wallHeatTransferW?: number;
  energyImbalanceW?: number;
  notes: string;
}

export interface CFDDeterminismRecord {
  isDeterministic: boolean;
  isReproducible: boolean;
  passCount: number;
  driftCount: number;
  outputHashes: string[];
}

export interface CFDEvidenceRecord {
  testId: string;
  category: CFDCategory;
  title: string;
  description: string;
  meshHash: string;
  inputHash: string;
  solverVersion: string;
  solverConfiguration: {
    maxIterations: number;
    continuityTol: number;
    momentumTol: number;
    underRelaxationVelocity: number;
    underRelaxationPressure: number;
    turbulenceScheme: string;
    upwindScheme: string;
  };
  material: {
    densityKgM3: number;
    viscosityPaS: number;
    reynoldsNumber: number;
    flowRegime: string;
  };
  boundaryConditions: Record<string, string>;
  initialConditions: string;
  cellCount: number;
  faceCount: number;
  iterations: number;
  solveTimeMs: number;
  timePerIterationMs: number;
  residuals: CFDResidualsRecord;
  massBalance: CFDMassBalanceRecord;
  momentumBalance: CFDMomentumBalanceRecord;
  energyBalance: CFDEnergyBalanceRecord;
  referenceResult?: {
    type: 'EXACT_ANALYTICAL' | 'LITERATURE_BENCHMARK' | 'MANUFACTURED_SOLUTION';
    description: string;
    referenceValue: number;
    unit: string;
  };
  numericalResult?: {
    numericalValue: number;
    unit: string;
  };
  errorNorm?: {
    absoluteError: number;
    relativeErrorPercent: number;
    tolerancePercent: number;
    withinTolerance: boolean;
  };
  meshLevel?: 'COARSE' | 'MEDIUM' | 'FINE' | 'VERY_FINE';
  determinismResult: CFDDeterminismRecord;
  reproducibilityResult: {
    runtime: string;
    environmentConsistent: boolean;
    hashMatched: boolean;
  };
  expectedVerdict: CFDVerdict;
  actualVerdict: CFDVerdict;
  verdict: CFDVerdict;
  attestationSignature: string;
  timestamp: string;
}

export interface CFDMeshRefinementPoint {
  meshLevel: 'COARSE' | 'MEDIUM' | 'FINE' | 'VERY_FINE';
  cellCount: number;
  faceCount: number;
  dofCount: number;
  solveTimeMs: number;
  iterations: number;
  continuityResidual: number;
  massImbalancePercent: number;
  numericalPressureDropPa: number;
  referenceErrorPercent: number;
}

export interface CFDMeshRefinementStudy {
  benchmarkId: string;
  title: string;
  points: CFDMeshRefinementPoint[];
  gridSensitivityIndex: number;
  isMonotonicConvergence: boolean;
  meshIndependenceReached: boolean;
  summary: string;
}

export interface CFDBoundaryConditionCoverageItem {
  type: string;
  status: 'SUPPORTED_IMPLEMENTED_VERIFIED' | 'UNPROVEN' | 'ABSENT';
  description: string;
  verificationMethod: string;
  notes: string;
}

export interface CFDAdversarialResult {
  adversarialId: string;
  adversarialType: string;
  description: string;
  detected: boolean;
  expectedVerdict: CFDVerdict;
  actualVerdict: CFDVerdict;
  diagnostic: string;
}

export interface CFDAdversarialReport {
  testsInjected: number;
  testsDetected: number;
  falseAcceptanceCount: number;
  detectionRatePercent: number;
  details: CFDAdversarialResult[];
}

export interface CFDStressResult {
  scale: string;
  cellCount: number;
  faceCount: number;
  solveTimeMs: number;
  timePerIterationMs: number;
  iterations: number;
  continuityResidual: number;
  peakHeapMb: number;
  failures: number;
  timeouts: number;
}

export interface CFDBatteryReport {
  batteryId: string;
  title: string;
  solverVersion: string;
  timestamp: string;
  overallVerdict: CFDVerdict;
  totalCases: number;
  passedCount: number;
  failedCount: number;
  unprovenCount: number;
  convergedCount: number;
  notConvergedCount: number;
  divergedCount: number;
  stagnatedCount: number;
  conservationFailureCount: number;
  meshDependentCount: number;
  numericalFailureCount: number;
  invalidInputCount: number;
  nonDeterministicCount: number;
  timeoutCount: number;
  passRatePercent: number;
  totalDurationMs: number;
  scores: {
    analyticalAccuracyScore: number;
    massConservationScore: number;
    momentumConservationScore: number;
    energyConservationScore: number;
    convergenceIntegrityScore: number;
    meshIndependenceScore: number;
    boundaryConditionIntegrityScore: number;
    numericalStabilityScore: number;
    determinismScore: number;
    reproducibilityScore: number;
    performanceIntegrityScore: number;
    antiFabricationScore: number;
    regressionCoverageScore: number;
  };
  boundaryCoverage: Record<string, CFDBoundaryConditionCoverageItem>;
  categoryBreakdown: Record<CFDCategory, {
    total: number;
    passed: number;
    failed: number;
    unproven: number;
    avgDurationMs: number;
  }>;
  evidenceLedger: CFDEvidenceRecord[];
  meshRefinementStudies: CFDMeshRefinementStudy[];
  adversarialReport: CFDAdversarialReport;
  stressReport: CFDStressResult[];
}
