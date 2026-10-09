
export type PLMBenchmarkVerdict = 
  | 'PASS'
  | 'FAIL'
  | 'PARTIAL'
  | 'UNPROVEN'
  | 'SIMULATED'
  | 'NOT_SUPPORTED'
  | 'INCONCLUSIVE'
  | 'NON_DETERMINISTIC'
  | 'TAMPER_DETECTED'
  | 'DENIED';

export type PLMCapabilityExecution = 
  | 'REAL_EXECUTION'
  | 'PARTIAL'
  | 'SIMULATED'
  | 'MOCKED'
  | 'ARCHITECTURAL_ONLY'
  | 'MISSING';

export interface PLMCapabilityResult {
  capability: string;
  execution: PLMCapabilityExecution;
  verdict: PLMBenchmarkVerdict;
  details: string;
  evidenceHash: string;
}

export interface PLMBenchmarkCaseResult {
  caseId: string;
  caseName: string;
  category: string;
  verdict: PLMBenchmarkVerdict;
  metrics: Record<string, any>;
  details: string;
  evidencePacket: any;
  evidenceHash: string;
}

export interface PLMBenchmarkReport {
  timestamp: string;
  benchmarkVersion: string;
  capabilityMatrix: PLMCapabilityResult[];
  caseResults: PLMBenchmarkCaseResult[];
  gateResult: {
    finalVerdict: PLMBenchmarkVerdict;
    summary: string;
    attestationSignature: string;
  };
}
