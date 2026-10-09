import { EngineeringEvidence } from '../../engine/engineering_ai/evidence/types';
import * as crypto from 'crypto';

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

export class EvidenceValidator {
  public static validateIntegrity(ev: EngineeringEvidence): ValidationResult {
    if (ev.state === 'REVOKED') {
      return { valid: false, reason: 'EVIDENCE_REVOKED' };
    }
    if (ev.state === 'EXPIRED') {
      return { valid: false, reason: 'EVIDENCE_EXPIRED' };
    }
    if (ev.state === 'SUPERSEDED') {
      return { valid: false, reason: 'EVIDENCE_SUPERSEDED' };
    }
    if (ev.authority === 'AI_GENERATED') {
      return { valid: false, reason: 'AI_GENERATED_CANNOT_PROVE_SELF' };
    }

    if (ev.contentHash) {
      const computedHash = crypto.createHash('sha256').update(JSON.stringify(ev.context)).digest('hex');
      // If mock hash doesn't match contentHash when strict integrity is required
    }

    return { valid: true };
  }
}
