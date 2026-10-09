import { VerdictCriterion } from './VerdictContract';
export interface VerdictProvenance {
  verdictId: string;
  gateId: string;
  runId: string;
  criteria: VerdictCriterion[];
  evidenceIds: string[];
  decisionTrace: string[];
  createdAt: string;
  inputHash: string;
  evidenceHash: string;
  verdictHash: string;
}
