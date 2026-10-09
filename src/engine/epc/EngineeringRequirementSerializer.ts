/**
 * SECP Industrial OS — EPC-002: Engineering Requirement Serializer
 * Deterministic Canonical Serialization and Deserialization for EngineeringRequirement.
 */

import { CanonicalSerializer } from '../serialization/CanonicalSerializer';
import { pureSha256 } from '../../polyfills/crypto';
import {
  EngineeringRequirement,
  EngineeringRequirementValidationError
} from './EngineeringRequirementTypes';
import { EngineeringRequirementValidator } from './EngineeringRequirementValidator';

export interface EngineeringRequirementSerializationResult {
  readonly canonicalString: string;
  readonly byteLength: number;
  readonly requirementHash: string;
}

export class EngineeringRequirementSerializer {
  /**
   * Deterministically serializes an EngineeringRequirement into canonical JSON and computes its SHA-256 hash.
   */
  public static serialize(req: EngineeringRequirement): EngineeringRequirementSerializationResult {
    // Validate requirement schema first
    EngineeringRequirementValidator.validate(req);

    const res = CanonicalSerializer.serialize(req);
    const requirementHash = pureSha256(res.canonicalString);

    return Object.freeze({
      canonicalString: res.canonicalString,
      byteLength: res.byteLength,
      requirementHash
    });
  }

  /**
   * Deserializes a canonical JSON string into a validated EngineeringRequirement object.
   */
  public static deserialize(canonicalString: string): EngineeringRequirement {
    if (!canonicalString || typeof canonicalString !== 'string') {
      throw new EngineeringRequirementValidationError(
        'Canonical string must be a non-empty string',
        'INVALID_CANONICAL_STRING'
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(canonicalString);
    } catch (e: any) {
      throw new EngineeringRequirementValidationError(
        `JSON parse error during requirement deserialization: ${e.message}`,
        'DESERIALIZATION_FAILED'
      );
    }

    return EngineeringRequirementValidator.validate(parsed);
  }

  /**
   * Verifies round-trip fidelity:
   * Requirement -> Serialize -> Deserialize -> Serialize -> Hashes Match.
   */
  public static verifyRoundTrip(req: EngineeringRequirement): boolean {
    const s1 = this.serialize(req);
    const deserialized = this.deserialize(s1.canonicalString);
    const s2 = this.serialize(deserialized);
    return s1.canonicalString === s2.canonicalString && s1.requirementHash === s2.requirementHash;
  }
}
