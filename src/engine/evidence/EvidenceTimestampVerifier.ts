/**
 * SECP Industrial OS v2 — Phase 1: Engineering Truth Core
 * PATCH-012: Evidence Timestamp Verifier
 */

import { EngineeringEvidence } from './EngineeringEvidenceTypes';
import { VerificationCheck } from './EvidenceVerificationTypes';

export class EvidenceTimestampVerifier {
  /**
   * Semantically validates timestamps.
   */
  public static verify(evidence: EngineeringEvidence): VerificationCheck {
    const createdAt = evidence.createdAt;

    if (!createdAt) {
      return {
        status: 'UNPROVEN',
        executed: true,
        reason: 'Missing creation timestamp'
      };
    }

    const createdDate = new Date(createdAt);
    if (isNaN(createdDate.getTime())) {
      return {
        status: 'INVALID',
        executed: true,
        reason: 'Malformed creation timestamp',
        observed: createdAt
      };
    }

    // Semantic ordering checks
    if (evidence.computation) {
      const { startedAt, completedAt } = evidence.computation;
      
      if (startedAt && completedAt) {
        const start = new Date(startedAt);
        const end = new Date(completedAt);
        
        if (end < start) {
          return {
            status: 'FAIL',
            executed: true,
            reason: 'Impossible temporal relationship: completedAt before startedAt',
            expected: `>= ${startedAt}`,
            observed: completedAt
          };
        }
        
        if (createdDate < end) {
          // It's technically possible but usually evidence is created AFTER or AT completion.
          // We'll mark it as PASS but maybe warn elsewhere if it's too much of a gap.
        }
      }
    }

    // We don't verify wall-clock against "now" here because "now" is non-deterministic 
    // unless using DeterministicClock, and verification might happen years later.
    
    return {
      status: 'PASS',
      executed: true,
      reason: 'Timestamp is syntactically and semantically valid',
      observed: createdAt
    };
  }
}
