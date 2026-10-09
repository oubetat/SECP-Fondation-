/**
 * P0 — Production Environment Qualification Specifications & Types
 */

export type P0TestScenarioId =
  | 'P0_SCENARIO_01_NORMAL_EXECUTION'
  | 'P0_SCENARIO_02_MEMORY_VIOLATION'
  | 'P0_SCENARIO_03_TIMEOUT'
  | 'P0_SCENARIO_04_NONDETERMINISM'
  | 'P0_SCENARIO_05_WORKER_FAILURE'
  | 'P0_SCENARIO_06_EVIDENCE_CORRUPTION'
  | 'P0_SCENARIO_07_UNHANDLED_EXCEPTION';

export type P0ScenarioStatus = 'PASSED' | 'FAILED' | 'EXPECTED_REJECTION_VERIFIED';

export interface P0ScenarioResult {
  scenarioId: P0TestScenarioId;
  name: string;
  description: string;
  expectedBehavior: string;
  actualBehavior: string;
  status: P0ScenarioStatus;
  executionTimeMs: number;
  memoryPeakMb: number;
  evidenceHash: string;
}

export interface P0RunMetadata {
  runId: string;
  environmentId: string;
  buildId: string;
  commitHash: string;
  startTime: string;
  endTime: string;
  nodeVersion: string;
  platform: string;
}

export interface P0ResourceMetrics {
  memoryPeakBytes: number;
  cpuModel: string;
  workerCount: number;
  timeoutThresholdMs: number;
  memoryLimitBytes: number;
}

export interface P0DeterminismAndRecovery {
  determinismResult: 'DETERMINISTIC_REPRODUCIBLE' | 'NON_DETERMINISTIC_FAIL';
  failureInjectionResult: 'HANDLED_AND_ISOLATED' | 'UNHANDLED_SYSTEM_CRASH';
  recoveryResult: 'STATE_RECOVERED_CLEANLY' | 'CORRUPTED_PERSISTENT_STATE';
}

export type P0FinalVerdict =
  | 'P0_QUALIFICATION_PASSED'
  | 'P0_QUALIFICATION_FAILED';

export interface P0QualificationReport {
  metadata: P0RunMetadata;
  resourceMetrics: P0ResourceMetrics;
  determinismAndRecovery: P0DeterminismAndRecovery;
  scenarioResults: P0ScenarioResult[];
  rawEvidence: {
    forensicMerkleRootHash: string;
    totalScenarioCount: number;
    passedScenarioCount: number;
    scenarioSummaries: Record<string, string>;
  };
  evidenceHash: string;
  verifierResult: 'EVIDENCE_VERIFIED_IMMUTABLE' | 'EVIDENCE_TAMPERED';
  finalP0Verdict: P0FinalVerdict;
}
