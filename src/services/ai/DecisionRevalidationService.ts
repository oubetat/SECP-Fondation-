import { EngineeringEvidence } from '../../engine/engineering_ai/evidence/types';
import { EvidenceImpactAnalyzer } from './EvidenceImpactAnalyzer';

export interface DecisionRecord {
  decisionId: string;
  evidenceIds: string[];
  status: 'QUALIFIED' | 'INVALIDATED' | 'REVALIDATION_REQUIRED';
}

export class DecisionRevalidationService {
  public static handleEvidenceRevocation(
    revokedEvidence: EngineeringEvidence,
    decisions: DecisionRecord[]
  ): DecisionRecord[] {
    const affectedIds = EvidenceImpactAnalyzer.analyzeRevocationImpact(revokedEvidence, decisions);
    return decisions.map(d => {
      if (affectedIds.includes(d.decisionId)) {
        return { ...d, status: 'INVALIDATED' as const };
      }
      return d;
    });
  }
}
