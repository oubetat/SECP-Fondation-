import { EngineeringEvidence, EngineeringClaim } from '../../engine/engineering_ai/evidence/types';
import { EvidenceValidator } from './EvidenceValidator';

export interface SufficiencyScore {
  completeness: number;
  quality: number;
  freshness: number;
  authorityScore: number;
  overallSufficiency: number;
  sufficient: boolean;
}

export class EvidenceSufficiencyEngine {
  public static calculateSufficiency(
    claim: EngineeringClaim,
    evidenceList: EngineeringEvidence[]
  ): SufficiencyScore {
    const validEvidence = evidenceList.filter(e => EvidenceValidator.validateIntegrity(e).valid);

    if (validEvidence.length === 0) {
      return {
        completeness: 0,
        quality: 0,
        freshness: 0,
        authorityScore: 0,
        overallSufficiency: 0,
        sufficient: false
      };
    }

    const hasPrimary = validEvidence.some(e => e.authority === 'PRIMARY_VERIFIED');
    const completeness = Math.min(1.0, validEvidence.length / (claim.requiredEvidence.length || 1));
    const quality = hasPrimary ? 1.0 : 0.6;
    const freshness = 1.0;
    const authorityScore = hasPrimary ? 1.0 : 0.5;

    const overallSufficiency = (completeness + quality + freshness + authorityScore) / 4;
    const threshold = claim.importance === 'CRITICAL' ? 0.85 : 0.5;

    return {
      completeness,
      quality,
      freshness,
      authorityScore,
      overallSufficiency,
      sufficient: overallSufficiency >= threshold
    };
  }
}
