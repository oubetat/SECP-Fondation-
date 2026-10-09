
export type AdversarialVerdict = 
  | 'PASS'
  | 'FAIL'
  | 'UNPROVEN'
  | 'INCONCLUSIVE'
  | 'INVALID'
  | 'NOT_CONVERGED'
  | 'CONSERVATION_FAILURE'
  | 'TAMPER_DETECTED'
  | 'CONFLICT_DETECTED'
  | 'SIMULATED'
  | 'ARCHITECTURAL';

export interface AdversarialScenarioResult {
  scenarioId: string;
  capability: string;
  category: string;
  input: any;
  expectedBehavior: string;
  actualBehavior: string;
  evidence: any;
  verdict: AdversarialVerdict;
  failureClassification?: string;
  reproducibility: string;
  tamperStatus: 'CLEAN' | 'DETECTED' | 'UNDETECTED';
  qualificationStatus: 'QUALIFIED' | 'NOT_QUALIFIED' | 'UNPROVEN';
}

export interface AdversarialBatteryReport {
  timestamp: string;
  batteryVersion: string;
  executiveVerdict: AdversarialVerdict;
  scenarios: AdversarialScenarioResult[];
  summary: {
    totalScenarios: number;
    passedCount: number;
    failedCount: number;
    unprovenCount: number;
    tamperDetectionRate: number;
  };
}
