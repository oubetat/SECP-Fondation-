/**
 * SECP Industrial OS v2 — Phase 1: Engineering Truth Core
 * PATCH-012: Evidence Hash Verifier
 */

import * as crypto from 'crypto';
import { EngineeringEvidence } from './EngineeringEvidenceTypes';
import { VerificationCheck } from './EvidenceVerificationTypes';
import { EngineeringEvidencePayload } from './EngineeringEvidencePayload';
import { CanonicalSerializer } from '../serialization/CanonicalSerializer';

export class EvidenceHashVerifier {
  /**
   * Recomputes the evidence hash and compares it against the recorded hash.
   */
  public static verify(evidence: EngineeringEvidence): VerificationCheck {
    try {
      const payload = EngineeringEvidencePayload.getCanonicalPayload(evidence);
      const serialization = CanonicalSerializer.serialize(payload);
      
      const recomputedHash = crypto
        .createHash('sha256')
        .update(serialization.canonicalString, 'utf8')
        .digest('hex');

      const expectedHash = evidence.canonicalization.canonicalHash;

      if (!expectedHash) {
        return {
          status: 'UNPROVEN',
          executed: true,
          reason: 'Recorded hash is missing from evidence object',
          method: 'SHA-256'
        };
      }

      const match = recomputedHash === expectedHash;

      return {
        status: match ? 'PASS' : 'FAIL',
        executed: true,
        reason: match ? 'Hash verified independently' : 'Evidence integrity hash mismatch',
        expected: expectedHash,
        observed: recomputedHash,
        method: 'SHA-256'
      };
    } catch (e: any) {
      return {
        status: 'INVALID',
        executed: true,
        reason: `Hash verification error: ${e.message}`,
        method: 'SHA-256'
      };
    }
  }
}
