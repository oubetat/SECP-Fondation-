/**
 * SECP Industrial OS v2 — Phase 1: Engineering Truth Core
 * PATCH-012: Engineering Evidence Payload Utilities
 */

import { EngineeringEvidence, ENGINEERING_EVIDENCE_SCHEMA_VERSION } from './EngineeringEvidenceTypes';

export class EngineeringEvidencePayload {
  /**
   * Project the evidence object into its canonical payload for hashing.
   * Excludes the hashes themselves to avoid circularity.
   */
  public static getCanonicalPayload(evidence: Partial<EngineeringEvidence>): any {
    const { canonicalization, integrity, signature, ...payload } = evidence;
    
    // Ensure schemaVersion is present
    if (!payload.schemaVersion) {
      (payload as any).schemaVersion = ENGINEERING_EVIDENCE_SCHEMA_VERSION;
    }
    
    return payload;
  }
}
