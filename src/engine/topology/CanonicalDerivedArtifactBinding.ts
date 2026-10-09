/**
 * SECP-POST-TOPOLOGY-002 — Canonical Derived Artifact Binding Engine
 * 
 * Non-authoritative cryptographic binding mechanism for derived artifacts
 * (topology, features, CAM toolpaths, manufacturing features).
 * 
 * INVARIANTS:
 * - Deterministically binds derived artifacts to the exact canonical CAD Revision (cadRevisionHash)
 *   and Canonical Geometry (canonicalGeometryHash).
 * - NOT an authority, certificate authority, release authority, or trust registry.
 * - Does NOT prohibit legitimate CAD regeneration or rebinding workflows.
 * - Enforces: "NO DERIVED ARTIFACT WITHOUT VERIFIABLE CANONICAL REVISION BINDING."
 */

import { generateDeterministicHashSync } from '../../lib/hash';

export type DerivedArtifactKind = 
  | 'TOPOLOGY' 
  | 'FEATURE' 
  | 'CAM_TOOLPATH' 
  | 'MANUFACTURING_FEATURE'
  | 'SIMULATION_RESULT';

export interface DerivedArtifactBindingPayload {
  cadRevisionHash: string;
  canonicalGeometryHash: string;
  artifactKind: DerivedArtifactKind;
  parentArtifactIdentity?: string | null;
  derivationIdentity: string; // e.g. operationId, derivation rule name, or function name
  derivationParameters?: Record<string, any>;
  artifactContentHash: string; // Hash of raw artifact payload
  featureId?: string;
  topologyId?: string;
  bodyId?: string;
  faceId?: string;
  edgeId?: string;
  vertexId?: string;
  operationId?: string;
  trajectoryHash?: string;
  scenarioId?: string;
}

export interface DerivedArtifactBindingResult {
  artifactDigest: string; // Deterministic SHA-256 of canonicalized payload
  cadRevisionHash: string;
  canonicalGeometryHash: string;
  artifactKind: DerivedArtifactKind;
  payload: DerivedArtifactBindingPayload;
  boundAtVersion?: number;
  isBound: boolean;
}

export interface DerivedArtifactVerificationResult {
  isValid: boolean;
  isDigestValid: boolean;
  isRevisionMatched: boolean;
  isGeometryMatched: boolean;
  reasons: string[];
  status: 'VERIFIED' | 'REVISION_MISMATCH' | 'GEOMETRY_MISMATCH' | 'CORRUPTED' | 'UNBOUND' | string;
  failureReason?: string;
  mismatchDetails?: string;
  [key: string]: any;
}

export class CanonicalDerivedArtifactBinding {
  /**
   * Creates a deterministic cryptographic binding for a derived engineering artifact.
   */
  public static createBinding(
    payload: DerivedArtifactBindingPayload,
    version: number = 1
  ): DerivedArtifactBindingResult {
    // Structural Invariant Validation
    if (!payload) {
      throw new Error('DerivedArtifactBindingPayload cannot be null or undefined');
    }

    if (!payload.cadRevisionHash || typeof payload.cadRevisionHash !== 'string' || payload.cadRevisionHash.trim() === '') {
      throw new Error('DerivedArtifactBinding requires a non-empty cadRevisionHash');
    }

    if (!payload.canonicalGeometryHash || typeof payload.canonicalGeometryHash !== 'string' || payload.canonicalGeometryHash.trim() === '') {
      throw new Error('DerivedArtifactBinding requires a non-empty canonicalGeometryHash');
    }

    if (!payload.artifactContentHash || typeof payload.artifactContentHash !== 'string' || payload.artifactContentHash.trim() === '') {
      throw new Error('DerivedArtifactBinding requires a non-empty artifactContentHash');
    }

    if (!payload.artifactKind) {
      throw new Error('DerivedArtifactBinding requires a valid artifactKind');
    }

    // Canonicalize Payload (Deterministic Object Key Ordering, Zero Randomness / Timestamps)
    const canonicalizedPayload = this.canonicalizePayload(payload);
    const artifactDigest = generateDeterministicHashSync(canonicalizedPayload);

    return {
      artifactDigest,
      cadRevisionHash: payload.cadRevisionHash,
      canonicalGeometryHash: payload.canonicalGeometryHash,
      artifactKind: payload.artifactKind,
      payload: canonicalizedPayload,
      boundAtVersion: version,
      isBound: true
    };
  }

  /**
   * Verifies an existing derived artifact binding against target revision and geometry expectations.
   */
  public static verifyBinding(
    binding: DerivedArtifactBindingResult,
    expectedCadRevisionHash: string,
    expectedGeometryHash?: string
  ): DerivedArtifactVerificationResult {
    const reasons: string[] = [];

    if (!binding || !binding.isBound || !binding.artifactDigest || !binding.payload) {
      return {
        isValid: false,
        isDigestValid: false,
        isRevisionMatched: false,
        isGeometryMatched: false,
        reasons: ['Artifact binding is missing, un-bound, or malformed'],
        status: 'UNBOUND'
      };
    }

    // 1. Recompute digest to verify payload integrity
    const canonicalized = this.canonicalizePayload(binding.payload);
    const recomputedDigest = generateDeterministicHashSync(canonicalized);
    const isDigestValid = recomputedDigest === binding.artifactDigest;

    if (!isDigestValid) {
      reasons.push(`Digest mismatch: expected ${binding.artifactDigest}, recomputed ${recomputedDigest}`);
    }

    // 2. Verify CAD Revision match
    const isRevisionMatched = binding.cadRevisionHash === expectedCadRevisionHash;
    if (!isRevisionMatched) {
      reasons.push(`Revision mismatch: bound to ${binding.cadRevisionHash}, expected ${expectedCadRevisionHash}`);
    }

    // 3. Verify Geometry Hash match if specified
    let isGeometryMatched = true;
    if (expectedGeometryHash !== undefined && expectedGeometryHash !== '') {
      isGeometryMatched = binding.canonicalGeometryHash === expectedGeometryHash;
      if (!isGeometryMatched) {
        reasons.push(`Geometry mismatch: bound to ${binding.canonicalGeometryHash}, expected ${expectedGeometryHash}`);
      }
    }

    const isValid = isDigestValid && isRevisionMatched && isGeometryMatched;
    let status: DerivedArtifactVerificationResult['status'] = 'VERIFIED';

    if (!isDigestValid) {
      status = 'CORRUPTED';
    } else if (!isRevisionMatched) {
      status = 'REVISION_MISMATCH';
    } else if (!isGeometryMatched) {
      status = 'GEOMETRY_MISMATCH';
    }

    return {
      isValid,
      isDigestValid,
      isRevisionMatched,
      isGeometryMatched,
      reasons,
      status
    };
  }

  /**
   * Rebinds a derived artifact to a NEW CAD Revision, establishing lineage provenance.
   */
  public static rebindArtifact(
    existingBinding: DerivedArtifactBindingResult,
    newCadRevisionHash: string,
    newGeometryHash: string,
    newArtifactContentHash?: string,
    newDerivationParameters?: Record<string, any>
  ): DerivedArtifactBindingResult {
    if (!existingBinding || !existingBinding.isBound) {
      throw new Error('Cannot rebind an invalid or un-bound derived artifact');
    }

    const updatedPayload: DerivedArtifactBindingPayload = {
      ...existingBinding.payload,
      cadRevisionHash: newCadRevisionHash,
      canonicalGeometryHash: newGeometryHash,
      artifactContentHash: newArtifactContentHash || existingBinding.payload.artifactContentHash,
      parentArtifactIdentity: existingBinding.artifactDigest, // Cryptographic lineage chain!
      derivationParameters: newDerivationParameters || existingBinding.payload.derivationParameters
    };

    return this.createBinding(
      updatedPayload,
      (existingBinding.boundAtVersion || 1) + 1
    );
  }

  /**
   * Deterministic Object Canonicalization (Ensures identical keys produce identical string output)
   */
  private static canonicalizePayload(payload: DerivedArtifactBindingPayload): DerivedArtifactBindingPayload {
    const cleanObject = (obj: any): any => {
      if (obj === null || typeof obj !== 'object') {
        return obj;
      }
      if (Array.isArray(obj)) {
        return obj.map(cleanObject);
      }
      const sortedKeys = Object.keys(obj).sort();
      const result: Record<string, any> = {};
      for (const key of sortedKeys) {
        if (obj[key] !== undefined) {
          result[key] = cleanObject(obj[key]);
        }
      }
      return result;
    };

    return cleanObject(payload);
  }
}
