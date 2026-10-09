/**
 * SECP CAD Kernel — Canonical 3D Topology Picking & Selection Contract Tests
 * Phase 2 (SECP-3D-TOPOLOGY-PICKING-CONTRACT-002)
 *
 * VALIDATES:
 * 1. Resolution of Three.js raycast triangleIndex to authoritative Canonical Face Identity.
 * 2. Strict provenance validation: documentId, revision, brepHash, meshHash.
 * 3. Prevention of synthetic/random IDs.
 * 4. Presentation highlight geometry conversion (zero kernel mutation, zero re-tessellation).
 * 5. Revision synchronization validation.
 * 6. Robustness against missing or corrupted topology maps.
 */

import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import {
  createCanonicalRenderData,
  CanonicalRenderData
} from '../CanonicalRenderContract';
import {
  resolveCanonicalFaceFromTriangle,
  resolveCanonicalEdgeFromTriangle,
  resolveCanonicalVertexFromTriangle,
  resolveCanonicalTopologyFromTriangle,
  getCanonicalFaceVertices,
  getCanonicalEdgeVertices,
  getCanonicalVertexCoordinates,
  createCanonicalSelection,
  createEmptyCanonicalSelection,
  isSelectionSynchronizedWithRenderData,
  CanonicalPickResult
} from '../CanonicalPickingContract';
import {
  convertRenderDataToThreeBufferGeometry,
  convertCanonicalFaceToHighlightGeometry,
  convertCanonicalEdgeToHighlightGeometry,
  convertCanonicalVertexToHighlightGeometry,
  convertCanonicalPickToHighlightGeometry
} from '../ThreeGeometryConverter';
import { revalidateSelection, RevisionLifecycleState } from '../RevisionLifecycle';
import { BRepTessellator } from '../../cad-kernel/tessellation/BRepTessellator';
import { SketchUIIntegration } from '../../cad-kernel/ui-integration/SketchUIIntegration';
import { DocumentEvaluator } from '../../cad-kernel/document/DocumentEvaluator';

describe('SECP-3D-TOPOLOGY-PICKING-CONTRACT-002: Canonical 3D Topology Picking & Selection', () => {
  // Setup a real evaluated B-Rep document with genuine topological faces
  function createTestEvaluatedDoc() {
    const { document } = SketchUIIntegration.createPrimitiveDocument('BOX', 'DOC_PICK_TEST_001');
    const evalResult = DocumentEvaluator.evaluate(document, { generateMesh: true });
    expect(evalResult.success).toBe(true);
    expect(evalResult.document.derived?.mesh).toBeDefined();
    return evalResult.document;
  }

  it('1. Resolves raycast triangleIndex directly to canonical Face persistentId and faceId', () => {
    const doc = createTestEvaluatedDoc();
    const renderData = createCanonicalRenderData(doc);

    expect(renderData.hasGeometry).toBe(true);
    expect(renderData.topologyMap).toBeDefined();
    expect(renderData.topologyMap!.faceTriangleMap).toBeDefined();

    // Pick triangle 0 (first triangle of first face)
    const pickResult = resolveCanonicalFaceFromTriangle(0, renderData, {
      distance: 125.4,
      hitPoint: [0.1, 0.2, 0.3]
    });

    expect(pickResult).not.toBeNull();
    expect(pickResult!.documentId).toBe(doc.documentId);
    expect(pickResult!.revision).toBe(doc.revision);
    expect(pickResult!.brepHash).toBe(renderData.brepHash);
    expect(pickResult!.meshHash).toBe(renderData.meshHash);
    expect(pickResult!.entityType).toBe('FACE');
    expect(pickResult!.canonicalEntityId).toBeDefined();
    expect(typeof pickResult!.canonicalEntityId).toBe('string');
    expect(pickResult!.canonicalEntityId.length).toBeGreaterThan(0);
    expect(pickResult!.triangleIndex).toBe(0);
    expect(pickResult!.triangleIndices.length).toBeGreaterThan(0);
    expect(pickResult!.distance).toBe(125.4);
    expect(pickResult!.hitPoint).toEqual([0.1, 0.2, 0.3]);
  });

  it('2. Enforces non-synthetic, deterministic canonical identity matching B-Rep lineage', () => {
    const doc = createTestEvaluatedDoc();
    const renderData = createCanonicalRenderData(doc);
    const faceMap = renderData.topologyMap!.faceTriangleMap;

    // Verify all faces mapped in topologyMap resolve deterministically to their persistentIds
    for (const [persistentId, entry] of Object.entries(faceMap)) {
      if (entry && entry.triangleIndices && entry.triangleIndices.length > 0) {
        const firstIndexOffset = entry.triangleIndices[0];
        const triangleIndex = Math.floor(firstIndexOffset / 3);

        const pick = resolveCanonicalFaceFromTriangle(triangleIndex, renderData);
        expect(pick).not.toBeNull();
        expect(pick!.canonicalEntityId).toBe(persistentId);
        expect(pick!.faceId).toBe(entry.faceId);
        expect(pick!.canonicalEntityId).not.toMatch(/^face-\d+$/); // No synthetic format
        expect(pick!.canonicalEntityId).not.toMatch(/^mock-/);
      }
    }
  });

  it('3. Rejects unmapped or out-of-bounds triangle indices cleanly', () => {
    const doc = createTestEvaluatedDoc();
    const renderData = createCanonicalRenderData(doc);

    expect(resolveCanonicalFaceFromTriangle(-1, renderData)).toBeNull();
    expect(resolveCanonicalFaceFromTriangle(999999, renderData)).toBeNull();
    expect(resolveCanonicalFaceFromTriangle(null as any, renderData)).toBeNull();
    expect(resolveCanonicalFaceFromTriangle(undefined as any, renderData)).toBeNull();
  });

  it('4. Zero Re-tessellation Rule: Picking does NOT invoke BRepTessellator.tessellate()', () => {
    const doc = createTestEvaluatedDoc();
    const renderData = createCanonicalRenderData(doc);

    const tessellateSpy = vi.spyOn(BRepTessellator, 'tessellate');

    // Perform multiple picks
    const pick1 = resolveCanonicalFaceFromTriangle(0, renderData);
    const pick2 = resolveCanonicalFaceFromTriangle(1, renderData);
    const pick3 = resolveCanonicalFaceFromTriangle(2, renderData);

    expect(pick1).not.toBeNull();
    expect(pick2).not.toBeNull();
    expect(pick3).not.toBeNull();

    // Absolutely zero tessellation calls during picking operations
    expect(tessellateSpy).not.toHaveBeenCalled();
    tessellateSpy.mockRestore();
  });

  it('5. Creates immutable CanonicalSelectionState with provenance verification', () => {
    const doc = createTestEvaluatedDoc();
    const renderData = createCanonicalRenderData(doc);
    const pickResult = resolveCanonicalFaceFromTriangle(0, renderData)!;

    const selection = createCanonicalSelection(pickResult);
    expect(selection.selectedEntity).toBe(pickResult);
    expect(selection.selectionMode).toBe('FACE');
    expect(selection.provenance?.documentId).toBe(doc.documentId);
    expect(selection.provenance?.revision).toBe(doc.revision);
    expect(selection.provenance?.meshHash).toBe(renderData.meshHash);

    // Synchronized check
    expect(isSelectionSynchronizedWithRenderData(selection, renderData)).toBe(true);

    // Mismatched render data (e.g. revision incremented or different mesh)
    const staleRenderData: CanonicalRenderData = {
      ...renderData,
      revision: (doc.revision as number) + 1,
      meshHash: 'STALE_HASH_999'
    };
    expect(isSelectionSynchronizedWithRenderData(selection, staleRenderData)).toBe(false);

    // Empty selection
    const emptySel = createEmptyCanonicalSelection();
    expect(emptySel.selectedEntity).toBeNull();
    expect(isSelectionSynchronizedWithRenderData(emptySel, renderData)).toBe(false);
  });

  it('6. Extracts presentation highlight geometry cleanly without mutating base geometry or kernel', () => {
    const doc = createTestEvaluatedDoc();
    const renderData = createCanonicalRenderData(doc);
    const baseThreeGeom = convertRenderDataToThreeBufferGeometry(renderData, { unitScaleMultiplier: 1000 });

    const pickResult = resolveCanonicalFaceFromTriangle(0, renderData)!;
    const highlightGeom = convertCanonicalFaceToHighlightGeometry(pickResult, renderData, { unitScaleMultiplier: 1000 });

    expect(highlightGeom).toBeInstanceOf(THREE.BufferGeometry);
    const posAttr = highlightGeom.getAttribute('position');
    expect(posAttr).toBeDefined();
    expect(posAttr.count).toBeGreaterThan(0);

    // Highlight geometry has exact face provenance in userData
    expect(highlightGeom.userData.canonicalEntityId).toBe(pickResult.canonicalEntityId);
    expect(highlightGeom.userData.entityType).toBe('FACE');
    expect(highlightGeom.userData.documentId).toBe(renderData.documentId);
    expect(highlightGeom.userData.revision).toBe(renderData.revision);

    // Base geometry remains completely intact and unmodified
    expect(baseThreeGeom.getAttribute('position').count).toBeGreaterThan(posAttr.count);
    expect(baseThreeGeom.userData.documentId).toBe(renderData.documentId);
  });

  it('7. Handles degraded or empty render data defensively without throwing', () => {
    const emptyRenderData: CanonicalRenderData = {
      documentId: 'DOC_EMPTY',
      revision: 0,
      brepHash: 'EMPTY',
      meshHash: 'EMPTY',
      units: 'm',
      vertices: [],
      normals: [],
      indices: [],
      hasGeometry: false,
      facesCount: 0
    };

    expect(resolveCanonicalFaceFromTriangle(0, emptyRenderData)).toBeNull();
    expect(getCanonicalFaceVertices(null as any, emptyRenderData)).toEqual([]);
    
    const dummyPick: CanonicalPickResult = {
      documentId: 'DOC_EMPTY',
      revision: 0,
      brepHash: 'EMPTY',
      meshHash: 'EMPTY',
      entityType: 'FACE',
      canonicalEntityId: 'NON_EXISTENT',
      faceId: 'NON_EXISTENT',
      persistentId: 'NON_EXISTENT',
      triangleIndex: 0,
      triangleIndices: [0, 1, 2],
      timestamp: Date.now()
    };

    const emptyHighlightGeom = convertCanonicalFaceToHighlightGeometry(dummyPick, emptyRenderData);
    expect(emptyHighlightGeom.getAttribute('position')).toBeUndefined();
  });

  it('8. End-to-end Three.js Raycaster integration resolves faceIndex to Canonical Face', () => {
    const doc = createTestEvaluatedDoc();
    const renderData = createCanonicalRenderData(doc);
    const threeGeom = convertRenderDataToThreeBufferGeometry(renderData, { unitScaleMultiplier: 1000 });
    const mesh = new THREE.Mesh(threeGeom, new THREE.MeshBasicMaterial());

    // Setup a Raycaster pointing directly at the mesh center from front (+Z)
    const raycaster = new THREE.Raycaster(
      new THREE.Vector3(125, 75, 500), // In front of box (mm)
      new THREE.Vector3(0, 0, -1)      // Pointing towards -Z
    );

    const intersects = raycaster.intersectObject(mesh, false);
    expect(intersects.length).toBeGreaterThan(0);

    const hit = intersects[0];
    expect(hit.faceIndex).toBeDefined();
    expect(hit.faceIndex).toBeGreaterThanOrEqual(0);

    // Resolve hit.faceIndex via CanonicalPickingContract
    const pickResult = resolveCanonicalFaceFromTriangle(hit.faceIndex!, renderData, {
      distance: hit.distance,
      hitPoint: [hit.point.x / 1000, hit.point.y / 1000, hit.point.z / 1000]
    });

    expect(pickResult).not.toBeNull();
    expect(pickResult!.documentId).toBe(doc.documentId);
    expect(pickResult!.canonicalEntityId).toBeDefined();
    expect(pickResult!.entityType).toBe('FACE');
    expect(pickResult!.triangleIndex).toBe(hit.faceIndex);
  });

  it('9. Preserves Feature History Lineage in CanonicalPickResult', () => {
    const doc = createTestEvaluatedDoc();
    const renderData = createCanonicalRenderData(doc);

    // Extrude features attach lineage to faces
    const faceMap = renderData.topologyMap!.faceTriangleMap;
    let foundLineage = false;

    for (const [, entry] of Object.entries(faceMap)) {
      if (entry && entry.lineage) {
        foundLineage = true;
        const triangleIndex = Math.floor(entry.triangleIndices[0] / 3);
        const pick = resolveCanonicalFaceFromTriangle(triangleIndex, renderData);
        expect(pick).not.toBeNull();
        expect(pick!.lineage).toBeDefined();
        expect(pick!.lineage?.featureId).toBe(entry.lineage.featureId);
      }
    }

    expect(foundLineage).toBe(true);
  });

  it('10. Multi-face and multi-triangle validation across all 6 faces of box B-Rep', () => {
    const doc = createTestEvaluatedDoc();
    const renderData = createCanonicalRenderData(doc);
    const faceMap = renderData.topologyMap!.faceTriangleMap;

    const resolvedFaceIds = new Set<string>();

    for (const [persistentId, entry] of Object.entries(faceMap)) {
      expect(entry.triangleIndices.length).toBeGreaterThanOrEqual(6); // At least 2 triangles (6 indices) per quad face

      // Check EVERY triangle of this face
      for (let i = 0; i < entry.triangleIndices.length; i += 3) {
        const triOffset = entry.triangleIndices[i];
        const triangleIndex = Math.floor(triOffset / 3);

        const pick = resolveCanonicalFaceFromTriangle(triangleIndex, renderData);
        expect(pick).not.toBeNull();
        expect(pick!.canonicalEntityId).toBe(persistentId);
        expect(pick!.faceId).toBe(entry.faceId);
        resolvedFaceIds.add(pick!.canonicalEntityId);
      }
    }

    // Box has exactly 6 distinct faces (CapStart, CapEnd, Side0, Side1, Side2, Side3)
    expect(resolvedFaceIds.size).toBe(6);
  });

  it('11. Resolves raycast triangle hit to persistent EDGE identity based on nearest edge segment', () => {
    const doc = createTestEvaluatedDoc();
    const renderData = createCanonicalRenderData(doc);

    expect(renderData.topologyMap).toBeDefined();

    // Pick triangle 0 with EDGE filter
    const edgePick = resolveCanonicalEdgeFromTriangle(0, renderData, {
      distance: 100,
      hitPoint: [0, 0, 0]
    });

    expect(edgePick).not.toBeNull();
    expect(edgePick!.documentId).toBe(doc.documentId);
    expect(edgePick!.revision).toBe(doc.revision);
    expect(edgePick!.brepHash).toBe(renderData.brepHash);
    expect(edgePick!.meshHash).toBe(renderData.meshHash);
    expect(edgePick!.entityType).toBe('EDGE');
    expect(edgePick!.canonicalEntityId).toBeDefined();
    expect(edgePick!.edgeId).toBeDefined();
    expect(edgePick!.vertexIndices).toBeDefined();
    expect(edgePick!.vertexIndices!.length).toBeGreaterThanOrEqual(2);

    const edgeVerts = getCanonicalEdgeVertices(edgePick!, renderData);
    expect(edgeVerts.length).toBeGreaterThanOrEqual(6); // At least 2 3D points (6 numbers)
  });

  it('12. Resolves raycast triangle hit to persistent VERTEX identity based on nearest vertex point', () => {
    const doc = createTestEvaluatedDoc();
    const renderData = createCanonicalRenderData(doc);

    const vertexPick = resolveCanonicalVertexFromTriangle(0, renderData, {
      distance: 100,
      hitPoint: [0, 0, 0]
    });

    expect(vertexPick).not.toBeNull();
    expect(vertexPick!.documentId).toBe(doc.documentId);
    expect(vertexPick!.revision).toBe(doc.revision);
    expect(vertexPick!.brepHash).toBe(renderData.brepHash);
    expect(vertexPick!.meshHash).toBe(renderData.meshHash);
    expect(vertexPick!.entityType).toBe('VERTEX');
    expect(vertexPick!.canonicalEntityId).toBeDefined();
    expect(vertexPick!.vertexId).toBeDefined();
    expect(vertexPick!.vertexIndex).toBeDefined();
    expect(typeof vertexPick!.vertexIndex).toBe('number');

    const vertCoords = getCanonicalVertexCoordinates(vertexPick!, renderData);
    expect(vertCoords.length).toBe(3); // Exact [x, y, z] in canonical meters
  });

  it('13. resolveCanonicalTopologyFromTriangle dispatches correctly according to requested mode', () => {
    const doc = createTestEvaluatedDoc();
    const renderData = createCanonicalRenderData(doc);

    const facePick = resolveCanonicalTopologyFromTriangle(0, 'FACE', renderData);
    const edgePick = resolveCanonicalTopologyFromTriangle(0, 'EDGE', renderData);
    const vertPick = resolveCanonicalTopologyFromTriangle(0, 'VERTEX', renderData);

    expect(facePick?.entityType).toBe('FACE');
    expect(edgePick?.entityType).toBe('EDGE');
    expect(vertPick?.entityType).toBe('VERTEX');
  });

  it('14. Generates edge and vertex highlight geometries with persistent metadata', () => {
    const doc = createTestEvaluatedDoc();
    const renderData = createCanonicalRenderData(doc);

    const edgePick = resolveCanonicalEdgeFromTriangle(0, renderData)!;
    const edgeHighlight = convertCanonicalEdgeToHighlightGeometry(edgePick, renderData, { unitScaleMultiplier: 1000 });

    expect(edgeHighlight).toBeInstanceOf(THREE.BufferGeometry);
    expect(edgeHighlight.getAttribute('position')).toBeDefined();
    expect(edgeHighlight.userData.entityType).toBe('EDGE');
    expect(edgeHighlight.userData.canonicalEntityId).toBe(edgePick.canonicalEntityId);

    const vertPick = resolveCanonicalVertexFromTriangle(0, renderData)!;
    const vertHighlight = convertCanonicalVertexToHighlightGeometry(vertPick, renderData, { unitScaleMultiplier: 1000 });

    expect(vertHighlight).toBeInstanceOf(THREE.BufferGeometry);
    expect(vertHighlight.getAttribute('position')).toBeDefined();
    expect(vertHighlight.userData.entityType).toBe('VERTEX');
    expect(vertHighlight.userData.canonicalEntityId).toBe(vertPick.canonicalEntityId);

    // Unified converter test
    const unifiedEdge = convertCanonicalPickToHighlightGeometry(edgePick, renderData);
    const unifiedVert = convertCanonicalPickToHighlightGeometry(vertPick, renderData);
    expect(unifiedEdge.userData.entityType).toBe('EDGE');
    expect(unifiedVert.userData.entityType).toBe('VERTEX');
  });

  it('15. Revalidates EDGE and VERTEX selections cleanly across document revision updates', () => {
    const doc = createTestEvaluatedDoc();
    const renderDataV1 = createCanonicalRenderData(doc);

    const edgePickV1 = resolveCanonicalEdgeFromTriangle(0, renderDataV1)!;
    const vertPickV1 = resolveCanonicalVertexFromTriangle(0, renderDataV1)!;

    // Simulate document evaluation at Revision 2
    const docV2 = {
      ...doc,
      revision: (doc.revision as number) + 1
    };
    const renderDataV2 = createCanonicalRenderData(docV2);

    // Revalidate EDGE
    const revalEdge = revalidateSelection(edgePickV1, renderDataV2);
    expect(revalEdge.success).toBe(true);
    expect(revalEdge.status).toBe(RevisionLifecycleState.REVALIDATED);
    expect(revalEdge.resolvedPick?.revision).toBe(docV2.revision);
    expect(revalEdge.resolvedPick?.canonicalEntityId).toBe(edgePickV1.canonicalEntityId);
    expect(revalEdge.resolvedPick?.entityType).toBe('EDGE');

    // Revalidate VERTEX
    const revalVert = revalidateSelection(vertPickV1, renderDataV2);
    expect(revalVert.success).toBe(true);
    expect(revalVert.status).toBe(RevisionLifecycleState.REVALIDATED);
    expect(revalVert.resolvedPick?.revision).toBe(docV2.revision);
    expect(revalVert.resolvedPick?.canonicalEntityId).toBe(vertPickV1.canonicalEntityId);
    expect(revalVert.resolvedPick?.entityType).toBe('VERTEX');
  });

  it('16. Rejects invalid or corrupt topology gracefully without throwing errors', () => {
    const doc = createTestEvaluatedDoc();
    const renderData = createCanonicalRenderData(doc);

    // Corrupt renderData without topology map
    const corruptRenderData: CanonicalRenderData = {
      ...renderData,
      topologyMap: undefined
    };

    expect(resolveCanonicalEdgeFromTriangle(0, corruptRenderData)).toBeNull();
    expect(resolveCanonicalVertexFromTriangle(0, corruptRenderData)).toBeNull();
    expect(getCanonicalEdgeVertices({} as any, renderData)).toEqual([]);
    expect(getCanonicalVertexCoordinates({} as any, renderData)).toEqual([]);
  });
});
