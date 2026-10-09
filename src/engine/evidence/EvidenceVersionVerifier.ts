/**
 * SECP Industrial OS v2 — Phase 1: Engineering Truth Core
 * PATCH-012: Evidence Version Verifier
 */

import { EngineeringEvidence, ENGINEERING_EVIDENCE_SCHEMA_VERSION } from './EngineeringEvidenceTypes';
import { VerificationCheck } from './EvidenceVerificationTypes';

export class EvidenceVersionVerifier {
  public static readonly SUPPORTED_SCHEMA_VERSIONS = [ENGINEERING_EVIDENCE_SCHEMA_VERSION];

  /**
   * Verifies version compatibility.
   */
  public static verify(evidence: EngineeringEvidence): VerificationCheck {
    const schemaVersion = evidence.schemaVersion;

    if (!schemaVersion) {
      return {
        status: 'INVALID',
        executed: true,
        reason: 'Missing schema version'
      };
    }

    const isSupported = this.SUPPORTED_SCHEMA_VERSIONS.includes(schemaVersion);

    return {
      status: isSupported ? 'PASS' : 'FAIL',
      executed: true,
      reason: isSupported ? 'Schema version supported' : `Unsupported schema version: ${schemaVersion}`,
      expected: this.SUPPORTED_SCHEMA_VERSIONS.join(', '),
      observed: schemaVersion
    };
  }
}
