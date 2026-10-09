/**
 * SECP Industrial OS v2 — GCS Benchmark Types
 * Phase 15 (PATCH-173)
 *
 * Formal contracts for the Geometric Constraint Solver Benchmark,
 * independent verification oracles, constraint coverage, and evidence records.
 */

export type GCSCategory =
  | 'A_BASIC_SOLVER'
  | 'B_DOF_QUALIFICATION'
  | 'C_OVER_CONSTRAINED'
  | 'D_CONTRADICTORY_CONSTRAINTS'
  | 'E_REDUNDANT_CONSTRAINTS'
  | 'F_NUMERICAL_STABILITY'
  | 'G_CONSTRAINT_GRAPH_PROPAGATION'
  | 'H_PARAMETRIC_REGENERATION'
  | 'I_ADVERSARIAL_CHAINS';

export type GCSVerdict =
  | 'PASS'
  | 'FAIL'
  | 'UNPROVEN'
  | 'UNDER_CONSTRAINED'
  | 'OVER_CONSTRAINED'
  | 'INCONSISTENT'
  | 'NON_CONVERGED'
  | 'NUMERICAL_FAILURE'
  | 'NON_DETERMINISTIC'
  | 'TIMEOUT'
  | 'RESOURCE_EXHAUSTED'
  | 'INVALID_INPUT';

export type ConstraintVerificationStatus =
  | 'SUPPORTED_IMPLEMENTED_VERIFIED'
  | 'IMPLEMENTED_UNPROVEN'
  | 'ABSENT';

export interface ConstraintCoverageItem {
  type: string;
  category: 'GEOMETRIC' | 'DIMENSIONAL' | 'TOPOLOGICAL' | 'SYSTEM';
  status: ConstraintVerificationStatus;
  dofImpact: number;
  description: string;
  notes?: string;
}

export interface GeometricOracleResult {
  satisfied: boolean;
  maxError: number;
  tolerance: number;
  evaluatedConstraints: number;
  violations: string[];
  details: string[];
}

export interface GraphAuditResult {
  nodeCount: number;
  edgeCount: number;
  connectedComponents: number;
  maxDependencyDepth: number;
  hasCircularDependency: boolean;
  isGraphValid: boolean;
  details: string[];
}

export interface DeterminismResult {
  isDeterministic: boolean;
  passCount: number;
  driftCount: number;
  hashes: string[];
  details: string[];
}

export type ZeroIterationClassification =
  | 'VALID_NON_ITERATIVE_SOLUTION'
  | 'STRUCTURAL_CLASSIFICATION_WITHOUT_SOLVING'
  | 'INITIAL_STATE_ALREADY_SATISFIED'
  | 'SOLVER_NOT_EXECUTED'
  | 'UNKNOWN_REQUIRES_INVESTIGATION'
  | 'NOT_APPLICABLE';

export type Layer1Consistency = 'CONSISTENT' | 'CONTRADICTORY' | 'STRUCTURAL_CONFLICT';
export type Layer2SolverState = 'CONVERGED' | 'NON_CONVERGED' | 'DIVERGED' | 'NUMERICALLY_SINGULAR' | 'NOT_EXECUTED';
export type Layer3DOFClassification = 'UNDER_CONSTRAINED' | 'FULLY_CONSTRAINED' | 'REDUNDANT' | 'OVER_CONSTRAINED' | 'CONFLICTING';

export interface GCSEvidenceRecord {
  testId: string;
  title: string;
  category: GCSCategory;
  solverEngine: string;
  solverVersion: string;
  units: string;
  tolerance: number;
  entityCount: number;
  constraintCount: number;
  initialDOF: number;
  finalDOF: number;
  expectedState: string;
  actualState: string;
  iterations: number;
  residual: number;
  solveTimeMs: number;
  inputGeometryHash: string;
  inputConstraintHash: string;
  solvedGeometryHash: string;
  geometricValidation: GeometricOracleResult;
  graphValidation: GraphAuditResult;
  determinismResult: DeterminismResult;
  verdict: GCSVerdict;
  diagnostics: string[];
  ledgerTimestamp: string;
  attestationDigest: string;
  // Forensic Three-Layer State Model
  layer1Consistency?: Layer1Consistency;
  layer2SolverState?: Layer2SolverState;
  layer3DOFClassification?: Layer3DOFClassification;
  structuralConflictDetected?: boolean;
  solverExecuted?: boolean;
  zeroIterationClassification?: ZeroIterationClassification;
  semanticMappingNote?: string;
}

export interface GCSBenchmarkCase {
  id: string;
  title: string;
  category: GCSCategory;
  description: string;
  expectedState: 'FULLY_CONSTRAINED' | 'UNDER_CONSTRAINED' | 'OVER_CONSTRAINED' | 'INCONSISTENT';
  expectedFinalDOF: number;
  generator: (seed?: number) => {
    sketch: any;
    targetConstraints: any[];
    oracleParams?: Record<string, any>;
  };
}

export interface GCSStressResult {
  scale: string;
  entityCount: number;
  constraintCount: number;
  dof: number;
  solveTimeMs: number;
  iterations: number;
  residual: number;
  peakHeapMb: number;
  failures: number;
  timeouts: number;
}

export interface GCSMutationResult {
  mutationsInjected: number;
  mutationsDetected: number;
  falseAcceptanceCount: number;
  detectionRatePercent: number;
  details: {
    mutationId: string;
    mutationType: string;
    description: string;
    detected: boolean;
    detectedIssues: string[];
  }[];
}

export interface GCSBatteryReport {
  batteryId: string;
  title: string;
  solverVersion: string;
  timestamp: string;
  overallVerdict: GCSVerdict;
  totalCases: number;
  passedCount: number;
  failedCount: number;
  unprovenCount: number;
  underConstrainedCount: number;
  overConstrainedCount: number;
  inconsistentCount: number;
  numericalFailureCount: number;
  nonDeterministicCount: number;
  timeoutCount: number;
  passRatePercent: number;
  totalDurationMs: number;
  dofVerificationScore: number;
  constraintVerificationScore: number;
  geometricVerificationScore: number;
  determinismScore: number;
  numericalStabilityScore: number;
  antiFabricationScore: number;
  constraintCoverage: Record<string, ConstraintCoverageItem>;
  categoryBreakdown: Record<GCSCategory, {
    total: number;
    passed: number;
    failed: number;
    unproven: number;
    avgDurationMs: number;
  }>;
  evidenceLedger: GCSEvidenceRecord[];
  stressReport: GCSStressResult[];
  mutationReport: GCSMutationResult;
}
