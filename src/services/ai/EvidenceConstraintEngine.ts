import {
  EngineeringEvidence,
  EngineeringClaim,
  EvidenceManifest,
  ClaimSupportState,
  ContradictionState
} from '../../engine/engineering_ai/evidence/types';
import * as crypto from 'crypto';

export class EvidenceConstraintEngine {
  public static validateEvidence(evidence: EngineeringEvidence): boolean {
    if (evidence.state === 'REVOKED' || evidence.state === 'EXPIRED' || evidence.state === 'SUPERSEDED') {
      return false;
    }
    if (evidence.authority === 'AI_GENERATED') {
      // AI_GENERATED cannot prove itself
      return false;
    }
    return true;
  }

  public static evaluateClaimSupport(
    claim: EngineeringClaim,
    evidenceList: EngineeringEvidence[]
  ): ClaimSupportState {
    const validEvidence = evidenceList.filter(e => this.validateEvidence(e));

    // Check for numerical / context mismatches or contradictions
    if (claim.contradictingEvidence && claim.contradictingEvidence.length > 0) {
      return 'CONTRADICTED';
    }

    if (validEvidence.length === 0) {
      return 'UNSUPPORTED';
    }

    const hasPrimary = validEvidence.some(e => e.authority === 'PRIMARY_VERIFIED');
    
    if (claim.importance === 'CRITICAL' && !hasPrimary) {
      return 'WEAKLY_SUPPORTED';
    }

    if (validEvidence.length >= 2 || hasPrimary) {
      return 'FULLY_SUPPORTED';
    }

    return 'PARTIALLY_SUPPORTED';
  }

  public static detectContradictions(
    evidenceA: EngineeringEvidence,
    evidenceB: EngineeringEvidence
  ): ContradictionState {
    if (evidenceA.measurement !== undefined && evidenceB.measurement !== undefined) {
      const diff = Math.abs(evidenceA.measurement - evidenceB.measurement);
      if (diff > 1e-3) {
        return 'CONFIRMED_CONFLICT';
      }
    }
    return 'NO_CONFLICT';
  }

  public static generateManifest(
    claims: EngineeringClaim[],
    evidence: EngineeringEvidence[],
    conflicts: string[]
  ): EvidenceManifest {
    const validEvidence = evidence.filter(e => this.validateEvidence(e));
    let overallVerification: 'PASS' | 'FAIL' | 'BLOCKED' | 'CANNOT_BE_FULLY_VERIFIED' = 'PASS';

    if (conflicts.length > 0) {
      overallVerification = 'BLOCKED';
    } else if (claims.some(c => c.status !== 'FULLY_SUPPORTED')) {
      overallVerification = 'CANNOT_BE_FULLY_VERIFIED';
    }

    const payload = JSON.stringify({ claims, evidence: validEvidence, conflicts });
    const hash = crypto.createHash('sha256').update(payload).digest('hex');

    return {
      manifestId: `MAN-${Date.now()}`,
      claims,
      evidence: validEvidence,
      dependencies: [],
      policies: ['StructuralEvidencePolicy'],
      contradictions: conflicts,
      assumptions: [],
      verification: overallVerification,
      hash,
      timestamp: new Date().toISOString()
    };
  }
}
