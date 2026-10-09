/**
 * SECP Industrial OS v2 — Phase 1: Engineering Truth Core
 * PATCH-010: Engineering Hash Chain Subsystem
 *
 * ARCHITECTURAL CONTRACT:
 * 1. Implements cryptographic engineering lineage connecting:
 *    DESIGN -> GEOMETRY -> SIMULATION -> RESULT -> VERIFICATION -> MANUFACTURING
 * 2. Strict integration with PATCH-008 (Identity) and PATCH-009 (Canonical Serialization).
 * 3. Every canonical hash is computed directly from CanonicalSerializer UTF-8 output with SHA-256.
 * 4. Every chain hash links deterministically to the previous chainHash.
 * 5. Volatile timestamps (createdAt) are provenance metadata only and NEVER enter the cryptographic payload.
 * 6. Zero fabricated evidence, zero hardcoded hashes, zero clock injection in hashing.
 * 7. Immutable node representations with structured verification results.
 */

import * as crypto from 'crypto';
import { CanonicalSerializer } from '../serialization/CanonicalSerializer';
import { EngineeringIdentity } from '../identity/CanonicalEngineeringIdentity';
import { EngineeringIdentityFactory } from '../identity/EngineeringIdentityFactory';
import {
  EngineeringChainStage,
  EngineeringHashNode,
  AppendNodeInput,
  EngineeringHashChainVerificationResult,
  EngineeringArtifactVerificationResult,
  FullLineageVerificationResult,
  VALID_CHAIN_STAGES
} from './types/EngineeringHashChainTypes';
import {
  MissingArtifactIdentityError,
  InvalidChainStageError,
  UnsupportedHashAlgorithmError,
  UnsupportedCanonicalizationVersionError
} from './EngineeringHashChainErrors';

export class EngineeringHashChain {
  public static readonly HASH_ALGORITHM: 'SHA-256' = 'SHA-256';
  public static readonly CANONICALIZATION_VERSION: string = CanonicalSerializer.SCHEMA_VERSION;

  /**
   * Compute deterministic SHA-256 canonical hash of an artifact using PATCH-009.
   */
  public static computeCanonicalHash(artifact: unknown): {
    canonicalHash: string;
    canonicalizationVersion: string;
  } {
    const serializationResult = CanonicalSerializer.serialize(artifact);
    const canonicalHash = crypto
      .createHash('sha256')
      .update(serializationResult.canonicalString, 'utf8')
      .digest('hex');

    return {
      canonicalHash,
      canonicalizationVersion: serializationResult.schemaVersion
    };
  }

  /**
   * Compute deterministic SHA-256 chain hash for a node's cryptographic payload.
   */
  public static computeChainHash(params: {
    stage: EngineeringChainStage;
    artifactId: string;
    artifactType: string;
    canonicalHash: string;
    previousHash: string | null;
    canonicalizationVersion?: string;
    hashAlgorithm?: string;
  }): string {
    const canonicalizationVersion =
      params.canonicalizationVersion ?? this.CANONICALIZATION_VERSION;
    const hashAlgorithm = params.hashAlgorithm ?? this.HASH_ALGORITHM;

    // Cryptographic payload contains strictly deterministic fields
    const chainPayload = {
      stage: params.stage,
      artifactId: params.artifactId,
      artifactType: params.artifactType,
      canonicalHash: params.canonicalHash,
      previousHash: params.previousHash,
      canonicalizationVersion,
      hashAlgorithm
    };

    const serializedPayload = CanonicalSerializer.serialize(chainPayload);
    return crypto
      .createHash('sha256')
      .update(serializedPayload.canonicalString, 'utf8')
      .digest('hex');
  }

  /**
   * Append an engineering artifact to the hash chain, creating an immutable node.
   */
  public static append(input: AppendNodeInput): EngineeringHashNode {
    // 1. Validate stage
    if (!VALID_CHAIN_STAGES.includes(input.stage)) {
      throw new InvalidChainStageError(input.stage);
    }

    // 2. Resolve Canonical Identity (PATCH-008)
    const identity = this.resolveIdentity(input.artifact, input.identity);
    if (!identity) {
      throw new MissingArtifactIdentityError(
        `Artifact supplied for stage [${input.stage}] does not have or specify a valid EngineeringIdentity`
      );
    }

    // 3. Compute Canonical Hash (PATCH-009 + SHA-256)
    const { canonicalHash, canonicalizationVersion } = this.computeCanonicalHash(input.artifact);

    // 4. Resolve Previous Hash
    const previousHash = input.previousNode ? input.previousNode.chainHash : null;
    const artifactId = identity.projectId || identity.identityId;

    // 5. Compute Chain Hash
    const chainHash = this.computeChainHash({
      stage: input.stage,
      artifactId,
      artifactType: identity.objectType,
      canonicalHash,
      previousHash,
      canonicalizationVersion,
      hashAlgorithm: this.HASH_ALGORITHM
    });

    // 6. Construct immutable node
    const node: EngineeringHashNode = {
      stage: input.stage,
      artifactId,
      artifactType: identity.objectType,
      canonicalHash,
      previousHash,
      chainHash,
      canonicalizationVersion,
      hashAlgorithm: this.HASH_ALGORITHM,
      ...(input.createdAt !== undefined && { createdAt: input.createdAt }),
      ...(input.metadata !== undefined && {
        metadata: Object.freeze({ ...input.metadata })
      })
    };

    return Object.freeze(node);
  }

  /**
   * Verify the structural and cryptographic integrity of an entire hash chain.
   */
  public static verify(
    chain: readonly EngineeringHashNode[] | EngineeringHashNode[]
  ): EngineeringHashChainVerificationResult {
    if (!Array.isArray(chain) || chain.length === 0) {
      return Object.freeze({
        valid: true,
        checkedNodes: 0,
        firstBrokenIndex: null,
        failureReason: 'NONE',
        details: 'Empty chain is trivially valid'
      });
    }

    for (let i = 0; i < chain.length; i++) {
      const node = chain[i];
      const prevNode = i > 0 ? chain[i - 1] : null;

      // 1. Basic node structural integrity
      if (
        !node ||
        typeof node !== 'object' ||
        !node.stage ||
        !node.artifactId ||
        !node.artifactType ||
        !node.canonicalHash ||
        !node.chainHash ||
        !node.hashAlgorithm ||
        !node.canonicalizationVersion
      ) {
        return Object.freeze({
          valid: false,
          checkedNodes: i + 1,
          firstBrokenIndex: i,
          failureReason: 'INVALID_NODE',
          brokenArtifactId: node?.artifactId,
          details: `Node at index ${i} is missing required properties`
        });
      }

      // 2. Validate hash algorithm
      if (node.hashAlgorithm !== this.HASH_ALGORITHM) {
        return Object.freeze({
          valid: false,
          checkedNodes: i + 1,
          firstBrokenIndex: i,
          failureReason: 'UNSUPPORTED_ALGORITHM',
          brokenArtifactId: node.artifactId,
          details: `Node at index ${i} specifies unsupported hash algorithm: ${node.hashAlgorithm}`
        });
      }

      // 3. Validate canonicalization version
      if (node.canonicalizationVersion !== this.CANONICALIZATION_VERSION) {
        return Object.freeze({
          valid: false,
          checkedNodes: i + 1,
          firstBrokenIndex: i,
          failureReason: 'UNSUPPORTED_CANONICALIZATION_VERSION',
          brokenArtifactId: node.artifactId,
          details: `Node at index ${i} specifies unsupported canonicalization version: ${node.canonicalizationVersion}`
        });
      }

      // 4. Validate lineage linkage (previousHash)
      if (i === 0) {
        if (node.previousHash !== null) {
          return Object.freeze({
            valid: false,
            checkedNodes: i + 1,
            firstBrokenIndex: 0,
            failureReason: 'BROKEN_PREVIOUS_LINK',
            brokenArtifactId: node.artifactId,
            expectedHash: 'null',
            actualHash: String(node.previousHash),
            details: 'Genesis node (index 0) must have previousHash === null'
          });
        }
      } else {
        if (node.previousHash !== prevNode!.chainHash) {
          return Object.freeze({
            valid: false,
            checkedNodes: i + 1,
            firstBrokenIndex: i,
            failureReason: 'BROKEN_PREVIOUS_LINK',
            brokenArtifactId: node.artifactId,
            expectedHash: prevNode!.chainHash,
            actualHash: node.previousHash ?? 'null',
            details: `Node at index ${i} previousHash does not match previous node chainHash`
          });
        }
      }

      // 5. Recompute chain hash from canonical payload
      const expectedChainHash = this.computeChainHash({
        stage: node.stage,
        artifactId: node.artifactId,
        artifactType: node.artifactType,
        canonicalHash: node.canonicalHash,
        previousHash: node.previousHash,
        canonicalizationVersion: node.canonicalizationVersion,
        hashAlgorithm: node.hashAlgorithm
      });

      if (node.chainHash !== expectedChainHash) {
        return Object.freeze({
          valid: false,
          checkedNodes: i + 1,
          firstBrokenIndex: i,
          failureReason: 'HASH_MISMATCH',
          brokenArtifactId: node.artifactId,
          expectedHash: expectedChainHash,
          actualHash: node.chainHash,
          details: `Node at index ${i} chainHash does not match cryptographic recomputation`
        });
      }
    }

    return Object.freeze({
      valid: true,
      checkedNodes: chain.length,
      firstBrokenIndex: null,
      failureReason: 'NONE'
    });
  }

  /**
   * Verify an individual node against its predecessor.
   */
  public static verifyNode(
    node: EngineeringHashNode,
    previousNode?: EngineeringHashNode | null
  ): boolean {
    if (!node) return false;

    const expectedPrevHash = previousNode ? previousNode.chainHash : null;
    if (node.previousHash !== expectedPrevHash) {
      return false;
    }

    const recomputed = this.computeChainHash({
      stage: node.stage,
      artifactId: node.artifactId,
      artifactType: node.artifactType,
      canonicalHash: node.canonicalHash,
      previousHash: node.previousHash,
      canonicalizationVersion: node.canonicalizationVersion,
      hashAlgorithm: node.hashAlgorithm
    });

    return node.chainHash === recomputed;
  }

  /**
   * Verify that an artifact's canonical content matches the recorded node.canonicalHash.
   */
  public static verifyArtifact(
    node: EngineeringHashNode,
    artifact: unknown,
    identity?: EngineeringIdentity
  ): EngineeringArtifactVerificationResult {
    if (!node || !node.artifactId || !node.canonicalHash) {
      return Object.freeze({
        valid: false,
        artifactId: node?.artifactId ?? 'UNKNOWN',
        expectedCanonicalHash: node?.canonicalHash ?? '',
        actualCanonicalHash: '',
        reason: 'INVALID_INPUT',
        details: 'Invalid node provided for artifact verification'
      });
    }

    // 1. Identity check if provided or extractable
    const resolvedIdentity = this.resolveIdentity(artifact, identity);
    const resolvedArtifactId = resolvedIdentity ? (resolvedIdentity.projectId || resolvedIdentity.identityId) : null;
    if (resolvedIdentity && resolvedArtifactId !== node.artifactId && resolvedIdentity.identityId !== node.artifactId) {
      return Object.freeze({
        valid: false,
        artifactId: node.artifactId,
        expectedCanonicalHash: node.canonicalHash,
        actualCanonicalHash: '',
        reason: 'IDENTITY_MISMATCH',
        details: `Artifact ID [${resolvedArtifactId}] does not match node ID [${node.artifactId}]`
      });
    }

    // 2. Canonicalize and compute actual hash
    let actualCanonicalHash = '';
    try {
      const canonicalization = this.computeCanonicalHash(artifact);
      actualCanonicalHash = canonicalization.canonicalHash;
    } catch (e: unknown) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      return Object.freeze({
        valid: false,
        artifactId: node.artifactId,
        expectedCanonicalHash: node.canonicalHash,
        actualCanonicalHash: '',
        reason: 'CANONICALIZATION_MISMATCH',
        details: `Failed to canonicalize artifact: ${errorMsg}`
      });
    }

    // 3. Compare hashes
    if (actualCanonicalHash !== node.canonicalHash) {
      return Object.freeze({
        valid: false,
        artifactId: node.artifactId,
        expectedCanonicalHash: node.canonicalHash,
        actualCanonicalHash,
        reason: 'ARTIFACT_MODIFIED',
        details: 'Actual canonical hash differs from recorded node canonical hash'
      });
    }

    return Object.freeze({
      valid: true,
      artifactId: node.artifactId,
      expectedCanonicalHash: node.canonicalHash,
      actualCanonicalHash,
      reason: 'VALID'
    });
  }

  /**
   * Verify complete end-to-end lineage: chain structure + all artifact contents.
   */
  public static verifyFullLineage(
    chain: readonly EngineeringHashNode[],
    artifacts: Map<string, unknown> | Record<string, unknown>
  ): FullLineageVerificationResult {
    const chainResult = this.verify(chain);

    const artifactResults: EngineeringArtifactVerificationResult[] = [];
    const tamperedArtifacts: string[] = [];

    const getArtifact = (id: string, stage: string): unknown => {
      if (artifacts instanceof Map) {
        const direct = artifacts.get(id) ?? artifacts.get(stage);
        if (direct !== undefined) return direct;
        for (const [, v] of artifacts.entries()) {
          const resId = this.resolveIdentity(v);
          if (resId && (resId.projectId === id || resId.identityId === id)) {
            return v;
          }
        }
      } else if (typeof artifacts === 'object' && artifacts !== null) {
        const record = artifacts as Record<string, unknown>;
        const direct = record[id] ?? record[stage];
        if (direct !== undefined) return direct;
        for (const [, v] of Object.entries(record)) {
          const resId = this.resolveIdentity(v);
          if (resId && (resId.projectId === id || resId.identityId === id)) {
            return v;
          }
        }
      }
      return undefined;
    };

    let verifiedStages = 0;

    for (const node of chain) {
      const artifact = getArtifact(node.artifactId, node.stage);
      if (artifact === undefined) {
        const missingResult: EngineeringArtifactVerificationResult = {
          valid: false,
          artifactId: node.artifactId,
          expectedCanonicalHash: node.canonicalHash,
          actualCanonicalHash: '',
          reason: 'ARTIFACT_MODIFIED',
          details: `Artifact [${node.artifactId}] not supplied in artifact map`
        };
        artifactResults.push(missingResult);
        tamperedArtifacts.push(node.artifactId);
      } else {
        const artResult = this.verifyArtifact(node, artifact);
        artifactResults.push(artResult);
        if (!artResult.valid) {
          tamperedArtifacts.push(node.artifactId);
        } else {
          verifiedStages++;
        }
      }
    }

    const valid = chainResult.valid && tamperedArtifacts.length === 0;

    return Object.freeze({
      valid,
      chainResult,
      artifactResults: Object.freeze(artifactResults),
      totalStages: chain.length,
      verifiedStages,
      tamperedArtifacts: Object.freeze(tamperedArtifacts)
    });
  }

  /**
   * Retrieve head (latest node) of chain.
   */
  public static getHead(
    chain: readonly EngineeringHashNode[] | EngineeringHashNode[]
  ): EngineeringHashNode | null {
    if (!Array.isArray(chain) || chain.length === 0) return null;
    return chain[chain.length - 1];
  }

  /**
   * Retrieve root (genesis node) of chain.
   */
  public static getRoot(
    chain: readonly EngineeringHashNode[] | EngineeringHashNode[]
  ): EngineeringHashNode | null {
    if (!Array.isArray(chain) || chain.length === 0) return null;
    return chain[0];
  }

  /**
   * Helper to resolve EngineeringIdentity from an input artifact or explicit identity object.
   */
  private static resolveIdentity(
    artifact: unknown,
    explicitIdentity?: EngineeringIdentity
  ): EngineeringIdentity | null {
    // 1. Explicit identity takes precedence
    if (explicitIdentity) {
      const validation = EngineeringIdentityFactory.validateIdentity(explicitIdentity);
      if (validation.valid) {
        return explicitIdentity;
      }
      throw new MissingArtifactIdentityError(
        `Supplied explicit identity is invalid: ${validation.errors.join('; ')}`
      );
    }

    // 2. Check if artifact is directly a EngineeringIdentity
    if (this.isCanonicalIdentity(artifact)) {
      return artifact as EngineeringIdentity;
    }

    // 3. Check if artifact contains an identity property
    if (
      typeof artifact === 'object' &&
      artifact !== null &&
      'identity' in artifact &&
      this.isCanonicalIdentity((artifact as { identity: unknown }).identity)
    ) {
      return (artifact as { identity: EngineeringIdentity }).identity;
    }

    // 4. Check if artifact contains standard identifier fields (artifactId, artifactType)
    if (
      typeof artifact === 'object' &&
      artifact !== null &&
      'artifactId' in artifact &&
      'artifactType' in artifact &&
      typeof (artifact as { artifactId: unknown }).artifactId === 'string' &&
      typeof (artifact as { artifactType: unknown }).artifactType === 'string'
    ) {
      try {
        return EngineeringIdentityFactory.createIdentity({
          projectId: (artifact as any).projectId || 'DEFAULT_PROJECT',
          revisionId: (artifact as any).revisionId || 'rev-01',
          createdBy: (artifact as any).createdBy || 'system',
          seed: (artifact as any).artifactId || 'seed',
          objectType: (artifact as any).artifactType || 'GEOMETRY'
        }, artifact);
      } catch {
        return null;
      }
    }

    return null;
  }

  private static isCanonicalIdentity(val: unknown): boolean {
    if (typeof val !== 'object' || val === null) return false;
    const v = val as Record<string, unknown>;
    return (
      typeof v.identityId === 'string' &&
      v.identityId.trim().length > 0 &&
      typeof v.objectType === 'string' &&
      typeof v.projectId === 'string' &&
      typeof v.revisionId === 'string'
    );
  }
}
