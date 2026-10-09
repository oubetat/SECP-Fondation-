/**
 * SECP Industrial OS v2 — Conservation Benchmark Battery Types
 * Phase 15 (PATCH-175)
 *
 * Defines type contracts, conservation metrics, evidence packets,
 * thresholds, verdict models, and classification categories for independent
 * physical conservation auditing (Mass, Momentum, Energy).
 */

import { Vector3D, FvmMesh3D, FluidProperties3D, SolverConfig3D, CfdSolution3D } from '../../cfd3d/Fvm3DTypes';

export type ConservationVerdict =
  | 'PASS'
  | 'FAIL'
  | 'UNPROVEN'
  | 'NOT_CONVERGED'
  | 'INVALID'
  | 'CONSERVATION_FAILURE';

export type ConservationLaw = 'MASS' | 'MOMENTUM' | 'ENERGY';

export interface MassConservationMetrics {
  inflowKgS: number;
  outflowKgS: number;
  accumulationKgS: number;
  imbalanceKgS: number;
  relativeErrorPercent: number;
  isConserved: boolean;
  thresholdPercent: number;
  status: 'VERIFIED' | 'FAILED' | 'UNPROVEN';
  details: string;
}

export interface MomentumConservationMetrics {
  momentumFluxInN: Vector3D;
  momentumFluxOutN: Vector3D;
  momentumFluxNetN: Vector3D;
  pressureForceN: Vector3D;
  viscousForceN: Vector3D;
  bodyForceN: Vector3D;
  accumulationN: Vector3D;
  residualVectorN: Vector3D;
  residualNormN: number;
  referenceForceN: number;
  relativeErrorPercent: number;
  isConserved: boolean;
  thresholdPercent: number;
  status: 'VERIFIED' | 'FAILED' | 'UNPROVEN';
  details: string;
}

export interface EnergyConservationMetrics {
  convectiveInflowW: number;
  convectiveOutflowW: number;
  conductiveFluxW: number;
  pressureWorkW: number;
  sourceTermsW: number;
  accumulationW: number;
  imbalanceW: number;
  relativeErrorPercent: number;
  isConserved: boolean;
  thresholdPercent: number;
  status: 'UNPROVEN' | 'ABSENT' | 'VERIFIED' | 'FAILED';
  notes: string;
}

export interface ConservationMetrics {
  mass: MassConservationMetrics;
  momentum?: MomentumConservationMetrics;
  energy: EnergyConservationMetrics;
}

export interface ConservationThresholds {
  maxMassRelativeErrorPercent: number;       // Default <= 0.5%
  maxMomentumRelativeErrorPercent: number;   // Default <= 5.0%
  maxEnergyRelativeErrorPercent: number;     // Default <= 5.0%
  minConvergenceResidual: number;            // Solver residual tolerance <= 1e-3
}

export interface ConservationCaseDefinition {
  caseId: string;
  title: string;
  category: 'UNIFORM' | 'ZERO_FLOW' | 'CLOSED_DOMAIN' | 'INLET_OUTLET' | 'SYMMETRIC' | 'PRESSURE_DRIVEN' | 'TRANSIENT' | 'ENERGY' | 'ADVERSARIAL';
  description: string;
  meshGenerator: () => FvmMesh3D;
  fluid: FluidProperties3D;
  config: SolverConfig3D;
  bodyForce?: Vector3D;
  thresholds: ConservationThresholds;
  expectedVerdict?: ConservationVerdict;
  notes?: string;
}

export interface ConservationEvidencePacket {
  caseId: string;
  title: string;
  solverVersion: string;
  meshHash: string;
  geometryHash: string;
  inputHash: string;
  boundaryConditionHash: string;
  resultHash: string;
  cellCount: number;
  faceCount: number;
  iterations: number;
  solverConverged: boolean;
  solverContinuityResidual: number;
  solverMomentumResidual: number;
  solveTimeMs: number;
  conservationMetrics: ConservationMetrics;
  thresholds: ConservationThresholds;
  verdict: ConservationVerdict;
  failureReasons: string[];
  timestamp: string;
  executionEnvironment: {
    runtime: string;
    platform: string;
    deterministicSeed: string;
  };
  attestationSignature: string;
}

export interface ConservationMeshPoint {
  meshLevel: 'COARSE' | 'MEDIUM' | 'FINE' | 'VERY_FINE';
  cellCount: number;
  solveTimeMs: number;
  massErrorPercent: number;
  momentumErrorPercent: number;
  energyStatus: string;
  continuityResidual: number;
  isMonotonicDecay: boolean;
}

export interface ConservationMeshStudyResult {
  studyId: string;
  caseName: string;
  points: ConservationMeshPoint[];
  massConvergenceTrend: 'MONOTONIC_DECREASING' | 'STAGNANT' | 'OSCILLATORY' | 'INCREASING';
  momentumConvergenceTrend: 'MONOTONIC_DECREASING' | 'STAGNANT' | 'OSCILLATORY' | 'INCREASING';
  summary: string;
}

export interface ConservationAdversarialResult {
  testId: string;
  name: string;
  description: string;
  injectedPathology: string;
  expectedVerdict: ConservationVerdict;
  actualVerdict: ConservationVerdict;
  detectedSuccessfully: boolean;
  details: string;
}

export interface ConservationAdversarialReport {
  testsInjected: number;
  testsDetected: number;
  detectionRatePercent: number;
  falseAcceptanceCount: number;
  results: ConservationAdversarialResult[];
}

export interface ConservationBatteryReport {
  batteryId: string;
  title: string;
  solverVersion: string;
  timestamp: string;
  overallVerdict: ConservationVerdict;
  totalCases: number;
  passedCount: number;
  failedCount: number;
  unprovenCount: number;
  notConvergedCount: number;
  invalidCount: number;
  conservationFailureCount: number;
  passRatePercent: number;
  totalDurationMs: number;

  massTestsSummary: {
    total: number;
    passed: number;
    failed: number;
    unproven: number;
    worstErrorPercent: number;
  };

  momentumTestsSummary: {
    total: number;
    passed: number;
    failed: number;
    unproven: number;
    worstErrorPercent: number;
  };

  energyTestsSummary: {
    total: number;
    passed: number;
    failed: number;
    unproven: number;
    worstErrorPercent: number;
  };

  meshSensitivity: ConservationMeshStudyResult;
  adversarialReport: ConservationAdversarialReport;
  evidenceLedger: ConservationEvidencePacket[];
  formattedReportText: string;
}
