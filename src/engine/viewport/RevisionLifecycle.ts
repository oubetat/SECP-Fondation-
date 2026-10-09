/**
 * SECP CAD Kernel — Canonical Revision & Stale Lifecycle
 * Phase 2 (SECP — REVISION / STALE LIFECYCLE)
 *
 * ARCHITECTURAL CONTRACT:
 * - Single Canonical Engineering Document representing the authoritative source of truth.
 * - Framework-independent, React-independent, Three.js-independent, DOM-independent.
 * - Governs the lifecycle of all derived projections (CanonicalRenderData, CanonicalPickResult, Highlight).
 * - Enforces explicit lifecycle states: CURRENT | STALE | REVALIDATED | INVALID.
 * - Forbids stale or invalid derived state from masquerading as CURRENT.
 * - Re-resolves selections across revisions strictly via persistent topological identity + lineage.
 * - Zero parallel geometry creation, zero shadow documents, zero duplicate CAD geometry.
 *
 * LIFECYCLE STATE MACHINE:
 *
 *           CURRENT (documentId, revision, brepHash, meshHash matched)
 *              │
 *              │ canonical document changes (revision increment / mutation)
 *              ▼
 *            STALE (derived from previous revision)
 *              │
 *              ├── revalidateSelection (persistent topology re-resolution)
 *              │      ├── Found in new topologyMap ──► REVALIDATED (new revision provenance)
 *              │      └── Not found in new topologyMap ──► INVALID
 *              │
 *              └── documentId mismatch or unrecoverable hash divergence ──► INVALID
 */

import { EngineeringDocument } from '../cad-kernel/document/CADDocument';
import { CanonicalRenderData } from './CanonicalRenderContract';
import { CanonicalPickResult, CanonicalTopologyType } from './CanonicalPickingContract';

/**
 * Formal lifecycle states for any canonical-derived engineering artifact.
 */
export enum RevisionLifecycleState {
  /** Fully synchronized with the current canonical EngineeringDocument revision and hashes */
  CURRENT = 'CURRENT',

  /** Derived from an older revision of the same document; requires re-evaluation or re-resolution */
  STALE = 'STALE',

  /** Successfully re-resolved against the new revision using persistent topological identity */
  REVALIDATED = 'REVALIDATED',

  /** Irrevocably incompatible: document mismatch, missing topology, or failed re-resolution */
  INVALID = 'INVALID'
}

/**
 * Immutable canonical revision identity tuple (documentId, revision, brepHash, meshHash).
 */
export interface CanonicalRevisionIdentity {
  readonly documentId: string;
  readonly revision: number | string;
  readonly brepHash: string;
  readonly meshHash: string;
}

/**
 * Diagnostic result of classifying a derived state against canonical authority.
 */
export interface DerivedStateClassification {
  readonly status: RevisionLifecycleState;
  readonly reason: string;
  readonly documentIdMatch: boolean;
  readonly revisionMatch: boolean;
  readonly brepHashMatch: boolean;
  readonly meshHashMatch: boolean;
  readonly derivedIdentity: CanonicalRevisionIdentity;
  readonly canonicalIdentity: CanonicalRevisionIdentity;
}

/**
 * Provenance-tracked container pairing any derived artifact with its lifecycle status.
 */
export interface RevisionTracked<T> {
  readonly status: RevisionLifecycleState;
  readonly value: T | null;
  readonly provenance: CanonicalRevisionIdentity;
  readonly reason: string;
  readonly revalidatedFromRevision?: number | string;
}

/**
 * Result of attempting to re-resolve a persistent topology selection into a new revision.
 */
export interface TopologyRevalidationResult {
  readonly success: boolean;
  readonly status: RevisionLifecycleState;
  readonly resolvedPick: CanonicalPickResult | null;
  readonly persistentEntityId: string;
  readonly sourceRevision: number | string;
  readonly targetRevision: number | string;
  readonly error?: string;
}

/**
 * Extracts a canonical revision identity tuple from any source of truth or derived artifact.
 * Deterministic and read-only.
 */
export function captureCanonicalRevision(
  source: EngineeringDocument | CanonicalRenderData | CanonicalPickResult | CanonicalRevisionIdentity
): CanonicalRevisionIdentity {
  if (!source) {
    return Object.freeze({
      documentId: 'UNKNOWN_DOC',
      revision: 0,
      brepHash: '',
      meshHash: ''
    });
  }

  // Source is already a CanonicalRevisionIdentity
  if ('documentId' in source && 'revision' in source && 'brepHash' in source && 'meshHash' in source) {
    return Object.freeze({
      documentId: String(source.documentId || 'UNKNOWN_DOC'),
      revision: source.revision !== undefined ? source.revision : 0,
      brepHash: String(source.brepHash || ''),
      meshHash: String(source.meshHash || '')
    });
  }

  // Source is an EngineeringDocument
  const doc = source as EngineeringDocument;
  const documentId = String(doc.documentId || 'UNKNOWN_DOC');
  const revision = doc.revision !== undefined ? doc.revision : 0;
  const brepHash = doc.derived?.mesh?.brepHash || (doc.evaluatedShape as any)?.hash || '';
  const meshHash = doc.derived?.mesh?.meshHash || '';

  return Object.freeze({
    documentId,
    revision,
    brepHash,
    meshHash
  });
}

/**
 * Compares two canonical revision identities and reports detailed relationship metrics.
 */
export function compareRevision(
  a: CanonicalRevisionIdentity,
  b: CanonicalRevisionIdentity
): {
  readonly isIdentical: boolean;
  readonly documentChanged: boolean;
  readonly revisionChanged: boolean;
  readonly hashesChanged: boolean;
} {
  const documentChanged = a.documentId !== b.documentId;
  const revisionChanged = String(a.revision) !== String(b.revision);
  const hashesChanged = a.brepHash !== b.brepHash || a.meshHash !== b.meshHash;
  const isIdentical = !documentChanged && !revisionChanged && !hashesChanged;

  return Object.freeze({
    isIdentical,
    documentChanged,
    revisionChanged,
    hashesChanged
  });
}

/**
 * Classifies a derived artifact's lifecycle state relative to the current canonical authority.
 *
 * Rules:
 * 1. Document ID mismatch -> INVALID
 * 2. Document matches, but revision changed -> STALE
 * 3. Document and revision match, but hashes mismatch -> INVALID (Hash divergence under same revision number)
 * 4. Document, revision, and hashes all match -> CURRENT
 */
export function classifyDerivedState(
  derived: CanonicalRevisionIdentity | CanonicalPickResult | CanonicalRenderData | { documentId: string; revision: number | string; brepHash?: string; meshHash?: string },
  canonicalSource: EngineeringDocument | CanonicalRenderData | CanonicalRevisionIdentity
): DerivedStateClassification {
  const derivedId = captureCanonicalRevision(derived as any);
  const canonicalId = captureCanonicalRevision(canonicalSource as any);

  const documentIdMatch = derivedId.documentId === canonicalId.documentId;
  const revisionMatch = String(derivedId.revision) === String(canonicalId.revision);
  const brepHashMatch = derivedId.brepHash === canonicalId.brepHash;
  const meshHashMatch = derivedId.meshHash === canonicalId.meshHash;

  // Case 1: Different documents entirely
  if (!documentIdMatch) {
    return Object.freeze({
      status: RevisionLifecycleState.INVALID,
      reason: `Document mismatch: derived from '${derivedId.documentId}', current is '${canonicalId.documentId}'`,
      documentIdMatch: false,
      revisionMatch,
      brepHashMatch,
      meshHashMatch,
      derivedIdentity: derivedId,
      canonicalIdentity: canonicalId
    });
  }

  // Case 2: Document revision has changed
  if (!revisionMatch) {
    return Object.freeze({
      status: RevisionLifecycleState.STALE,
      reason: `Revision divergence: derived state is on revision ${derivedId.revision}, current canonical revision is ${canonicalId.revision}`,
      documentIdMatch: true,
      revisionMatch: false,
      brepHashMatch,
      meshHashMatch,
      derivedIdentity: derivedId,
      canonicalIdentity: canonicalId
    });
  }

  // Case 3: Revision matches, but geometry hashes diverge
  // (e.g. uncommitted parametric mutation or hash tampering)
  const hasDivergence = 
    (derivedId.meshHash && canonicalId.meshHash && !meshHashMatch) ||
    (derivedId.brepHash && canonicalId.brepHash && !brepHashMatch);

  if (hasDivergence) {
    return Object.freeze({
      status: RevisionLifecycleState.INVALID,
      reason: `Hash divergence under revision ${canonicalId.revision}: hashes do not match`,
      documentIdMatch: true,
      revisionMatch: true,
      brepHashMatch,
      meshHashMatch,
      derivedIdentity: derivedId,
      canonicalIdentity: canonicalId
    });
  }

  // Case 4: Complete identity synchronization
  return Object.freeze({
    status: RevisionLifecycleState.CURRENT,
    reason: `Synchronized with canonical revision ${canonicalId.revision}`,
    documentIdMatch: true,
    revisionMatch: true,
    brepHashMatch: true,
    meshHashMatch: true,
    derivedIdentity: derivedId,
    canonicalIdentity: canonicalId
  });
}

/**
 * Wraps a derived artifact into a tracked container stamped as STALE.
 */
export function markStale<T>(
  artifact: T,
  canonicalSource: EngineeringDocument | CanonicalRenderData | CanonicalRevisionIdentity,
  customReason?: string
): RevisionTracked<T> {
  const provenance = captureCanonicalRevision(canonicalSource as any);
  return Object.freeze({
    status: RevisionLifecycleState.STALE,
    value: artifact,
    provenance,
    reason: customReason || `Manually marked stale against revision ${provenance.revision}`
  });
}

/**
 * Wraps a derived artifact into a tracked container stamped as INVALID.
 */
export function invalidate<T>(
  artifact: T | null,
  canonicalSource: EngineeringDocument | CanonicalRenderData | CanonicalRevisionIdentity,
  reason: string
): RevisionTracked<T> {
  const provenance = captureCanonicalRevision(canonicalSource as any);
  return Object.freeze({
    status: RevisionLifecycleState.INVALID,
    value: artifact,
    provenance,
    reason
  });
}

/**
 * Re-resolves a previously picked topological face against a newly evaluated CanonicalRenderData.
 *
 * CRITICAL CONTRACT:
 * - Uses PERSISTENT topological identity (`canonicalEntityId` / `persistentId` / lineage).
 * - NEVER uses transient triangleIndex, faceIndex, array index, or Three.js object ID.
 * - If found: constructs a NEW CanonicalPickResult carrying the new revision, new hashes, and new triangle indices.
 * - If not found: emits an INVALID result with error details.
 */
export function revalidateSelection(
  oldPick: CanonicalPickResult,
  newRenderData: CanonicalRenderData
): TopologyRevalidationResult {
  if (!oldPick) {
    return Object.freeze({
      success: false,
      status: RevisionLifecycleState.INVALID,
      resolvedPick: null,
      persistentEntityId: 'NONE',
      sourceRevision: 'NONE',
      targetRevision: newRenderData?.revision ?? 'NONE',
      error: 'No prior pick provided for revalidation'
    });
  }

  if (!newRenderData || !newRenderData.hasGeometry || !newRenderData.topologyMap) {
    return Object.freeze({
      success: false,
      status: RevisionLifecycleState.INVALID,
      resolvedPick: null,
      persistentEntityId: oldPick.canonicalEntityId,
      sourceRevision: oldPick.revision,
      targetRevision: 'UNAVAILABLE',
      error: 'New render data is unavailable or has no geometry'
    });
  }

  // Document mismatch cannot be revalidated
  if (oldPick.documentId !== newRenderData.documentId) {
    return Object.freeze({
      success: false,
      status: RevisionLifecycleState.INVALID,
      resolvedPick: null,
      persistentEntityId: oldPick.canonicalEntityId,
      sourceRevision: oldPick.revision,
      targetRevision: newRenderData.revision,
      error: `Cannot revalidate across different documents ('${oldPick.documentId}' -> '${newRenderData.documentId}')`
    });
  }

  const targetPersistentId = oldPick.persistentId || oldPick.canonicalEntityId;
  const entityType = oldPick.entityType || 'FACE';

  // --- EDGE REVALIDATION ---
  if (entityType === 'EDGE') {
    const edgeMap = newRenderData.topologyMap.edgeVertexMap;
    let matchingKey: string | null = null;
    let matchingEntry: any = null;

    if (edgeMap) {
      for (const [key, entry] of Object.entries(edgeMap)) {
        if (!entry) continue;
        if (
          key === targetPersistentId ||
          entry.persistentId === targetPersistentId ||
          entry.edgeId === oldPick.edgeId ||
          (oldPick.lineage?.persistentTag && entry.lineage?.persistentTag === oldPick.lineage.persistentTag)
        ) {
          matchingKey = key;
          matchingEntry = entry;
          break;
        }
      }
    }

    if (!matchingEntry && newRenderData.topologyMap.sharedEdges) {
      for (const shared of newRenderData.topologyMap.sharedEdges) {
        if (shared.persistentId === targetPersistentId || shared.edgeId === oldPick.edgeId) {
          matchingKey = shared.persistentId || shared.edgeId;
          matchingEntry = {
            edgeId: shared.edgeId,
            persistentId: shared.persistentId || shared.edgeId,
            vertexIndices: shared.sharedVertexIndices
          };
          break;
        }
      }
    }

    if (!matchingEntry && oldPick.canonicalEntityId && oldPick.vertexIndices && oldPick.vertexIndices.length >= 2) {
      matchingKey = oldPick.canonicalEntityId;
      matchingEntry = {
        edgeId: oldPick.edgeId || oldPick.canonicalEntityId,
        persistentId: oldPick.canonicalEntityId,
        vertexIndices: oldPick.vertexIndices
      };
    }

    if (!matchingEntry || !Array.isArray(matchingEntry.vertexIndices) || matchingEntry.vertexIndices.length < 2) {
      return Object.freeze({
        success: false,
        status: RevisionLifecycleState.INVALID,
        resolvedPick: null,
        persistentEntityId: targetPersistentId,
        sourceRevision: oldPick.revision,
        targetRevision: newRenderData.revision,
        error: `Edge persistent entity '${targetPersistentId}' could not be resolved in revision ${newRenderData.revision}`
      });
    }

    const newCanonicalEntityId = matchingEntry.persistentId || matchingEntry.edgeId || matchingKey!;
    const revalidatedPick: CanonicalPickResult = Object.freeze({
      documentId: newRenderData.documentId,
      revision: newRenderData.revision,
      brepHash: newRenderData.brepHash,
      meshHash: newRenderData.meshHash,
      entityType: 'EDGE',
      canonicalEntityId: newCanonicalEntityId,
      faceId: oldPick.faceId || 'UNKNOWN_FACE',
      edgeId: matchingEntry.edgeId || newCanonicalEntityId,
      persistentId: matchingEntry.persistentId || newCanonicalEntityId,
      triangleIndex: oldPick.triangleIndex ?? 0,
      triangleIndices: oldPick.triangleIndices ? Object.freeze([...oldPick.triangleIndices]) : Object.freeze([]),
      vertexIndices: Object.freeze([...matchingEntry.vertexIndices]),
      lineage: matchingEntry.lineage || oldPick.lineage,
      hitPoint: oldPick.hitPoint ? (Object.freeze([...oldPick.hitPoint]) as [number, number, number]) : undefined,
      distance: oldPick.distance,
      timestamp: Date.now()
    });

    return Object.freeze({
      success: true,
      status: RevisionLifecycleState.REVALIDATED,
      resolvedPick: revalidatedPick,
      persistentEntityId: newCanonicalEntityId,
      sourceRevision: oldPick.revision,
      targetRevision: newRenderData.revision
    });
  }

  // --- VERTEX REVALIDATION ---
  if (entityType === 'VERTEX') {
    const vertMap = newRenderData.topologyMap.vertexIndexMap;
    let matchingKey: string | null = null;
    let matchingEntry: any = null;

    if (vertMap) {
      for (const [key, entry] of Object.entries(vertMap)) {
        if (!entry) continue;
        if (
          key === targetPersistentId ||
          entry.persistentId === targetPersistentId ||
          entry.vertexId === oldPick.vertexId
        ) {
          matchingKey = key;
          matchingEntry = entry;
          break;
        }
      }
    }

    if (!matchingEntry && oldPick.canonicalEntityId && oldPick.vertexIndex !== undefined) {
      matchingKey = oldPick.canonicalEntityId;
      matchingEntry = {
        vertexId: oldPick.vertexId || oldPick.canonicalEntityId,
        persistentId: oldPick.canonicalEntityId,
        vertexIndex: oldPick.vertexIndex
      };
    }

    if (!matchingEntry || matchingEntry.vertexIndex === undefined) {
      return Object.freeze({
        success: false,
        status: RevisionLifecycleState.INVALID,
        resolvedPick: null,
        persistentEntityId: targetPersistentId,
        sourceRevision: oldPick.revision,
        targetRevision: newRenderData.revision,
        error: `Vertex persistent entity '${targetPersistentId}' could not be resolved in revision ${newRenderData.revision}`
      });
    }

    const newCanonicalEntityId = matchingEntry.persistentId || matchingEntry.vertexId || matchingKey!;
    const revalidatedPick: CanonicalPickResult = Object.freeze({
      documentId: newRenderData.documentId,
      revision: newRenderData.revision,
      brepHash: newRenderData.brepHash,
      meshHash: newRenderData.meshHash,
      entityType: 'VERTEX',
      canonicalEntityId: newCanonicalEntityId,
      faceId: oldPick.faceId || 'UNKNOWN_FACE',
      vertexId: matchingEntry.vertexId || newCanonicalEntityId,
      persistentId: matchingEntry.persistentId || newCanonicalEntityId,
      triangleIndex: oldPick.triangleIndex ?? 0,
      triangleIndices: oldPick.triangleIndices ? Object.freeze([...oldPick.triangleIndices]) : Object.freeze([]),
      vertexIndex: matchingEntry.vertexIndex,
      lineage: oldPick.lineage,
      hitPoint: oldPick.hitPoint ? (Object.freeze([...oldPick.hitPoint]) as [number, number, number]) : undefined,
      distance: oldPick.distance,
      timestamp: Date.now()
    });

    return Object.freeze({
      success: true,
      status: RevisionLifecycleState.REVALIDATED,
      resolvedPick: revalidatedPick,
      persistentEntityId: newCanonicalEntityId,
      sourceRevision: oldPick.revision,
      targetRevision: newRenderData.revision
    });
  }

  // --- FACE REVALIDATION ---
  const faceMap = newRenderData.topologyMap.faceTriangleMap;
  if (!faceMap) {
    return Object.freeze({
      success: false,
      status: RevisionLifecycleState.INVALID,
      resolvedPick: null,
      persistentEntityId: oldPick.canonicalEntityId,
      sourceRevision: oldPick.revision,
      targetRevision: newRenderData.revision,
      error: 'New render data topologyMap.faceTriangleMap is missing'
    });
  }

  const targetFaceId = oldPick.faceId;

  // Search for the persistent topological identity in the new faceTriangleMap
  let matchingKey: string | null = null;
  let matchingEntry: any = null;

  for (const [key, entry] of Object.entries(faceMap)) {
    if (!entry) continue;

    // Direct key or persistentId match
    if (key === targetPersistentId || entry.persistentId === targetPersistentId) {
      matchingKey = key;
      matchingEntry = entry;
      break;
    }

    // Fallback: match by faceId
    if (targetFaceId && (entry.faceId === targetFaceId || key === targetFaceId)) {
      matchingKey = key;
      matchingEntry = entry;
      break;
    }

    // Fallback: match by lineage persistent tag
    if (
      oldPick.lineage?.persistentTag &&
      (entry.persistentId === oldPick.lineage.persistentTag ||
        entry.lineage?.persistentTag === oldPick.lineage.persistentTag)
    ) {
      matchingKey = key;
      matchingEntry = entry;
      break;
    }
  }

  if (!matchingEntry || !Array.isArray(matchingEntry.triangleIndices) || matchingEntry.triangleIndices.length === 0) {
    return Object.freeze({
      success: false,
      status: RevisionLifecycleState.INVALID,
      resolvedPick: null,
      persistentEntityId: targetPersistentId,
      sourceRevision: oldPick.revision,
      targetRevision: newRenderData.revision,
      error: `Persistent entity '${targetPersistentId}' could not be resolved in revision ${newRenderData.revision}`
    });
  }

  // Construct new CanonicalPickResult bound to the NEW canonical revision
  const newCanonicalEntityId = matchingEntry.persistentId || matchingEntry.faceId || matchingKey!;
  const newPrimaryTriangleIndex = Math.floor(matchingEntry.triangleIndices[0] / 3);

  const revalidatedPick: CanonicalPickResult = Object.freeze({
    documentId: newRenderData.documentId,
    revision: newRenderData.revision,
    brepHash: newRenderData.brepHash,
    meshHash: newRenderData.meshHash,
    entityType: (oldPick.entityType || 'FACE') as CanonicalTopologyType,
    canonicalEntityId: newCanonicalEntityId,
    faceId: matchingEntry.faceId || newCanonicalEntityId,
    persistentId: matchingEntry.persistentId || newCanonicalEntityId,
    triangleIndex: newPrimaryTriangleIndex,
    triangleIndices: Object.freeze([...matchingEntry.triangleIndices]),
    lineage: matchingEntry.lineage || oldPick.lineage,
    hitPoint: oldPick.hitPoint ? Object.freeze([...oldPick.hitPoint]) as [number, number, number] : undefined,
    distance: oldPick.distance,
    timestamp: Date.now()
  });

  return Object.freeze({
    success: true,
    status: RevisionLifecycleState.REVALIDATED,
    resolvedPick: revalidatedPick,
    persistentEntityId: newCanonicalEntityId,
    sourceRevision: oldPick.revision,
    targetRevision: newRenderData.revision
  });
}

/**
 * Presentation-layer predicate determining whether an amber highlight overlay
 * is permitted to render over the viewport geometry.
 *
 * Enforces Requirement 13:
 * CURRENT -> show highlight
 * STALE -> remove/suspend highlight
 * REVALIDATED -> show new canonical highlight
 * INVALID -> remove highlight
 */
export function shouldDisplayHighlight(
  pick: CanonicalPickResult | null,
  currentRenderData: CanonicalRenderData | null
): boolean {
  if (!pick || !currentRenderData || !currentRenderData.hasGeometry) {
    return false;
  }

  const classification = classifyDerivedState(pick, currentRenderData);

  // Permitted only if strictly CURRENT with the active render data
  return classification.status === RevisionLifecycleState.CURRENT;
}
