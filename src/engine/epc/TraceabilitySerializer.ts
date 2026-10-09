/**
 * SECP Industrial OS — EPC-003: Traceability Serializer
 * Deterministic Canonical Serialization and Deserialization for Requirement Traceability.
 */

import { CanonicalSerializer } from '../serialization/CanonicalSerializer';
import { pureSha256 } from '../../polyfills/crypto';
import { RequirementTraceabilityEngine } from './RequirementTraceabilityEngine';
import {
  TraceabilityGraphData,
  TraceabilityValidationError
} from './TraceabilityTypes';

export interface TraceabilitySerializationResult {
  readonly canonicalString: string;
  readonly byteLength: number;
  readonly graphHash: string;
}

export class TraceabilitySerializer {
  /**
   * Deterministically serializes a RequirementTraceabilityEngine instance.
   */
  public static serialize(engine: RequirementTraceabilityEngine): TraceabilitySerializationResult {
    if (!engine || !(engine instanceof RequirementTraceabilityEngine)) {
      throw new TraceabilityValidationError(
        'RequirementTraceabilityEngine instance is required for serialization',
        'INVALID_ENGINE_INSTANCE'
      );
    }

    const data = engine.toGraphData();
    const res = CanonicalSerializer.serialize(data);
    const graphHash = pureSha256(res.canonicalString);

    return Object.freeze({
      canonicalString: res.canonicalString,
      byteLength: res.byteLength,
      graphHash
    });
  }

  /**
   * Deserializes canonical JSON string into a RequirementTraceabilityEngine instance.
   */
  public static deserialize(canonicalString: string): RequirementTraceabilityEngine {
    if (!canonicalString || typeof canonicalString !== 'string') {
      throw new TraceabilityValidationError(
        'Canonical string must be a non-empty string',
        'INVALID_CANONICAL_STRING'
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(canonicalString);
    } catch (e: any) {
      throw new TraceabilityValidationError(
        `JSON parse error during traceability graph deserialization: ${e.message}`,
        'DESERIALIZATION_FAILED'
      );
    }

    return RequirementTraceabilityEngine.fromGraphData(parsed as TraceabilityGraphData);
  }

  /**
   * Verifies round-trip fidelity.
   */
  public static verifyRoundTrip(engine: RequirementTraceabilityEngine): boolean {
    const s1 = this.serialize(engine);
    const restored = this.deserialize(s1.canonicalString);
    const s2 = this.serialize(restored);
    return s1.canonicalString === s2.canonicalString && s1.graphHash === s2.graphHash;
  }
}
