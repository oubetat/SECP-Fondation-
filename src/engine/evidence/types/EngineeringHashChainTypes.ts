/**
 * SECP Industrial OS v2 — Phase 1: Engineering Truth Core
 * PATCH-010: Engineering Hash Chain Types
 *
 * ARCHITECTURAL CONTRACT:
 * 1. Engineering Hash Chain provides tamper-evident cryptographic lineage across engineering stages:
 *    DESIGN -> GEOMETRY -> SIMULATION -> RESULT -> VERIFICATION -> MANUFACTURING.
 * 2. Pure cryptographic lineage: Hashing is not proof of physical correctness; it proves integrity and lineage.
 * 3. Integrates with PATCH-008 Canonical Engineering Identity & PATCH-009 Canonical Serialization.
 * 4. All hashes are deterministic, lowercase hexadecimal SHA-256 strings.
 * 5. Volatile timestamps (createdAt) are strictly metadata and never participate in the cryptographic payload.
 */

import { EngineeringIdentity } from '../../identity/CanonicalEngineeringIdentity';

export type EngineeringChainStage =
  | 'DESIGN'
  | 'GEOMETRY'
  | 'SIMULATION'
  | 'RESULT'
  | 'VERIFICATION'
  | 'MANUFACTURING';

export const VALID_CHAIN_STAGES: readonly EngineeringChainStage[] = Object.freeze([
  'DESIGN',
  'GEOMETRY',
  'SIMULATION',
  'RESULT',
  'VERIFICATION',
  'MANUFACTURING'
]);

export interface EngineeringHashNode {
  readonly stage: EngineeringChainStage;
  readonly artifactId: string;
  readonly artifactType: string;

  readonly canonicalHash: string;
  readonly previousHash: string | null;

  readonly chainHash: string;

  readonly canonicalizationVersion: string;
  readonly hashAlgorithm: string;

  readonly createdAt?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface AppendNodeInput {
  readonly stage: EngineeringChainStage;
  readonly artifact: unknown;
  readonly identity?: EngineeringIdentity;
  readonly previousNode?: EngineeringHashNode | null;
  readonly createdAt?: string;
  readonly metadata?: Record<string, unknown>;
}

export type ChainFailureReason =
  | 'NONE'
  | 'EMPTY_CHAIN'
  | 'INVALID_NODE'
  | 'HASH_MISMATCH'
  | 'BROKEN_PREVIOUS_LINK'
  | 'CANONICALIZATION_MISMATCH'
  | 'IDENTITY_MISMATCH'
  | 'CHAIN_ORDER_VIOLATION'
  | 'UNSUPPORTED_ALGORITHM'
  | 'UNSUPPORTED_CANONICALIZATION_VERSION'
  | 'TAMPER_DETECTED';

export interface EngineeringHashChainVerificationResult {
  readonly valid: boolean;
  readonly checkedNodes: number;
  readonly firstBrokenIndex: number | null;
  readonly failureReason: ChainFailureReason;
  readonly brokenArtifactId?: string;
  readonly expectedHash?: string;
  readonly actualHash?: string;
  readonly details?: string;
}

export type ArtifactVerificationReason =
  | 'VALID'
  | 'ARTIFACT_MODIFIED'
  | 'IDENTITY_MISMATCH'
  | 'CANONICALIZATION_MISMATCH'
  | 'INVALID_INPUT'
  | 'UNSUPPORTED_VERSION';

export interface EngineeringArtifactVerificationResult {
  readonly valid: boolean;
  readonly artifactId: string;
  readonly expectedCanonicalHash: string;
  readonly actualCanonicalHash: string;
  readonly reason: ArtifactVerificationReason;
  readonly details?: string;
}

export interface FullLineageVerificationResult {
  readonly valid: boolean;
  readonly chainResult: EngineeringHashChainVerificationResult;
  readonly artifactResults: readonly EngineeringArtifactVerificationResult[];
  readonly totalStages: number;
  readonly verifiedStages: number;
  readonly tamperedArtifacts: readonly string[];
}
