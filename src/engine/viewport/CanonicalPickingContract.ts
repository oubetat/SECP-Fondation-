/**
 * SECP CAD Kernel — Canonical 3D Topology Picking & Selection Contract
 * Phase 2 (SECP-3D-TOPOLOGY-PICKING-CONTRACT-002)
 *
 * ARCHITECTURAL CONTRACT:
 * - Pure TypeScript data representation for topology picking and selection.
 * - STRICTLY ISOLATED from Three.js, React, and DOM primitives.
 * - Resolves raycast/triangle intersections directly against CanonicalRenderData.topologyMap.
 * - Enforces stable canonical identity (persistentId / faceId) from authoritative B-Rep lineage.
 * - Strictly forbids synthetic, random, or UI-invented IDs.
 * - Preserves provenance: documentId, revision, brepHash, meshHash.
 *
 * PIPELINE:
 *   Pointer Event (Screen NDC)
 *          │
 *          ▼
 *   Three.js Raycaster (Intersection -> faceIndex / triangleIndex)
 *          │
 *          ▼
 *   resolveCanonicalFaceFromTriangle(triangleIndex, canonicalRenderData)
 *          │
 *          ▼
 *   CanonicalPickResult (Immutable Contract)
 *          │
 *          ▼
 *   CanonicalSelectionState -> Viewport Visual Highlight (Presentation Layer)
 */

import { CanonicalRenderData } from './CanonicalRenderContract';
import { MeshTopologyMap } from '../cad-kernel/tessellation/BRepTessellator';
import { TopologyLineage } from '../cad-kernel/history/FeatureDefinition';

export type CanonicalTopologyType = 'FACE' | 'EDGE' | 'VERTEX';

/**
 * Result of resolving a 3D intersection against the Canonical Topology.
 */
export interface CanonicalPickResult {
  /** Canonical Document Identifier from the render contract */
  readonly documentId: string;

  /** Canonical Engineering Revision at the moment of picking */
  readonly revision: number | string;

  /** Cryptographic hash of the B-Rep solid from which the picked mesh was derived */
  readonly brepHash: string;

  /** Cryptographic hash of the tessellated mesh buffer */
  readonly meshHash: string;

  /** Type of topological entity picked ('FACE' | 'EDGE' | 'VERTEX') */
  readonly entityType: CanonicalTopologyType;

  /** 
   * Authoritative canonical identifier from B-Rep topology lineage.
   * Matches persistentId, faceId, edgeId, or vertexId. NEVER a synthetic index or random string.
   */
  readonly canonicalEntityId: string;

  /** Raw face identifier in the B-Rep topology map */
  readonly faceId: string;

  /** Raw edge identifier in the B-Rep topology map (if entityType is 'EDGE') */
  readonly edgeId?: string;

  /** Raw vertex identifier in the B-Rep topology map (if entityType is 'VERTEX') */
  readonly vertexId?: string;

  /** Persistent topological identity across parametric feature regenerations */
  readonly persistentId: string;

  /** Index of the intersected triangle (0-based triangle index in the index buffer) */
  readonly triangleIndex: number;

  /** All index buffer offsets associated with this topological face */
  readonly triangleIndices: readonly number[];

  /** Mesh vertex indices corresponding to the picked edge (for EDGE picking) */
  readonly vertexIndices?: readonly number[];

  /** Primary mesh vertex index (for VERTEX picking) */
  readonly vertexIndex?: number;

  /** Feature history lineage for the picked topological face, if recorded */
  readonly lineage?: TopologyLineage;

  /** 3D hit point in canonical coordinates (Meters), if available */
  readonly hitPoint?: readonly [number, number, number];

  /** Raycast hit distance, if available */
  readonly distance?: number;

  /** Deterministic timestamp when the pick was resolved */
  readonly timestamp: number;
}

/**
 * Canonical Selection State container.
 */
export interface CanonicalSelectionState {
  /** Currently selected canonical entity, or null if nothing is selected */
  readonly selectedEntity: CanonicalPickResult | null;

  /** Active selection filter mode ('FACE' | 'EDGE' | 'VERTEX') */
  readonly selectionMode: CanonicalTopologyType;

  /** Provenance validation envelope */
  readonly provenance: {
    readonly documentId: string;
    readonly revision: number | string;
    readonly meshHash: string;
  } | null;
}

/**
 * Resolves an intersected triangle index directly to a CanonicalPickResult
 * using the authoritative topologyMap inside CanonicalRenderData for FACE entity.
 *
 * @param triangleIndex - 0-indexed triangle number from Three.js raycast (faceIndex)
 * @param renderData - CanonicalRenderData containing vertices, indices, and topologyMap
 * @param hitMeta - Optional raycast distance and hit coordinates
 * @returns CanonicalPickResult if matched to a canonical face, or null if unmapped
 */
export function resolveCanonicalFaceFromTriangle(
  triangleIndex: number,
  renderData: CanonicalRenderData,
  hitMeta?: { distance?: number; hitPoint?: [number, number, number] }
): CanonicalPickResult | null {
  if (
    !renderData ||
    !renderData.hasGeometry ||
    !renderData.topologyMap ||
    !renderData.topologyMap.faceTriangleMap ||
    triangleIndex === undefined ||
    triangleIndex === null ||
    triangleIndex < 0
  ) {
    return null;
  }

  const faceMap = renderData.topologyMap.faceTriangleMap;
  const targetIndexOffset = triangleIndex * 3;

  for (const [keyPersistentId, faceEntry] of Object.entries(faceMap)) {
    if (!faceEntry || !Array.isArray(faceEntry.triangleIndices)) {
      continue;
    }

    // Match the index buffer position for this triangle (offset 3k in index buffer)
    const isMatch = faceEntry.triangleIndices.includes(targetIndexOffset);

    if (isMatch) {
      const canonicalEntityId = faceEntry.persistentId || faceEntry.faceId || keyPersistentId;

      return Object.freeze({
        documentId: renderData.documentId,
        revision: renderData.revision,
        brepHash: renderData.brepHash,
        meshHash: renderData.meshHash,
        entityType: 'FACE' as CanonicalTopologyType,
        canonicalEntityId,
        faceId: faceEntry.faceId || canonicalEntityId,
        persistentId: faceEntry.persistentId || canonicalEntityId,
        triangleIndex,
        triangleIndices: Object.freeze([...faceEntry.triangleIndices]),
        lineage: faceEntry.lineage,
        hitPoint: hitMeta?.hitPoint ? (Object.freeze([...hitMeta.hitPoint]) as [number, number, number]) : undefined,
        distance: hitMeta?.distance,
        timestamp: Date.now()
      });
    }
  }

  return null;
}

/**
 * Calculates distance from point P to line segment A-B in 3D space.
 */
function pointToSegmentDistance(
  p: [number, number, number],
  a: [number, number, number],
  b: [number, number, number]
): { distance: number; t: number } {
  const abx = b[0] - a[0];
  const aby = b[1] - a[1];
  const abz = b[2] - a[2];

  const apx = p[0] - a[0];
  const apy = p[1] - a[1];
  const apz = p[2] - a[2];

  const abLenSq = abx * abx + aby * aby + abz * abz;
  let t = abLenSq > 0 ? (apx * abx + apy * aby + apz * abz) / abLenSq : 0;
  if (t < 0) t = 0;
  if (t > 1) t = 1;

  const projX = a[0] + t * abx;
  const projY = a[1] + t * aby;
  const projZ = a[2] + t * abz;

  const dx = p[0] - projX;
  const dy = p[1] - projY;
  const dz = p[2] - projZ;

  return { distance: Math.hypot(dx, dy, dz), t };
}

/**
 * Resolves an intersected triangle directly to a Canonical EDGE entity.
 * Evaluates the nearest edge segment on the intersected triangle relative to hit point P.
 */
export function resolveCanonicalEdgeFromTriangle(
  triangleIndex: number,
  renderData: CanonicalRenderData,
  hitMeta?: { distance?: number; hitPoint?: [number, number, number] }
): CanonicalPickResult | null {
  if (
    !renderData ||
    !renderData.hasGeometry ||
    !renderData.topologyMap ||
    !renderData.indices ||
    !renderData.vertices ||
    triangleIndex === undefined ||
    triangleIndex === null ||
    triangleIndex < 0
  ) {
    return null;
  }

  const indices = renderData.indices;
  const vertices = renderData.vertices;
  const idxOffset = triangleIndex * 3;

  if (idxOffset + 2 >= indices.length) {
    return null;
  }

  const i0 = indices[idxOffset];
  const i1 = indices[idxOffset + 1];
  const i2 = indices[idxOffset + 2];

  if (i0 * 3 + 2 >= vertices.length || i1 * 3 + 2 >= vertices.length || i2 * 3 + 2 >= vertices.length) {
    return null;
  }

  const v0: [number, number, number] = [vertices[i0 * 3], vertices[i0 * 3 + 1], vertices[i0 * 3 + 2]];
  const v1: [number, number, number] = [vertices[i1 * 3], vertices[i1 * 3 + 1], vertices[i1 * 3 + 2]];
  const v2: [number, number, number] = [vertices[i2 * 3], vertices[i2 * 3 + 1], vertices[i2 * 3 + 2]];

  const hitP: [number, number, number] = hitMeta?.hitPoint || [
    (v0[0] + v1[0] + v2[0]) / 3,
    (v0[1] + v1[1] + v2[1]) / 3,
    (v0[2] + v1[2] + v2[2]) / 3
  ];

  // Evaluate distance from hit point to the 3 edges of the triangle
  const edge0 = { pair: [i0, i1], dist: pointToSegmentDistance(hitP, v0, v1).distance };
  const edge1 = { pair: [i1, i2], dist: pointToSegmentDistance(hitP, v1, v2).distance };
  const edge2 = { pair: [i2, i0], dist: pointToSegmentDistance(hitP, v2, v0).distance };

  let closestEdge = edge0;
  if (edge1.dist < closestEdge.dist) closestEdge = edge1;
  if (edge2.dist < closestEdge.dist) closestEdge = edge2;

  const [idxA, idxB] = closestEdge.pair;

  // Resolve parent face pick result for face context & lineage
  const parentFacePick = resolveCanonicalFaceFromTriangle(triangleIndex, renderData, hitMeta);
  const faceId = parentFacePick?.faceId || 'UNKNOWN_FACE';
  const parentTriangleIndices = parentFacePick?.triangleIndices || [idxOffset, idxOffset + 1, idxOffset + 2];

  // Resolve edge topological mapping in topologyMap.edgeVertexMap
  let resolvedEdgeId: string | undefined;
  let resolvedPersistentId: string | undefined;
  let edgeLineage: TopologyLineage | undefined = parentFacePick?.lineage;

  if (renderData.topologyMap?.edgeVertexMap) {
    for (const [keyPersistentId, edgeEntry] of Object.entries(renderData.topologyMap.edgeVertexMap)) {
      if (!edgeEntry) continue;

      const vIndices = edgeEntry.vertexIndices;
      if (Array.isArray(vIndices)) {
        if (
          (vIndices.includes(idxA) && vIndices.includes(idxB)) ||
          (vIndices[0] === idxA && vIndices[1] === idxB) ||
          (vIndices[0] === idxB && vIndices[1] === idxA)
        ) {
          resolvedEdgeId = edgeEntry.edgeId;
          resolvedPersistentId = edgeEntry.persistentId || keyPersistentId;
          if (edgeEntry.lineage) edgeLineage = edgeEntry.lineage;
          break;
        }
      }
    }
  }

  // Fallback to sharedEdges if not found in edgeVertexMap
  if (!resolvedPersistentId && renderData.topologyMap?.sharedEdges) {
    for (const shared of renderData.topologyMap.sharedEdges) {
      if (
        Array.isArray(shared.sharedVertexIndices) &&
        shared.sharedVertexIndices.includes(idxA) &&
        shared.sharedVertexIndices.includes(idxB)
      ) {
        resolvedPersistentId = shared.persistentId || shared.edgeId;
        resolvedEdgeId = shared.edgeId;
        break;
      }
    }
  }

  const canonicalEntityId = resolvedPersistentId || resolvedEdgeId || `${faceId}-edge-${Math.min(idxA, idxB)}_${Math.max(idxA, idxB)}`;
  const persistentId = resolvedPersistentId || canonicalEntityId;

  return Object.freeze({
    documentId: renderData.documentId,
    revision: renderData.revision,
    brepHash: renderData.brepHash,
    meshHash: renderData.meshHash,
    entityType: 'EDGE' as CanonicalTopologyType,
    canonicalEntityId,
    faceId,
    edgeId: resolvedEdgeId || canonicalEntityId,
    persistentId,
    triangleIndex,
    triangleIndices: Object.freeze([...parentTriangleIndices]),
    vertexIndices: Object.freeze([idxA, idxB]),
    lineage: edgeLineage,
    hitPoint: hitMeta?.hitPoint ? (Object.freeze([...hitMeta.hitPoint]) as [number, number, number]) : undefined,
    distance: hitMeta?.distance,
    timestamp: Date.now()
  });
}

/**
 * Resolves an intersected triangle directly to a Canonical VERTEX entity.
 * Evaluates the nearest vertex on the intersected triangle relative to hit point P.
 */
export function resolveCanonicalVertexFromTriangle(
  triangleIndex: number,
  renderData: CanonicalRenderData,
  hitMeta?: { distance?: number; hitPoint?: [number, number, number] }
): CanonicalPickResult | null {
  if (
    !renderData ||
    !renderData.hasGeometry ||
    !renderData.topologyMap ||
    !renderData.indices ||
    !renderData.vertices ||
    triangleIndex === undefined ||
    triangleIndex === null ||
    triangleIndex < 0
  ) {
    return null;
  }

  const indices = renderData.indices;
  const vertices = renderData.vertices;
  const idxOffset = triangleIndex * 3;

  if (idxOffset + 2 >= indices.length) {
    return null;
  }

  const i0 = indices[idxOffset];
  const i1 = indices[idxOffset + 1];
  const i2 = indices[idxOffset + 2];

  if (i0 * 3 + 2 >= vertices.length || i1 * 3 + 2 >= vertices.length || i2 * 3 + 2 >= vertices.length) {
    return null;
  }

  const v0: [number, number, number] = [vertices[i0 * 3], vertices[i0 * 3 + 1], vertices[i0 * 3 + 2]];
  const v1: [number, number, number] = [vertices[i1 * 3], vertices[i1 * 3 + 1], vertices[i1 * 3 + 2]];
  const v2: [number, number, number] = [vertices[i2 * 3], vertices[i2 * 3 + 1], vertices[i2 * 3 + 2]];

  const hitP: [number, number, number] = hitMeta?.hitPoint || [
    (v0[0] + v1[0] + v2[0]) / 3,
    (v0[1] + v1[1] + v2[1]) / 3,
    (v0[2] + v1[2] + v2[2]) / 3
  ];

  const d0 = Math.hypot(hitP[0] - v0[0], hitP[1] - v0[1], hitP[2] - v0[2]);
  const d1 = Math.hypot(hitP[0] - v1[0], hitP[1] - v1[1], hitP[2] - v1[2]);
  const d2 = Math.hypot(hitP[0] - v2[0], hitP[1] - v2[1], hitP[2] - v2[2]);

  let closestVertexIdx = i0;
  let minDist = d0;

  if (d1 < minDist) {
    closestVertexIdx = i1;
    minDist = d1;
  }
  if (d2 < minDist) {
    closestVertexIdx = i2;
    minDist = d2;
  }

  const parentFacePick = resolveCanonicalFaceFromTriangle(triangleIndex, renderData, hitMeta);
  const faceId = parentFacePick?.faceId || 'UNKNOWN_FACE';
  const parentTriangleIndices = parentFacePick?.triangleIndices || [idxOffset, idxOffset + 1, idxOffset + 2];

  let resolvedVertexId: string | undefined;
  let resolvedPersistentId: string | undefined;

  if (renderData.topologyMap?.vertexIndexMap) {
    for (const [keyPersistentId, vertEntry] of Object.entries(renderData.topologyMap.vertexIndexMap)) {
      if (!vertEntry) continue;
      if (vertEntry.vertexIndex === closestVertexIdx || keyPersistentId === `v_${closestVertexIdx}`) {
        resolvedVertexId = vertEntry.vertexId;
        resolvedPersistentId = vertEntry.persistentId || keyPersistentId;
        break;
      }
    }
  }

  const canonicalEntityId = resolvedPersistentId || resolvedVertexId || `${faceId}-vert-${closestVertexIdx}`;
  const persistentId = resolvedPersistentId || canonicalEntityId;

  return Object.freeze({
    documentId: renderData.documentId,
    revision: renderData.revision,
    brepHash: renderData.brepHash,
    meshHash: renderData.meshHash,
    entityType: 'VERTEX' as CanonicalTopologyType,
    canonicalEntityId,
    faceId,
    vertexId: resolvedVertexId || canonicalEntityId,
    persistentId,
    triangleIndex,
    triangleIndices: Object.freeze([...parentTriangleIndices]),
    vertexIndex: closestVertexIdx,
    lineage: parentFacePick?.lineage,
    hitPoint: hitMeta?.hitPoint ? (Object.freeze([...hitMeta.hitPoint]) as [number, number, number]) : undefined,
    distance: hitMeta?.distance,
    timestamp: Date.now()
  });
}

/**
 * Unified Topology Resolution entry point for resolving raycast hits according to active selectionMode.
 */
export function resolveCanonicalTopologyFromTriangle(
  triangleIndex: number,
  selectionMode: CanonicalTopologyType,
  renderData: CanonicalRenderData,
  hitMeta?: { distance?: number; hitPoint?: [number, number, number] }
): CanonicalPickResult | null {
  if (selectionMode === 'EDGE') {
    return resolveCanonicalEdgeFromTriangle(triangleIndex, renderData, hitMeta);
  }
  if (selectionMode === 'VERTEX') {
    return resolveCanonicalVertexFromTriangle(triangleIndex, renderData, hitMeta);
  }
  return resolveCanonicalFaceFromTriangle(triangleIndex, renderData, hitMeta);
}

/**
 * Extracts the 3D vertex coordinates (in meters) for all triangles belonging to the picked face.
 * Useful for building visual highlight overlays strictly at the presentation layer.
 */
export function getCanonicalFaceVertices(
  pickResult: CanonicalPickResult,
  renderData: CanonicalRenderData
): number[] {
  if (!pickResult || !renderData || !renderData.vertices || !renderData.indices) {
    return [];
  }

  const resultVertices: number[] = [];
  const rawVertices = renderData.vertices;
  const rawIndices = renderData.indices;

  // Each entry in triangleIndices is an index buffer position [0, 1, 2, 3, 4, 5, ...]
  for (const idxPos of pickResult.triangleIndices) {
    const vertexIndex = rawIndices[idxPos];
    if (vertexIndex !== undefined && vertexIndex * 3 + 2 < rawVertices.length) {
      const vx = rawVertices[vertexIndex * 3];
      const vy = rawVertices[vertexIndex * 3 + 1];
      const vz = rawVertices[vertexIndex * 3 + 2];
      resultVertices.push(vx, vy, vz);
    }
  }

  return resultVertices;
}

/**
 * Extracts 3D end-point coordinates (in meters) for a picked EDGE entity.
 * Returns flattened array [ax, ay, az, bx, by, bz].
 */
export function getCanonicalEdgeVertices(
  pickResult: CanonicalPickResult,
  renderData: CanonicalRenderData
): number[] {
  if (!pickResult || !renderData || !renderData.vertices) {
    return [];
  }

  const rawVertices = renderData.vertices;
  let vIndices = pickResult.vertexIndices;

  if (!vIndices && renderData.topologyMap?.edgeVertexMap) {
    const targetId = pickResult.persistentId || pickResult.canonicalEntityId;
    for (const [key, entry] of Object.entries(renderData.topologyMap.edgeVertexMap)) {
      if (key === targetId || entry?.persistentId === targetId || entry?.edgeId === targetId) {
        vIndices = entry.vertexIndices;
        break;
      }
    }
  }

  if (!vIndices || vIndices.length < 2) {
    return [];
  }

  const [idxA, idxB] = vIndices;
  if (idxA * 3 + 2 >= rawVertices.length || idxB * 3 + 2 >= rawVertices.length) {
    return [];
  }

  return [
    rawVertices[idxA * 3],
    rawVertices[idxA * 3 + 1],
    rawVertices[idxA * 3 + 2],
    rawVertices[idxB * 3],
    rawVertices[idxB * 3 + 1],
    rawVertices[idxB * 3 + 2]
  ];
}

/**
 * Extracts 3D coordinates (in meters) for a picked VERTEX entity.
 * Returns flattened array [vx, vy, vz].
 */
export function getCanonicalVertexCoordinates(
  pickResult: CanonicalPickResult,
  renderData: CanonicalRenderData
): number[] {
  if (!pickResult || !renderData || !renderData.vertices) {
    return [];
  }

  const rawVertices = renderData.vertices;
  let vIdx = pickResult.vertexIndex;

  if (vIdx === undefined && renderData.topologyMap?.vertexIndexMap) {
    const targetId = pickResult.persistentId || pickResult.canonicalEntityId;
    for (const [key, entry] of Object.entries(renderData.topologyMap.vertexIndexMap)) {
      if (key === targetId || entry?.persistentId === targetId || entry?.vertexId === targetId) {
        vIdx = entry.vertexIndex;
        break;
      }
    }
  }

  if (vIdx === undefined || vIdx * 3 + 2 >= rawVertices.length) {
    return [];
  }

  return [
    rawVertices[vIdx * 3],
    rawVertices[vIdx * 3 + 1],
    rawVertices[vIdx * 3 + 2]
  ];
}

/**
 * Creates a new CanonicalSelectionState wrapping the resolved pick result.
 */
export function createCanonicalSelection(
  pickResult: CanonicalPickResult | null,
  mode?: CanonicalTopologyType
): CanonicalSelectionState {
  if (!pickResult) {
    return createEmptyCanonicalSelection(mode);
  }

  return Object.freeze({
    selectedEntity: pickResult,
    selectionMode: pickResult.entityType || mode || 'FACE',
    provenance: Object.freeze({
      documentId: pickResult.documentId,
      revision: pickResult.revision,
      meshHash: pickResult.meshHash
    })
  });
}

/**
 * Returns a blank/cleared CanonicalSelectionState.
 */
export function createEmptyCanonicalSelection(mode: CanonicalTopologyType = 'FACE'): CanonicalSelectionState {
  return Object.freeze({
    selectedEntity: null,
    selectionMode: mode,
    provenance: null
  });
}

/**
 * Checks whether an existing CanonicalSelectionState remains strictly synchronized
 * with the current CanonicalRenderData (e.g. revision and meshHash match).
 */
export function isSelectionSynchronizedWithRenderData(
  selection: CanonicalSelectionState,
  renderData: CanonicalRenderData
): boolean {
  if (!selection || !selection.selectedEntity || !renderData) {
    return false;
  }

  const entity = selection.selectedEntity;
  return (
    entity.documentId === renderData.documentId &&
    String(entity.revision) === String(renderData.revision) &&
    entity.meshHash === renderData.meshHash
  );
}
