/**
 * SECP Industrial OS v2 — Phase 1: Engineering Truth Core
 * PATCH-009: Canonical Serialization Types
 *
 * ARCHITECTURAL CONTRACT:
 * 1. Defines the data models and contracts for deterministic, canonical serialization of engineering artifacts.
 * 2. Immutable result structures capturing schema version, canonical string, byte length, and normalized tree.
 * 3. Pure representation specification: does NOT perform hashing, timestamp generation, or cryptographic signatures.
 */

export interface CanonicalSerializationResult {
  readonly schemaVersion: '1.0.0';
  readonly canonicalString: string;
  readonly byteLength: number;
  readonly normalized: unknown;
}

export interface BigIntRepresentation {
  readonly $type: 'bigint';
  readonly $value: string;
}

export interface CanonicalSerializationValidationResult {
  readonly valid: boolean;
  readonly errors: string[];
}

export type PrimitiveCanonicalValue =
  | string
  | number
  | boolean
  | null
  | BigIntRepresentation;

export type CanonicalNode =
  | PrimitiveCanonicalValue
  | readonly CanonicalNode[]
  | CanonicalNode[]
  | { readonly [key: string]: CanonicalNode };
