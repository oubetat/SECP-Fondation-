/**
 * SECP Industrial OS — EPC-004: Configuration Baseline Serializer
 * Deterministic Canonical Serialization and Deserialization for Engineering Baselines.
 */

import { CanonicalSerializer } from '../serialization/CanonicalSerializer';
import { pureSha256 } from '../../polyfills/crypto';
import {
  EngineeringConfigurationBaselineData,
  ConfigurationBaselineValidationError
} from './ConfigurationBaselineTypes';
import { ConfigurationBaselineValidator } from './ConfigurationBaselineValidator';

export interface BaselineSerializationResult {
  readonly canonicalString: string;
  readonly byteLength: number;
  readonly contentHash: string;
}

function cleanObject<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map(cleanObject) as unknown as T;
  }
  const result: Record<string, any> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val !== undefined) {
      result[key] = typeof val === 'object' && val !== null ? cleanObject(val) : val;
    }
  }
  return result as T;
}

export class ConfigurationBaselineSerializer {
  /**
   * Computes the deterministic SHA-256 hash over baseline content payload (omitting contentHash).
   */
  public static computeContentHash(data: EngineeringConfigurationBaselineData): string {
    if (!data || typeof data !== 'object') {
      throw new ConfigurationBaselineValidationError(
        'Baseline payload is required for hash computation',
        'INVALID_BASELINE_PAYLOAD'
      );
    }
    const { contentHash: _topHash, provenance, ...restPayload } = data;
    const { contentHash: _provHash, ...restProv } = provenance || {};
    const payloadToHash = {
      ...restPayload,
      provenance: restProv
    };
    const cleanedPayload = cleanObject(payloadToHash);
    const res = CanonicalSerializer.serialize(cleanedPayload);
    return pureSha256(res.canonicalString);
  }

  /**
   * Cleans undefined fields and deterministically serializes a baseline payload.
   */
  public static serialize(data: EngineeringConfigurationBaselineData): BaselineSerializationResult {
    if (!data || typeof data !== 'object') {
      throw new ConfigurationBaselineValidationError(
        'Baseline payload is required for serialization',
        'INVALID_BASELINE_PAYLOAD'
      );
    }

    const hash = this.computeContentHash(data);
    const payloadToSerialize = {
      ...data,
      ...(data.status === 'QUALIFIED' || data.contentHash ? { contentHash: hash } : {})
    };

    const cleanedPayload = cleanObject(payloadToSerialize);
    const res = CanonicalSerializer.serialize(cleanedPayload);

    return Object.freeze({
      canonicalString: res.canonicalString,
      byteLength: res.byteLength,
      contentHash: hash
    });
  }

  /**
   * Deserializes canonical JSON string into a validated EngineeringConfigurationBaselineData.
   */
  public static deserialize(canonicalString: string): EngineeringConfigurationBaselineData {
    if (!canonicalString || typeof canonicalString !== 'string') {
      throw new ConfigurationBaselineValidationError(
        'Canonical string must be a non-empty string',
        'INVALID_CANONICAL_STRING'
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(canonicalString);
    } catch (e: any) {
      throw new ConfigurationBaselineValidationError(
        `JSON parse error during baseline deserialization: ${e.message}`,
        'DESERIALIZATION_FAILED'
      );
    }

    const validated = ConfigurationBaselineValidator.validate(parsed as EngineeringConfigurationBaselineData);
    return validated;
  }

  /**
   * Verifies round-trip fidelity for a baseline payload.
   */
  public static verifyRoundTrip(data: EngineeringConfigurationBaselineData): boolean {
    const s1 = this.serialize(data);
    const restored = this.deserialize(s1.canonicalString);
    const s2 = this.serialize(restored);
    return s1.canonicalString === s2.canonicalString && s1.contentHash === s2.contentHash;
  }
}
