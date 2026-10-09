/**
 * SECP Industrial OS v2 — Phase 1: Engineering Truth Core
 * PATCH-009: Canonical Serializer
 *
 * ARCHITECTURAL CONTRACT:
 * 1. Pure, deterministic serialization pipeline:
 *    INPUT -> NORMALIZATION -> CANONICAL FORM -> DETERMINISTIC UTF-8 STRING / BYTES
 * 2. Strict key order sorting, array order preservation, Unicode NFC normalization, -0 normalization.
 * 3. Rejection of NaN, Infinity, undefined in arrays, functions, and circular references.
 * 4. UTF-8 byte calculation using TextEncoder.
 * 5. Strictly ZERO cryptographic hashing, zero Date.now() / timestamp injection, zero random tokens.
 * 6. Input immutability preserved (never mutated).
 */

import {
  CanonicalSerializationResult,
  CanonicalNode,
  CanonicalSerializationValidationResult
} from './CanonicalSerializationTypes';
import { CanonicalNormalizer } from './CanonicalNormalizer';
import { CanonicalSerializationValidator } from './CanonicalSerializationValidator';
import { InvalidCanonicalStructureError } from './CanonicalSerializationErrors';

const textEncoder = new TextEncoder();

export class CanonicalSerializer {
  public static readonly SCHEMA_VERSION: '1.0.0' = '1.0.0';

  /**
   * Main serialization pipeline:
   * Input -> Normalize -> Deterministic Stringify -> Compute UTF-8 Byte Length -> Return Result
   */
  public static serialize(input: unknown): CanonicalSerializationResult {
    // 1. Normalize
    const normalized = CanonicalNormalizer.normalize(input);

    // 2. Canonical stringify
    const canonicalString = this.stringifyNode(normalized);

    // 3. Validate canonical structure
    const validation = CanonicalSerializationValidator.validateCanonicalString(canonicalString);
    if (!validation.valid) {
      throw new InvalidCanonicalStructureError(validation.errors.join('; '));
    }

    // 4. Compute exact UTF-8 byte length
    const byteLength = textEncoder.encode(canonicalString).length;

    return Object.freeze({
      schemaVersion: this.SCHEMA_VERSION,
      canonicalString,
      byteLength,
      normalized
    });
  }

  /**
   * Normalize an input into its canonical node tree without stringifying.
   */
  public static normalize(input: unknown): CanonicalNode {
    return CanonicalNormalizer.normalize(input);
  }

  /**
   * Validate a candidate canonical serialization string.
   */
  public static validate(canonicalString: string): CanonicalSerializationValidationResult {
    return CanonicalSerializationValidator.validateCanonicalString(canonicalString);
  }

  /**
   * Calculate UTF-8 byte length for a given canonical string.
   */
  public static byteLength(canonicalString: string): number {
    return textEncoder.encode(canonicalString).length;
  }

  /**
   * Recursive deterministic stringifier without whitespace or key-order ambiguity.
   */
  private static stringifyNode(node: CanonicalNode): string {
    if (node === null || node === undefined) {
      return 'null';
    }

    if (typeof node === 'boolean') {
      return node ? 'true' : 'false';
    }

    if (typeof node === 'number') {
      // Handles -0 normalization guarantee
      if (Object.is(node, -0)) {
        return '0';
      }
      return node.toString();
    }

    if (typeof node === 'string') {
      return JSON.stringify(node);
    }

    if (Array.isArray(node)) {
      const items = node.map((item) => this.stringifyNode(item));
      return `[${items.join(',')}]`;
    }

    if (typeof node === 'object') {
      const obj = node as Record<string, CanonicalNode>;
      const keys = Object.keys(obj)
        .filter((key) => obj[key] !== undefined)
        .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
      const pairs = keys.map((key) => `${JSON.stringify(key)}:${this.stringifyNode(obj[key])}`);
      return `{${pairs.join(',')}}`;
    }

    throw new InvalidCanonicalStructureError(`Unexpected node type in stringifier: ${typeof node}`);
  }
}
