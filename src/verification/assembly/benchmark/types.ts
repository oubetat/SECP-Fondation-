export type AssemblyBenchmarkVerdict = 'PASS' | 'FAIL' | 'UNPROVEN' | 'PARTIAL' | 'NOT_SUPPORTED' | 'INVALID' | 'UNDER_CONSTRAINED' | 'OVER_CONSTRAINED' | 'CONFLICTING_CONSTRAINTS' | 'NON_DETERMINISTIC';

export interface AssemblyBenchmarkMetrics {
  assemblyCreationTimeMs: number;
  constraintSolveTimeMs: number;
  clashDetectionTimeMs: number;
  bomGenerationTimeMs: number;
  graphTraversalTimeMs: number;
  mutationPropagationTimeMs: number;
  totalRuntimeMs: number;
  componentCount: number;
  constraintCount: number;
  clashCount: number;
  totalDof: number;
}

export interface AssemblyBenchmarkCaseResult {
  caseId: string;
  caseName: string;
  category: string;
  verdict: AssemblyBenchmarkVerdict;
  metrics: Partial<AssemblyBenchmarkMetrics>;
  details: string;
  evidencePacket: any;
  evidenceHash: string;
}

export interface AssemblyBenchmarkGateResult {
  gateId: string;
  passed: boolean;
  score: number;
  finalVerdict: AssemblyBenchmarkVerdict;
  criteriaResults: Array<{
    id: string;
    name: string;
    passed: boolean;
    verdict: AssemblyBenchmarkVerdict;
    score: number;
    details: string;
  }>;
  attestationSignature: string;
  timestamp: string;
}

export interface AssemblyBenchmarkSuiteReport {
  timestamp: string;
  executionMode: 'VERIFICATION' | 'ADVERSARIAL' | 'BENCHMARK';
  engineVersion: string;
  caseResults: AssemblyBenchmarkCaseResult[];
  gateResult: AssemblyBenchmarkGateResult;
  integrityHash: string;
}
