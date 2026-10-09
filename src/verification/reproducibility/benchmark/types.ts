
export type ReproducibilityVerdict = 
  | 'EXACTLY_REPRODUCIBLE'
  | 'NUMERICALLY_REPRODUCIBLE'
  | 'STRUCTURALLY_REPRODUCIBLE'
  | 'PARTIALLY_REPRODUCIBLE'
  | 'REPRODUCTION_FAILURE'
  | 'INPUT_MISMATCH'
  | 'ENVIRONMENT_MISMATCH'
  | 'VERSION_INCOMPATIBLE'
  | 'UNPROVEN'
  | 'INVALID';

export interface RunManifest {
  runId: string;
  scenarioId: string;
  timestamp: string;
  engineVersion: string;
  environmentFingerprint: string;
  inputs: {
    inputHash: string;
    canonicalInputHash: string;
    params: any;
  };
  configuration: {
    solverConfigHash: string;
    meshConfigHash?: string;
    materialConfigHash?: string;
    randomSeed?: number;
  };
  results: {
    resultHash: string;
    evidenceRootHash: string;
    numericalValues?: Record<string, number>;
  };
}

export interface ReplayResult {
  runId: string;
  verdict: ReproducibilityVerdict;
  numericalError?: {
    absolute: number;
    relative: number;
    maxDeviation: number;
  };
  hashMatch: boolean;
  evidenceMatch: boolean;
  mismatchedKeys?: string[];
}

export interface ReproducibilityBenchmarkReport {
  timestamp: string;
  benchmarkVersion: string;
  executiveVerdict: ReproducibilityVerdict;
  baselineRuns: RunManifest[];
  replayResults: ReplayResult[];
  matrix: {
    domain: string;
    sameRuntime: ReproducibilityVerdict;
    restartedRuntime: ReproducibilityVerdict;
    sameVersion: ReproducibilityVerdict;
    crossVersion: ReproducibilityVerdict;
    verdict: ReproducibilityVerdict;
  }[];
}
