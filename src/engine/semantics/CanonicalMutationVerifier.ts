/**
 * SECP Industrial OS v3 — PROMPT-052: Canonical Mutation Verifier
 * Rigorously differentiates genuine Canonical Engineering State mutations from UI/preview/transient noise.
 */

import { createHash } from 'crypto';
import {
  CanonicalMutationProof,
  NonCanonicalMutationReason
} from './SuccessSemanticsTypes';

export class CanonicalMutationVerifier {
  /**
   * Verifies that an engineering mutation meets all criteria for a canonical mutation:
   * 1. Target is a valid, non-empty EngineeringDocument ID.
   * 2. Revision incremented monotonically (newRevision > previousRevision).
   * 3. Canonical payload hash changed between before and after states (before !== after).
   * 4. State is not marked stale or diverged.
   * 5. Model is rebuildable / regenerable.
   * 6. Free of non-canonical flags (UI state only, preview only, toast only, etc.).
   */
  public static verifyMutation(proof: CanonicalMutationProof): {
    isValid: boolean;
    rejectionReasons: string[];
    computedProofHash: string;
  } {
    const rejectionReasons: string[] = [];

    // 1. Basic canonical proof flag
    if (!proof.isCanonicalMutation) {
      rejectionReasons.push('Proof explicitly denotes non-canonical mutation');
    }

    // 2. Target document ID
    if (!proof.targetDocumentId || proof.targetDocumentId.trim() === '') {
      rejectionReasons.push('Target EngineeringDocument ID is missing or empty');
    }

    // 3. Revision monotonic increment
    if (proof.newRevision <= proof.previousRevision) {
      rejectionReasons.push(
        `Revision failed to advance monotonically (prev: ${proof.previousRevision}, new: ${proof.newRevision})`
      );
    }

    // 4. Canonical payload hash difference
    if (!proof.canonicalPayloadHashBefore || !proof.canonicalPayloadHashAfter) {
      rejectionReasons.push('Canonical payload hash before/after is missing');
    } else if (proof.canonicalPayloadHashBefore === proof.canonicalPayloadHashAfter) {
      rejectionReasons.push('Canonical payload hash did not change: state is identical before and after');
    }

    // 5. Stale state check
    if (proof.isStaleState) {
      rejectionReasons.push('Target canonical state is marked STALE');
    }

    // 6. Rebuildability
    if (!proof.rebuildable) {
      rejectionReasons.push('Canonical model mutation is not rebuildable / regenerable');
    }

    // 7. Affected entities check
    if (!proof.affectedCanonicalEntities || proof.affectedCanonicalEntities.length === 0) {
      rejectionReasons.push('No canonical entities (features, bodies, constraints, etc.) were affected');
    }

    // 8. Non-canonical reasons check
    if (proof.nonCanonicalReasons && proof.nonCanonicalReasons.length > 0) {
      for (const reason of proof.nonCanonicalReasons) {
        rejectionReasons.push(`Non-canonical mutation reason present: ${reason}`);
      }
    }

    // Compute cryptographic signature of the mutation proof
    const hashPayload = [
      proof.targetDocumentId,
      proof.previousRevision,
      proof.newRevision,
      proof.mutationType,
      proof.canonicalPayloadHashBefore,
      proof.canonicalPayloadHashAfter,
      proof.isStaleState,
      proof.rebuildable,
      ...(proof.affectedCanonicalEntities || []),
      ...(proof.nonCanonicalReasons || [])
    ].join(':');

    const computedProofHash = createHash('sha256').update(hashPayload).digest('hex');

    return {
      isValid: rejectionReasons.length === 0,
      rejectionReasons,
      computedProofHash
    };
  }

  /**
   * Helper to construct a synthetic or validated canonical mutation proof.
   */
  public static createValidProof(params: {
    targetDocumentId: string;
    previousRevision: number;
    mutationType: string;
    affectedEntities: string[];
    contentBefore: unknown;
    contentAfter: unknown;
  }): CanonicalMutationProof {
    const hashBefore = createHash('sha256').update(JSON.stringify(params.contentBefore)).digest('hex');
    const hashAfter = createHash('sha256').update(JSON.stringify(params.contentAfter)).digest('hex');

    return {
      isCanonicalMutation: true,
      targetDocumentId: params.targetDocumentId,
      previousRevision: params.previousRevision,
      newRevision: params.previousRevision + 1,
      mutationType: params.mutationType,
      affectedCanonicalEntities: params.affectedEntities,
      canonicalPayloadHashBefore: hashBefore,
      canonicalPayloadHashAfter: hashAfter,
      isStaleState: false,
      rebuildable: true
    };
  }

  /**
   * Helper to construct a non-canonical proof (e.g. for testing negative proofs).
   */
  public static createNonCanonicalProof(
    reason: NonCanonicalMutationReason,
    details?: string
  ): CanonicalMutationProof {
    return {
      isCanonicalMutation: false,
      targetDocumentId: '',
      previousRevision: 1,
      newRevision: 1,
      mutationType: 'UI_ONLY',
      affectedCanonicalEntities: [],
      canonicalPayloadHashBefore: '0000000000000000000000000000000000000000000000000000000000000000',
      canonicalPayloadHashAfter: '0000000000000000000000000000000000000000000000000000000000000000',
      isStaleState: false,
      rebuildable: false,
      nonCanonicalReasons: [reason],
      details
    };
  }
}
