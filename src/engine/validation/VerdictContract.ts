import { EngineeringVerdict } from './VerdictTypes';

export interface VerdictEvidence {
  evidenceId: string;
  source: string;
  metric?: string;
  observedValue?: number | string | boolean;
  expectedValue?: number | string | boolean;
  tolerance?: number;
  unit?: string;
  hash?: string;
}

export interface VerdictCriterion {
  criterionId: string;
  mandatory: boolean;
  satisfied: boolean | null;
  evidenceIds: string[];
  reason: string;
}

export interface VerdictDecision {
  verdict: EngineeringVerdict;
  gateId: string;
  criteria: VerdictCriterion[];
  evidence: VerdictEvidence[];
  failures: string[];
  unresolved: string[];
  decisionTrace: string[];
}
