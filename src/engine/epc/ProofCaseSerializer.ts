/**
 * SECP Industrial OS — EPC-001: Proof Case Serializer
 * Deterministic Canonical Serialization and Deserialization for ProofCaseProject.
 */

import { CanonicalSerializer } from '../serialization/CanonicalSerializer';
import { pureSha256 } from '../../polyfills/crypto';
import { ProofCaseProject, ProofCaseValidationError } from './ProofCaseTypes';
import { ProofCaseValidator } from './ProofCaseValidator';

export interface ProofCaseSerializationResult {
  readonly canonicalString: string;
  readonly byteLength: number;
  readonly proofHash: string;
}

export class ProofCaseSerializer {
  /**
   * Deterministically serializes a ProofCaseProject into canonical JSON and computes its SHA-256 hash.
   * Reuses SECP CanonicalSerializer and pureSha256.
   */
  public static serialize(project: ProofCaseProject): ProofCaseSerializationResult {
    // Validate project schema first
    ProofCaseValidator.validate(project);

    // Canonical serialization via SECP CanonicalSerializer
    const res = CanonicalSerializer.serialize(project);
    const proofHash = pureSha256(res.canonicalString);

    return Object.freeze({
      canonicalString: res.canonicalString,
      byteLength: res.byteLength,
      proofHash
    });
  }

  /**
   * Deserializes a canonical JSON string into a validated ProofCaseProject object.
   */
  public static deserialize(canonicalString: string): ProofCaseProject {
    if (!canonicalString || typeof canonicalString !== 'string') {
      throw new ProofCaseValidationError('Canonical string must be a non-empty string', 'INVALID_CANONICAL_STRING');
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(canonicalString);
    } catch (e: any) {
      throw new ProofCaseValidationError(`JSON parse error during deserialization: ${e.message}`, 'DESERIALIZATION_FAILED');
    }

    return ProofCaseValidator.validate(parsed);
  }

  /**
   * Verifies round-trip fidelity:
   * Project -> Serialize -> Deserialize -> Serialize -> Hashes Match.
   */
  public static verifyRoundTrip(project: ProofCaseProject): boolean {
    const s1 = this.serialize(project);
    const deserialized = this.deserialize(s1.canonicalString);
    const s2 = this.serialize(deserialized);
    return s1.canonicalString === s2.canonicalString && s1.proofHash === s2.proofHash;
  }
}
