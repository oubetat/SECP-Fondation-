import { EngineeringEvidence } from '../../engine/engineering_ai/evidence/types';

export class EvidenceImpactAnalyzer {
  public static analyzeRevocationImpact(
    revokedEvidence: EngineeringEvidence,
    decisions: Array<{ decisionId: string; evidenceIds: string[]; status: string }>
  ): string[] {
    const affectedDecisionIds: string[] = [];
    for (const d of decisions) {
      if (d.evidenceIds.includes(revokedEvidence.evidenceId)) {
        affectedDecisionIds.push(d.decisionId);
      }
    }
    return affectedDecisionIds;
  }
}
