/**
 * P1 — High-Density Multi-Feature Parametric Stress Types
 */

export type P1ScenarioId =
  | 'P1_SCENARIO_01_NORMAL_STRESS'
  | 'P1_SCENARIO_02_CYCLIC_DEPENDENCY'
  | 'P1_SCENARIO_03_CONSTRAINT_VIOLATION'
  | 'P1_SCENARIO_04_MEMORY_LEAK_ISOLATION'
  | 'P1_SCENARIO_05_EVIDENCE_TAMPERING';

export type P1ScenarioStatus = 'PASSED' | 'FAILED' | 'EXPECTED_REJECTION_VERIFIED';

export interface P1ScenarioResult {
  scenarioId: P1ScenarioId;
  name: string;
  description: string;
  expectedBehavior: string;
  actualBehavior: string;
  status: P1ScenarioStatus;
  executionTimeMs: number;
  nodesEvaluated: number;
  memoryDeltaMb: number;
  evidenceHash: string;
}

export interface P1StressReport {
  timestamp: string;
  totalNodes: number;
  scenarios: P1ScenarioResult[];
  merkleRootHash: string;
  overallVerdict: 'P1_QUALIFICATION_PASSED' | 'P1_QUALIFICATION_FAILED';
  verifierStatus: 'VERIFIED_IMMUTABLE' | 'TAMPERED';
}
