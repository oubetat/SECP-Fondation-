export type SimulationType = 'CFD' | 'FEM' | 'THERMAL' | 'MULTIPHYSICS' | 'ELECTROMAGNETIC';

export type SimulationLifecycleState =
  | 'CREATED'
  | 'VALIDATING'
  | 'READY'
  | 'RUNNING'
  | 'CONVERGING'
  | 'CONVERGED'
  | 'NOT_CONVERGED'
  | 'FAILED'
  | 'CANCELLED'
  | 'INVALID'
  | 'DIAGNOSTIC_REQUIRED'
  | 'VERIFIED';

export type InputVerdict =
  | 'VALID'
  | 'INVALID'
  | 'INCOMPLETE'
  | 'INCONSISTENT'
  | 'OUT_OF_DOMAIN'
  | 'UNKNOWN';

export type ResidualClassification =
  | 'DECREASING'
  | 'STAGNANT'
  | 'OSCILLATORY'
  | 'DIVERGING'
  | 'SPIKING'
  | 'INSUFFICIENT_DATA';

export type ConvergenceVerdict =
  | 'CONVERGED'
  | 'NOT_CONVERGED'
  | 'CONVERGENCE_INSUFFICIENT'
  | 'CONVERGENCE_INVALID'
  | 'FALSE_CONVERGENCE';

export type ConservationVerdict =
  | 'CONSERVATION_PASS'
  | 'CONSERVATION_FAILURE'
  | 'CONSERVATION_UNRESOLVED'
  | 'INVALID_BALANCE_DEFINITION';

export type PhysicsViolationVerdict =
  | 'PHYSICS_VALID'
  | 'PHYSICS_VIOLATION'
  | 'PHYSICS_UNRESOLVED';

export type MeshFailureClassification =
  | 'MESH_VALID'
  | 'MESH_DEGRADED'
  | 'MESH_INVALID'
  | 'MESH_INSUFFICIENT'
  | 'MESH_INCOMPATIBLE';

export type BoundaryConditionVerdict =
  | 'BC_VALID'
  | 'BC_INVALID'
  | 'BC_CONFLICT'
  | 'BC_INCOMPLETE'
  | 'BC_OUT_OF_DOMAIN';

export type TimeStepVerdict =
  | 'TIME_STEP_VALID'
  | 'TIME_STEP_TOO_LARGE'
  | 'TIME_STEP_UNSTABLE'
  | 'TIME_STEP_INSUFFICIENT';

export type SolverFailureClassification =
  | 'LINEAR_SOLVER_FAILURE'
  | 'NONLINEAR_SOLVER_FAILURE'
  | 'ITERATION_LIMIT'
  | 'NUMERICAL_INSTABILITY'
  | 'MATRIX_BREAKDOWN'
  | 'PRECONDITIONER_FAILURE'
  | 'COUPLING_FAILURE'
  | 'NONE';

export type ReproductionVerdict =
  | 'REPRODUCED'
  | 'NOT_REPRODUCED'
  | 'WITHIN_TOLERANCE'
  | 'OUTSIDE_TOLERANCE'
  | 'ENVIRONMENT_MISMATCH'
  | 'INSUFFICIENT_EVIDENCE';

export type DiagnosticSeverity = 'INFO' | 'WARNING' | 'MAJOR' | 'CRITICAL' | 'BLOCKING';

export interface SimulationContext {
  simulationId: string;
  simulationType: SimulationType;
  geometryHash: string;
  meshHash: string;
  materialHash: string;
  physicsModelHash: string;
  boundaryConditionHash: string;
  initialConditionHash: string;
  solverConfigurationHash: string;
  postProcessingHash: string;
  environmentHash: string;
  contextHash?: string;
}

export interface SimulationManifest {
  simulationId: string;
  geometry: any;
  mesh: any;
  materials: any[];
  physics: any;
  boundaryConditions: any[];
  initialConditions: any;
  solver: string;
  solverVersion: string;
  numericalSettings: Record<string, any>;
  hardware?: string;
  runtime?: string;
  postProcessing?: any;
}

export interface SolverHealthRecord {
  residuals: Record<string, number[]>;
  iterations: number;
  timeStep: number;
  CFL?: number;
  linearSolverStatus?: string;
  nonlinearSolverStatus?: string;
  matrixConditioning?: number;
  warnings: string[];
  errors: string[];
}

export interface ConservationRecord {
  quantity: string;
  inflow: number;
  outflow: number;
  source: number;
  sink: number;
  imbalance: number;
  normalizedError: number;
  tolerance: number;
  verdict: ConservationVerdict;
}

export interface MeshDiagnostic {
  elementCount: number;
  minJacobian: number;
  maxAspectRatio: number;
  maxSkewness: number;
  minAngle: number;
  negativeVolumeCount: number;
  verdict: MeshFailureClassification;
}

export interface RootCauseCandidate {
  candidateId: string;
  description: string;
  probability: number;
  supportingEvidence: string[];
  contradictingEvidence: string[];
  verified: boolean;
}

export interface SimulationDiagnosticEvidence {
  evidenceId: string;
  simulationHash: string;
  diagnosticVersion: string;
  ruleId: string;
  observations: string[];
  metrics: Record<string, number>;
  thresholds: Record<string, number>;
  verdict: string;
  event?: string;
  severity?: DiagnosticSeverity | string;
  details?: string | Record<string, any>;
  evidenceHash: string;
  timestamp: string;
}

export interface ForensicSimulationRecord {
  simulationId: string;
  simulationHash: string;
  manifest: SimulationManifest;
  environment: Record<string, any>;
  logs: string[];
  logHash: string;
  healthHistory: SolverHealthRecord[];
  diagnostics: SimulationDiagnosticEvidence[];
  timeline: { timestamp: string; event: string; details?: any }[];
}
