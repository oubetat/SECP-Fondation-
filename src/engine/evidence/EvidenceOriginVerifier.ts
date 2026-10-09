/**
 * SECP Industrial OS v2 — Phase 1: Engineering Truth Core
 * PATCH-012: Evidence Origin Verifier
 */

import { EngineeringEvidence } from './EngineeringEvidenceTypes';
import { VerificationCheck } from './EvidenceVerificationTypes';

export class EvidenceOriginVerifier {
  /**
   * Verifies the origin of the evidence.
   */
  public static verify(evidence: EngineeringEvidence): VerificationCheck {
    const producer = evidence.provenance.producer;

    if (!producer.id || producer.id === '') {
      return {
        status: 'FAIL',
        executed: true,
        reason: 'Missing producer identity'
      };
    }

    if (producer.type === 'UNKNOWN') {
      return {
        status: 'UNPROVEN',
        executed: true,
        reason: 'Producer type is UNKNOWN; origin cannot be verified'
      };
    }

    // Origin verification establishes:
    // 1. Producer ID is registered (Mock for now, as no registry exists)
    // 2. Producer type matches the claim (Mock for now)
    
    // As per rules, we don't treat non-empty string as proof.
    // If we can't actually verify against a registry, it's UNPROVEN.
    
    return {
      status: 'UNPROVEN',
      executed: true,
      reason: 'Producer registry verification not yet available',
      observed: `${producer.type}:${producer.id}`
    };
  }
}
