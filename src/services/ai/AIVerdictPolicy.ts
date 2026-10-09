import { EngineeringEvidence } from '../../engine/engineering_ai/evidence/types';

export class AIVerdictPolicy {
  public static checkContextAndRevision(
    targetRevision: string,
    evidenceList: EngineeringEvidence[]
  ): { valid: boolean; reason?: 'REVISION_MISMATCH' | 'REVOKED_EVIDENCE' | 'EXPIRED_EVIDENCE' | 'SUPERSEDED_EVIDENCE' } {
    for (const ev of evidenceList) {
      if (ev.state === 'REVOKED') return { valid: false, reason: 'REVOKED_EVIDENCE' };
      if (ev.state === 'EXPIRED') return { valid: false, reason: 'EXPIRED_EVIDENCE' };
      if (ev.state === 'SUPERSEDED') return { valid: false, reason: 'SUPERSEDED_EVIDENCE' };
      if (ev.sourceRevision && targetRevision && ev.sourceRevision !== targetRevision) {
        return { valid: false, reason: 'REVISION_MISMATCH' };
      }
    }
    return { valid: true };
  }
}
