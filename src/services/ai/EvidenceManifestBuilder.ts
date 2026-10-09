import { EngineeringClaim, EngineeringEvidence, EvidenceManifest } from '../../engine/engineering_ai/evidence/types';
import * as crypto from 'crypto';

export class EvidenceManifestBuilder {
  public static build(
    claims: EngineeringClaim[],
    evidence: EngineeringEvidence[],
    conflicts: string[]
  ): EvidenceManifest {
    const validEvidence = evidence.filter(e => e.state === 'VALID');
    let verification: 'PASS' | 'FAIL' | 'BLOCKED' | 'CANNOT_BE_FULLY_VERIFIED' = 'PASS';

    if (conflicts.length > 0) {
      verification = 'BLOCKED';
    } else if (claims.some(c => c.status !== 'FULLY_SUPPORTED')) {
      verification = 'CANNOT_BE_FULLY_VERIFIED';
    }

    const payload = JSON.stringify({ claims, evidence: validEvidence, conflicts });
    const hash = crypto.createHash('sha256').update(payload).digest('hex');

    return {
      manifestId: `MAN-${Date.now()}`,
      claims,
      evidence: validEvidence,
      dependencies: validEvidence.map(e => e.evidenceId),
      policies: ['StructuralEvidencePolicy'],
      contradictions: conflicts,
      assumptions: [],
      verification,
      hash,
      timestamp: new Date().toISOString()
    };
  }
}
