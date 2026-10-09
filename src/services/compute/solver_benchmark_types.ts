/**
 * PATCH-149 — Solver Scaling Benchmark Types
 * SECP Industrial OS v2 — HPC / GPU / Cloud Phase
 */

export enum ScalingType {
  STRONG_SCALING = 'STRONG_SCALING',
  WEAK_SCALING = 'WEAK_SCALING'
}

export enum IOCacheState {
  COLD = 'COLD',
  WARM = 'WARM',
  UNCERTAIN = 'UNCERTAIN'
}

export enum CachePrimingStatus {
  ENABLED = 'ENABLED',
  DISABLED = 'DISABLED',
  NOT_APPLICABLE = 'NOT_APPLICABLE'
}

export enum EvidenceClassification {
  OBSERVED = 'OBSERVED',
  DERIVED = 'DERIVED',
  QUALIFIED = 'QUALIFIED',
  INFERRED = 'INFERRED'
}

export enum MeasurementStrategy {
  FULL = 'FULL',
  SAMPLED = 'SAMPLED',
  AGGREGATED = 'AGGREGATED',
  ADAPTIVE = 'ADAPTIVE'
}

export enum BenchmarkFailureClass {
  BENCHMARK_SETUP_FAILURE = 'BENCHMARK_SETUP_FAILURE',
  WORKLOAD_FAILURE = 'WORKLOAD_FAILURE',
  SOLVER_FAILURE = 'SOLVER_FAILURE',
  NUMERICAL_FAILURE = 'NUMERICAL_FAILURE',
  RESOURCE_FAILURE = 'RESOURCE_FAILURE',
  COMMUNICATION_FAILURE = 'COMMUNICATION_FAILURE',
  MEASUREMENT_FAILURE = 'MEASUREMENT_FAILURE',
  ENVIRONMENT_FAILURE = 'ENVIRONMENT_FAILURE',
  PERFORMANCE_REGRESSION = 'PERFORMANCE_REGRESSION',
  EVIDENCE_INTEGRITY_FAILURE = 'EVIDENCE_INTEGRITY_FAILURE',
  MEASUREMENT_OVERHEAD_EXCEEDED = 'MEASUREMENT_OVERHEAD_EXCEEDED',
  ITERATION_SCALING_DRIFT = 'ITERATION_SCALING_DRIFT'
}

export interface MeasurementOverheadRecord {
  measurementCost: number;
  baselineSolveTime: number;
  measurementOverhead: number;
  measurementCalls: number;
  measurementFrequency: string;
  telemetryBytes: number;
  aggregationTime: number;
  synchronizationCost: number;
  strategy: MeasurementStrategy;
  instrumentationHash: string;
}

export interface ShadowExecutionRecord {
  enabled: boolean;
  shadowExecutionTime: number;
  fullExecutionTime: number;
  ioOverhead: number;
  checkpointOverhead: number;
  postProcessingOverhead: number;
}

export interface IterationStabilityRecord {
  referenceRankCount: number;
  currentRankCount: number;
  referenceIterationCount: number;
  currentIterationCount: number;
  iterationStabilityIndex: number;
  driftMagnitude: number;
  driftCause?: string;
  scalingEffect: 'STABLE' | 'DRIFT';
}

export interface IOTaxReport {
  inputIO: number;
  outputIO: number;
  checkpointIO: number;
  postProcessingIO: number;
  filesystemLatency: number;
  storageThroughput: number;
  totalIOOverhead: number;
  filesystemType: string;
  storageBackend: string;
}

export interface BenchmarkEnvironmentRecord {
  os: string;
  kernel: string;
  runtime: string;
  libraries: Record<string, string>;
  drivers: Record<string, string>;
  containerImage: string;
  environmentHash: string;
}

export interface SolverBenchmarkWorkloadIdentity {
  solverFamily: string;
  problemType: string;
  meshIdentity: string;
  dofCount: number;
  elementCount: number;
  matrixStructure: string;
  sparsityHash: string;
  rhsCharacteristics: string;
  boundaryConditions: string;
  materialModel: string;
  nonlinearState: string;
  solverConfiguration: string;
  workloadHash: string;
}

export interface SolverBuildIdentity {
  sourceVersion: string;
  commit: string;
  compiler: string;
  compilerVersion: string;
  optimizationFlags: string[];
  linker: string;
  dependencies: Record<string, string>;
  buildMode: 'DEBUG' | 'RELEASE';
  solverBuildHash: string;
}

export interface BenchmarkHardwareIdentity {
  cpuModel: string;
  coreCount: number;
  threadCount: number;
  memoryCapacity: number;
  numaTopology: string;
  gpuModel?: string;
  gpuCount?: number;
  interconnect: string;
  networkAdapter: string;
  hardwareHash: string;
}

export interface SolverTimeBreakdown {
  matrixAssembly: number;
  preconditionerSetup: number;
  solverIterations: number;
  communication: number;
  synchronization: number;
  memoryMovement: number;
  io: number;
  checkpoint: number;
  postProcessing: number;
  totalRuntime: number;
}

export interface IterationScalingEffect {
  iterationCount: number;
  iterationTime: number;
  convergenceHistory: number[];
  residualEvolution: number[];
  solverTerminationReason: string;
  algorithmicDegradation: boolean;
}

export interface CommunicationScalingRecord {
  mpiCommunicationTime: number;
  collectiveTime: number;
  pointToPointTime: number;
  haloExchange: number;
  reductionTime: number;
  synchronizationTime: number;
  commComputeRatio: number;
}

export interface LoadImbalanceEvidence {
  rankComputeTime: Record<number, number>;
  rankCommunicationTime: Record<number, number>;
  rankMemoryUsage: Record<number, number>;
  rankIterationCount: Record<number, number>;
  imbalanceFactor: number;
}

export interface MemoryScalingRecord {
  peakMemory: number;
  residentMemory: number;
  solverMemory: number;
  matrixMemory: number;
  preconditionerMemory: number;
  communicationBuffers: number;
  memoryPerDOF: number;
  memoryPerNonzero: number;
}

export interface BenchmarkStatistics {
  sampleCount: number;
  mean: number;
  median: number;
  min: number;
  max: number;
  variance: number;
  stdDev: number;
  p95: number;
  p99: number;
}

export interface ScalingCurvePoint {
  resourceCount: number;
  runtime: number;
  speedup: number;
  efficiency: number;
}

export interface SolverScalingBenchmarkRecord {
  benchmarkExecutionId: string;
  benchmarkRunHash: string;
  timestamp: string;
  scalingType: ScalingType;
  workload: SolverBenchmarkWorkloadIdentity;
  hardware: BenchmarkHardwareIdentity;
  solverBuild: SolverBuildIdentity;
  environment: BenchmarkEnvironmentRecord;
  configurationHash: string;
  measurementConfigHash: string;
  
  // REV.A Additions
  ioCacheState: IOCacheState;
  cachePriming: CachePrimingStatus;
  measurementOverhead: MeasurementOverheadRecord;
  shadowExecution: ShadowExecutionRecord;
  iterationStability: IterationStabilityRecord;
  ioTaxReport: IOTaxReport;
  
  timeBreakdown: SolverTimeBreakdown;
  iterationScaling: IterationScalingEffect;
  commScaling: CommunicationScalingRecord;
  loadImbalance: LoadImbalanceEvidence;
  memoryScaling: MemoryScalingRecord;
  statistics: BenchmarkStatistics;
  numericalValidity: {
    status: 'PASS' | 'FAIL';
    finalResidual: number;
    convergenceEquivalenceHash: string;
  };
  performanceStatus: 'PASS' | 'FAIL' | 'REGRESSION' | 'ANOMALY';
  provenanceHash: string;
}

export interface SolverScalingQualificationRecord {
  qualificationId: string;
  timestamp: string;
  state: 'QUALIFIED' | 'FAILED';
  checks: {
    workloadIdentity: boolean;
    solverIdentity: boolean;
    hardwareIdentity: boolean;
    numericalEquivalence: boolean;
    rawMeasurementIntegrity: boolean;
    strongScalingIntegrity: boolean;
    weakScalingIntegrity: boolean;
    communicationScaling: boolean;
    loadBalance: boolean;
    memoryScaling: boolean;
    iterationStability: boolean;
    preconditionerScaling: boolean;
    regressionDetection: boolean;
    comparabilityContract: boolean;
    provenanceCompleteness: boolean;
    evidenceIntegrity: boolean;
    // REV.A Additions
    ioCacheStateValidation: boolean;
    measurementOverheadAccounting: boolean;
    shadowExecutionIntegrity: boolean;
    iterationStabilityValidation: boolean;
    rawMeasurementPreservation: boolean;
    performanceEnvironmentIntegrity: boolean;
  };
  criticalFailures: string[];
}
