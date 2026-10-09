export type GateVerdict =
  | "PASS"
  | "FAIL"
  | "UNPROVEN"
  | "INCONCLUSIVE";

export interface GateEvidence {
  id: string;
  description: string;
  value?: number | string | boolean;
  expected?: number | string | boolean;
  tolerance?: number;
  source: string;
}

export interface GateCriterion {
  id: string;
  description: string;
  satisfied: boolean;
  evidenceIds: string[];
}

export interface GateResult {
  gateId: string;
  verdict: GateVerdict;
  criteria: GateCriterion[];
  evidence: GateEvidence[];
  failures: string[];
  warnings: string[];
  timestamp: string;
}
