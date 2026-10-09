import { pureSha256 } from '../../polyfills/crypto';

export enum DeterminismClass {
  BITWISE_DETERMINISTIC = 'BITWISE_DETERMINISTIC',
  NUMERICALLY_DETERMINISTIC = 'NUMERICALLY_DETERMINISTIC',
  ENGINEERINGALLY_EQUIVALENT = 'ENGINEERINGALLY_EQUIVALENT',
  REPRODUCIBLE_WITHIN_TOLERANCE = 'REPRODUCIBLE_WITHIN_TOLERANCE',
  NON_DETERMINISTIC = 'NON_DETERMINISTIC',
  NOT_APPLICABLE = 'NOT_APPLICABLE'
}

export enum ReproductionVerdict {
  BITWISE_MATCH = 'BITWISE_MATCH',
  NUMERICALLY_MATCHED = 'NUMERICALLY_MATCHED',
  ENGINEERINGALLY_EQUIVALENT = 'ENGINEERINGALLY_EQUIVALENT',
  NON_EQUIVALENT = 'NON_EQUIVALENT',
  NON_DETERMINISTIC = 'NON_DETERMINISTIC',
  INCONCLUSIVE = 'INCONCLUSIVE'
}

export enum DriftClassification {
  EXPECTED = 'EXPECTED',
  TOLERATED = 'TOLERATED',
  SIGNIFICANT = 'SIGNIFICANT',
  BLOCKING = 'BLOCKING'
}

export enum ReproductionCapabilityStatus {
  IMPLEMENTED = 'IMPLEMENTED',
  TESTED = 'TESTED',
  VERIFIED = 'VERIFIED',
  REPRODUCIBLE = 'REPRODUCIBLE',
  PRODUCTION_REPRODUCIBLE = 'PRODUCTION_REPRODUCIBLE'
}

export enum DeterministicReproductionMaturity {
  LEVEL_0 = 'LEVEL_0: No Reproduction Contract',
  LEVEL_1 = 'LEVEL_1: Input Reproduction',
  LEVEL_2 = 'LEVEL_2: Configuration Reproduction',
  LEVEL_3 = 'LEVEL_3: Numerical Reproduction',
  LEVEL_4 = 'LEVEL_4: Cross-Environment Reproduction',
  LEVEL_5 = 'LEVEL_5: Production Reproduction',
  LEVEL_6 = 'LEVEL_6: Deterministic Engineering Execution'
}

export enum EngineeringDomain {
  CAD = 'CAD',
  CFD = 'CFD',
  FEA = 'FEA',
  CAM = 'CAM',
  DYNAMICS = 'DYNAMICS',
  THERMAL = 'THERMAL',
  OPTIMIZATION = 'OPTIMIZATION',
  CROSS_ENVIRONMENT = 'CROSS_ENVIRONMENT'
}

// -------------------------------------------------------------
// Fingerprint Structures (Sections 10 - 25)
// -------------------------------------------------------------

export interface InputFingerprint {
  inputHash: string;
  datasetSize: number;
  parameterDigest: string;
  boundaryDigest: string;
}

export interface ConfigurationFingerprint {
  configurationHash: string;
  numericalPolicy: string;
  precision: 'SINGLE' | 'DOUBLE' | 'EXTENDED';
  roundingMode: 'NEAREST' | 'TOWARDS_ZERO' | 'UPWARD' | 'DOWNWARD';
  reductionStrategy: 'STRICT_SEQUENTIAL' | 'TREE_SUM' | 'ATOMIC_FLOAT_ACCUM';
  maxIterations: number;
}

export interface ModelFingerprint {
  modelId: string;
  modelHash: string;
  modelRevision: string;
  geometryHash?: string;
  meshHash?: string;
  materialParameterHash?: string;
}

export interface SolverFingerprint {
  solverName: string;
  solverVersion: string;
  solverConfigurationHash: string;
  convergenceTolerance: number;
}

export interface KernelFingerprint {
  kernelVersion: string;
  kernelConfigurationHash: string;
  brepTolerance: number;
}

export interface DependencyFingerprint {
  dependencies: Record<string, string>; // package -> version
  dependencyDigest: string;
}

export interface RuntimeEnvironmentFingerprint {
  os: string;
  runtime: string;
  compiler: string;
  wasmRuntime: string;
  browserWorkerRuntime: string;
  gpuBackend: string;
  driverVersion: string;
  cpuArchitecture: string;
}

export interface HardwareFingerprint {
  cpuModel: string;
  cpuCores: number;
  gpuModel: string;
  gpuMemoryBytes: number;
  systemMemoryBytes: number;
  acceleratorType?: string;
}

export interface RandomStateFingerprint {
  hasRandomness: boolean;
  initialSeed?: number;
  stateEntropyDigest?: string;
  prngAlgorithm?: string;
}

export interface ExecutionFingerprint {
  fingerprintId: string;
  inputFingerprint: InputFingerprint;
  configurationFingerprint: ConfigurationFingerprint;
  modelFingerprint: ModelFingerprint;
  solverFingerprint: SolverFingerprint;
  kernelFingerprint: KernelFingerprint;
  dependencyFingerprint: DependencyFingerprint;
  runtimeFingerprint: RuntimeEnvironmentFingerprint;
  hardwareFingerprint: HardwareFingerprint;
  randomStateFingerprint: RandomStateFingerprint;
  canonicalDigest: string;
  timestampIsolated: boolean;
}

// -------------------------------------------------------------
// Determinism Contract & Domain-Specific Tolerances (Sections 43 - 60, 84)
// -------------------------------------------------------------

export interface DomainToleranceConfig {
  domain: EngineeringDomain;
  scalarAbsTolerance: number;
  scalarRelTolerance: number;
  vectorL2Tolerance: number;
  fieldMaxTolerance: number;
  geometryToleranceMm: number;
  camToolpathChordalToleranceMm: number;
  cfdResidualTolerance: number;
  feaVonMisesStressToleranceMpa: number;
  justification: string;
}

export interface DeterminismContract {
  contractId: string;
  targetDomain: EngineeringDomain;
  requiredDeterminism: DeterminismClass;
  tolerances: DomainToleranceConfig;
  criticalOutputs: string[];
  environmentConstraints: {
    enforceSameGpuBackend: boolean;
    enforceSameThreadCount: boolean;
    enforceExactSolverVersion: boolean;
    enforceExactKernelVersion: boolean;
    enforcePinnedDependencies: boolean;
  };
  knownVariabilityNotes: string;
}

// -------------------------------------------------------------
// Execution Results & Comparisons (Sections 99 - 110)
// -------------------------------------------------------------

export interface ScalarDifferenceMetric {
  field: string;
  originalValue: number;
  reproducedValue: number;
  absoluteDifference: number;
  relativeDifference: number;
  passedTolerance: boolean;
}

export interface VectorDifferenceMetric {
  vectorName: string;
  l1Norm: number;
  l2Norm: number;
  lInfNorm: number;
  passedTolerance: boolean;
}

export interface FieldDifferenceMetric {
  fieldName: string; // e.g. "pressureField", "vonMisesStressField"
  nodeCount: number;
  maxDiscrepancy: number;
  meanDiscrepancy: number;
  l2FieldNorm: number;
  spatialDistributionMatch: boolean;
}

export interface TimeSeriesDifferenceMetric {
  seriesName: string; // e.g. "residualHistory", "transientVibration"
  stepCount: number;
  amplitudeDiff: number;
  phaseDiff: number;
  peakDiff: number;
  cumulativeDrift: number;
  passedTolerance: boolean;
}

export interface ReproductionComparisonResult {
  comparisonId: string;
  bitwiseIdentical: boolean;
  scalarDifferences: ScalarDifferenceMetric[];
  vectorDifferences: VectorDifferenceMetric[];
  fieldDifferences: FieldDifferenceMetric[];
  timeSeriesDifferences: TimeSeriesDifferenceMetric[];
  maxObservedRelativeDrift: number;
  criticalOutputsPassed: boolean;
  classifiedDeterminism: DeterminismClass;
  verdict: ReproductionVerdict;
  verdictReason: string;
}

export interface ReproductionDriftAnalysis {
  dependencyDrift: { detected: boolean; diffDetails: string[]; classification: DriftClassification };
  modelDrift: { detected: boolean; diffDetails: string[]; classification: DriftClassification };
  solverDrift: { detected: boolean; diffDetails: string[]; classification: DriftClassification };
  kernelDrift: { detected: boolean; diffDetails: string[]; classification: DriftClassification };
  hardwareDrift: { detected: boolean; diffDetails: string[]; classification: DriftClassification };
  blockingConditionsPresent: boolean;
  blockingReasons: string[];
}

export interface ReproductionEvidencePackage {
  evidenceId: string;
  reproductionId: string;
  originalExecutionId: string;
  fingerprintHash: string;
  comparisonDigest: string;
  merkleRoot: string;
  determinismClass: DeterminismClass;
  verdict: ReproductionVerdict;
  maturityLevel: DeterministicReproductionMaturity;
  completenessScore: number;
  digitalThreadLinks: {
    requirementId: string;
    modelId: string;
    originalExecutionId: string;
    reproductionId: string;
    productionFailureId?: string;
    decisionId: string;
  };
  evidenceBusBlock: {
    blockHeight: number;
    prevBlockHash: string;
    currentHash: string;
    timestamp: number;
  };
}

export interface ReproductionScenarioDefinition {
  scenarioId: string;
  name: string;
  domain: EngineeringDomain;
  description: string;
  targetDeterminismClass: DeterminismClass;
  originalExecution: {
    executionId: string;
    fingerprint: ExecutionFingerprint;
    rawOutput: Record<string, any>;
  };
  contract: DeterminismContract;
}

// -------------------------------------------------------------
// Canonical Serialization Helper
// -------------------------------------------------------------

export function canonicalJsonStringify(obj: any): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalJsonStringify).join(',') + ']';
  }
  const keys = Object.keys(obj).sort();
  return '{' + keys.map(k => `${JSON.stringify(k)}:${canonicalJsonStringify(obj[k])}`).join(',') + '}';
}

export function computeCanonicalDigest(obj: any): string {
  const canonical = canonicalJsonStringify(obj);
  return pureSha256(canonical);
}
