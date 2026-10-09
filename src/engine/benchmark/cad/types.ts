export enum BenchmarkCategory {
  GEOMETRY_CREATION = 'GEOMETRY_CREATION',
  CURVES_AND_SURFACES = 'CURVES_AND_SURFACES',
  CURVE_CREATION = 'CURVES_AND_SURFACES',
  NURBS = 'NURBS',
  NURBS_EVALUATION = 'NURBS',
  BREP_TOPOLOGY = 'BREP_TOPOLOGY',
  BREP_VALIDATION = 'BREP_TOPOLOGY',
  BOOLEAN_OPERATIONS = 'BOOLEAN_OPERATIONS',
  GEOMETRIC_PREDICATES = 'GEOMETRIC_PREDICATES',
  TOPOLOGY_HEALING = 'TOPOLOGY_HEALING',
  TOLERANCE_HANDLING = 'TOLERANCE_HANDLING',
  TOLERANCE_VERIFICATION = 'TOLERANCE_HANDLING',
  PARAMETRIC_MODELING = 'PARAMETRIC_MODELING',
  PARAMETRIC_UPDATE = 'PARAMETRIC_MODELING',
  FEATURE_REGENERATION = 'FEATURE_REGENERATION',
  CONSTRAINT_SOLVING = 'CONSTRAINT_SOLVING',
  GEOMETRIC_CONSTRAINTS = 'CONSTRAINT_SOLVING',
  ASSEMBLY_GEOMETRY = 'ASSEMBLY_GEOMETRY',
  ASSEMBLY_MATING = 'ASSEMBLY_GEOMETRY',
  CLASH_DETECTION = 'CLASH_DETECTION',
  LARGE_MODEL_HANDLING = 'LARGE_MODEL_HANDLING',
  MASSIVE_ASSEMBLY = 'LARGE_MODEL_HANDLING',
  NUMERICAL_ROBUSTNESS = 'NUMERICAL_ROBUSTNESS',
  DEGENERATE_GEOMETRY = 'DEGENERATE_GEOMETRY',
  ADVERSARIAL_GEOMETRY = 'ADVERSARIAL_GEOMETRY',
  ADVERSARIAL_CASES = 'ADVERSARIAL_GEOMETRY',
  DETERMINISM = 'DETERMINISM',
  BIT_EXACT_DETERMINISM = 'DETERMINISM',
  REPRODUCIBILITY = 'REPRODUCIBILITY',
  PERFORMANCE = 'PERFORMANCE',
  PERFORMANCE_REGRESSION = 'PERFORMANCE'
}

export enum BenchmarkVerdict {
  PASS = 'PASS',
  FAIL = 'FAIL',
  PROVEN = 'PROVEN',
  UNPROVEN = 'UNPROVEN',
  INVALID = 'INVALID',
  WARNING = 'WARNING',
  ERROR = 'ERROR'
}

export enum QualificationVerdict {
  QUALIFIED = 'QUALIFIED',
  NOT_QUALIFIED = 'NOT_QUALIFIED',
  PROVISIONAL = 'PROVISIONAL'
}

export enum MeasurementMethod {
  WALL_CLOCK = 'WALL_CLOCK',
  CPU_CYCLES = 'CPU_CYCLES',
  HIGH_RES_TIMER = 'HIGH_RES_TIMER',
  DIRECTLY_MEASURED = 'DIRECTLY_MEASURED'
}

export enum OracleType {
  ANALYTICAL = 'ANALYTICAL',
  MATHEMATICAL = 'MATHEMATICAL',
  TOPOLOGICAL = 'TOPOLOGICAL',
  THEORETICAL = 'THEORETICAL',
  NONE = 'NONE'
}

export interface BenchmarkOracleSpec {
  isAvailable: boolean;
  type: OracleType | string;
  source?: string;
}

export interface BenchmarkMetrics {
  wallTimeMs: number;
  memoryBytes?: number;
  peakMemoryBytes?: number;
  durationMs?: number;
  memoryMb?: number;
  cpuPercent?: number;
  drift?: number;
  inputSizeCount?: number;
  outputSizeCount?: number;
  iterationCount?: number;
  failureCount?: number;
  measurementMethod?: MeasurementMethod;
  executionTimestamp?: string;
}

export interface CADBenchmarkComparison {
  oracleMatch: boolean;
  maxAbsoluteError: number;
  maxRelativeError: number;
  topologyMatched: boolean;
}

export interface CADBenchmarkResult {
  caseId: string;
  name: string;
  category: BenchmarkCategory;
  verdict: BenchmarkVerdict;
  comparison: CADBenchmarkComparison;
  metrics: BenchmarkMetrics;
  secpOutputSummary?: any;
  oracleOutputSummary?: any;
  diagnostics?: string[];
  evidenceId: string;
  evidenceHash: string;
  isAdversarial?: boolean;
  executionTimeMs?: number;
  memoryDeltaMb?: number;
  numericalDrift?: number;
  reproducibilityHash?: string;
}

export interface CADBenchmarkCase {
  id: string;
  name: string;
  category: BenchmarkCategory;
  description: string;
  isAdversarial: boolean;
  tolerance: number;
  input: any;
  oracle: BenchmarkOracleSpec;
}

export interface CADBenchmarkBatteryReport {
  batteryId: string;
  timestamp: string;
  results: CADBenchmarkResult[];
  totalCases: number;
  passedCount: number;
  failedCount: number;
  unprovenCount: number;
  passRate: number;
  totalTimeMs: number;
  overallVerdict: BenchmarkVerdict;
  determinismScore: number;
  reproducibilityScore: number;
}
