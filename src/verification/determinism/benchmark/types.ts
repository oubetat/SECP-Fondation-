
export type DeterminismVerdict = 
  | 'DETERMINISTIC'
  | 'DETERMINISTIC_WITHIN_TOLERANCE'
  | 'NON_DETERMINISTIC'
  | 'REPLAY_MISMATCH'
  | 'INVALID'
  | 'UNPROVEN';

export interface ScenarioResult {
  scenarioId: string;
  category: 'INPUT' | 'GEOMETRY' | 'NUMERICAL' | 'ORDERING' | 'EVIDENCE' | 'REPLAY';
  inputHash: string;
  canonicalInputHash: string;
  engineVersion: string;
  environmentFingerprint: string;
  runResults: RunResult[];
  determinismStatus: DeterminismVerdict;
  numericalDifference?: number;
  structuralDifference?: string[];
  evidenceHashMismatch?: boolean;
  failureSource?: string;
}

export interface RunResult {
  runId: string;
  timestamp: string;
  outputHash: string;
  evidenceHash: string;
  resultData: any;
}

export interface DeterminismBenchmarkReport {
  timestamp: string;
  benchmarkVersion: string;
  executiveVerdict: DeterminismVerdict;
  scenarios: ScenarioResult[];
  summary: {
    totalScenarios: number;
    deterministicCount: number;
    reproducibleCount: number;
    nonDeterministicCount: number;
    unprovenCount: number;
  };
}
