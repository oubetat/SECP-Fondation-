export type CAMBenchmarkVerdict = 'PASS' | 'FAIL' | 'UNPROVEN' | 'NOT_SUPPORTED' | 'INVALID';

export interface CAMBenchmarkMetrics {
  totalLengthMm: number;
  segmentCount: number;
  minSegmentLengthMm: number;
  zeroLengthSegments: number;
  continuityGaps: number;
  maxCoordinateDeviationMm: number;
  stockViolations: number;
  invalidSegments: number;
  machiningTimeSec: number;
  runtimeMs: number;
}

export interface CAMBenchmarkCaseResult {
  caseId: string;
  caseName: string;
  category: string;
  verdict: CAMBenchmarkVerdict;
  metrics: Partial<CAMBenchmarkMetrics>;
  details: string;
  evidencePacket: any;
  evidenceHash: string;
}

export interface CAMBenchmarkGateResult {
  gateId: string;
  passed: boolean;
  score: number;
  finalVerdict: CAMBenchmarkVerdict;
  criteriaResults: Array<{
    id: string;
    name: string;
    passed: boolean;
    verdict: CAMBenchmarkVerdict;
    score: number;
    details: string;
  }>;
  attestationSignature: string;
  timestamp: string;
}

export interface CAMBenchmarkSuiteReport {
  timestamp: string;
  executionMode: 'VERIFICATION' | 'ADVERSARIAL' | 'BENCHMARK';
  engineVersion: string;
  caseResults: CAMBenchmarkCaseResult[];
  gateResult: CAMBenchmarkGateResult;
  integrityHash: string;
}
