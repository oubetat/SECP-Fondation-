export type RuntimeClass = 'SHORT' | 'MEDIUM' | 'LONG' | 'EXTENDED' | 'ENDURANCE';

export type DeterminismClass = 'DETERMINISTIC' | 'NUMERICALLY_REPRODUCIBLE' | 'NONDETERMINISTIC';

export type SimulationTerminationStatus = 
  | 'COMPLETED'
  | 'CONVERGED'
  | 'STOPPED'
  | 'FAILED'
  | 'DIVERGED'
  | 'CANCELLED'
  | 'RECOVERED';

export type EngineeringTruthMaturityLevel =
  | 'LEVEL_0_SHORT_ONLY'
  | 'LEVEL_1_EXTENDED_TESTED'
  | 'LEVEL_2_RESOURCE_STABILITY'
  | 'LEVEL_3_NUMERICAL_STABILITY'
  | 'LEVEL_4_CHECKPOINT_RECOVERY'
  | 'LEVEL_5_ENGINEERING_WORKFLOW'
  | 'LEVEL_6_PRODUCTION_QUALIFIED';

export interface LongRunningSimulationTestId {
  simulationRunId: string;
  modelId: string;
  modelRevision: string;
  solver: string;
  solverVersion: string;
  kernelVersion: string;
  meshVersion: string;
  physicsModel: string;
  parameterSet: string;
  hardware: string;
  softwareEnvironment: string;
  benchmarkVersion: string;
  qualificationRunId: string;
  evidencePackageId: string;
}

export interface LongRunningSimulationWorkload {
  name: string;
  physics: string;
  dimension: '2D' | '3D';
  meshSize: number;
  elementCount: number;
  cellCount: number;
  dof: number;
  timeSteps: number;
  iterations: number;
  nonlinearIterations: number;
  coupledFields: string[];
  boundaryConditions: string[];
  materialModels: string[];
  solverSettings: Record<string, any>;
  checkpointInterval: number; // steps/iterations
  expectedRuntimeSec: number;
  isSynthetic: boolean;
}

export interface SimulationConfigurationFingerprint {
  solverVersion: string;
  kernelVersion: string;
  modelRevision: string;
  meshVersion: string;
  materialDatabaseVersion: string;
  boundaryConditionsHash: string;
  initialConditionsHash: string;
  parameterSetHash: string;
  numericalSettingsHash: string;
  hardware: string;
}

export interface LongRunFingerprint {
  configFingerprint: SimulationConfigurationFingerprint;
  startTime: string;
  endTime: string;
  hardware: string;
  software: string;
  datasetHash: string;
  executionEnvironment: string;
}

export interface SimulationCheckpoint {
  checkpointId: string;
  step: number;
  iteration: number;
  timestamp: string;
  stateHash: string;
  solverState: Record<string, any>;
  modelState: Record<string, any>;
  fieldState: Record<string, any>;
  checkpointHash: string;
  configurationIdentity: string;
  stateConsistency: boolean;
}

export interface SimulationTelemetryStep {
  step: number;
  time: number;
  residual: number;
  massBalanceError: number;
  energyBalanceError: number;
  momentumBalanceError: number;
  timeStepSize: number;
  ramUsageMb: number;
  vramUsageMb: number;
  cpuUtilization: number;
  gpuUtilization: number;
  nanInfDetected: boolean;
  status: 'CONVERGING' | 'STALLED' | 'DIVERGING' | 'CONVERGED';
}

export interface MetricEvaluation<T> {
  target: T;
  measured: T;
  passed: boolean;
}

export interface PerformanceMatrix {
  runtimeSec: MetricEvaluation<number>;
  peakRamMb: MetricEvaluation<number>;
  peakVramMb: MetricEvaluation<number>;
  totalSteps: MetricEvaluation<number>;
  timeToSolutionSec: MetricEvaluation<number>;
  effectiveThroughput: MetricEvaluation<string>;
  checkpointTimeMs: MetricEvaluation<number>;
  recoveryTimeMs: MetricEvaluation<number>;
}

export interface NumericalIntegrityMatrix {
  residual: MetricEvaluation<number>;
  massBalanceError: MetricEvaluation<number>;
  energyBalanceError: MetricEvaluation<number>;
  convergence: MetricEvaluation<string>;
  nanCount: MetricEvaluation<number>;
  infCount: MetricEvaluation<number>;
  finalStateConsistency: MetricEvaluation<boolean>;
}

export interface RecoveryMatrixScenario {
  scenario: string;
  expected: string;
  actual: string;
  passed: boolean;
}

export interface RecoveryMatrix {
  scenarios: RecoveryMatrixScenario[];
}

export interface ResourceStabilityMatrix {
  ram: { initialMb: number; peakMb: number; finalMb: number; growthRatePercent: number; passed: boolean };
  vram: { initialMb: number; peakMb: number; finalMb: number; passed: boolean };
  cpu: { avgUtil: number; peakUtil: number; passed: boolean };
  gpu: { avgUtil: number; peakUtil: number; passed: boolean };
  storage: { checkpointMb: number; totalDiskMb: number; diskCapacityProtected: boolean };
}

export interface FailureInjectionScenarioResult {
  scenario: string;
  failureIsolated: boolean;
  corruptedEvidence: boolean;
  corruptedCheckpoint: boolean;
  statusMessage: string;
}

export interface LongRunningSimulationEvidencePackage {
  testId: LongRunningSimulationTestId;
  workload: LongRunningSimulationWorkload;
  runtimeClass: RuntimeClass;
  fingerprint: LongRunFingerprint;
  checkpoints: SimulationCheckpoint[];
  telemetry: SimulationTelemetryStep[];
  recoveryTestResult: {
    runInterruptRecovered: boolean;
    checkpointHashValid: boolean;
    stateHashDeviation: number;
    continuationTolerancePassed: boolean;
  };
  failureInjectionResults: FailureInjectionScenarioResult[];
  performanceMatrix: PerformanceMatrix;
  numericalIntegrityMatrix: NumericalIntegrityMatrix;
  recoveryMatrix: RecoveryMatrix;
  resourceStabilityMatrix: ResourceStabilityMatrix;
  determinismClass: DeterminismClass;
  maturityLevel: EngineeringTruthMaturityLevel;
  verdict: 'PASS' | 'FAIL' | 'INCONCLUSIVE';
  timestamp: string;
}
