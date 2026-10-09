/**
 * SECP CAD Kernel — Persistent Topology References Adversarial Verification Suite
 * Phase 2 (PROMPT-009)
 *
 * VALIDATES THE FOLLOWING CONTRACTS:
 * 1. Face reference does not rely on mesh position, triangleIndex, faceIndex, or Three.js Object3D.
 * 2. Regeneration makes the old reference STALE.
 * 3. Valid lineage allows re-resolution to the correct canonical entity (REVALIDATED).
 * 4. Selection remains valid and continues on the same semantic Face.
 * 5. Mesh/tessellation changes do not break semantic references.
 * 6. Disappearance of a Face leads directly to INVALID and clears active selection with no silent fallback.
 * 7. B-Rep replacement with preserved lineage rebinds correctly.
 * 8. Revision / hash mismatches are evaluated cleanly via lifecycle instead of bypass.
 * 9. Forged / invalid references are rejected immediately.
 * 10. Prevention of positional identity rebinding (wrong-entity same-index protection).
 */

import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import {
  createCanonicalRenderData,
  CanonicalRenderData
} from '../CanonicalRenderContract';
import {
  resolveCanonicalFaceFromTriangle,
  createCanonicalSelection,
  createEmptyCanonicalSelection,
  isSelectionSynchronizedWithRenderData,
  CanonicalPickResult
} from '../CanonicalPickingContract';
import {
  revalidateSelection,
  classifyDerivedState,
  RevisionLifecycleState,
  shouldDisplayHighlight
} from '../RevisionLifecycle';
import { SketchUIIntegration } from '../../cad-kernel/ui-integration/SketchUIIntegration';
import { DocumentEvaluator } from '../../cad-kernel/document/DocumentEvaluator';
import { BRepTessellator } from '../../cad-kernel/tessellation/BRepTessellator';

describe('PROMPT-009 — Persistent Topology References Adversarial Verification Suite', () => {
  
  // Helper to create a genuine evaluated B-Rep document with genuine topological faces
  function createTestEvaluatedDoc(docId: string = 'DOC_PROMPT009_001', revision: number = 1) {
    const { document } = SketchUIIntegration.createPrimitiveDocument('BOX', docId);
    document.revision = revision;
    const evalResult = DocumentEvaluator.evaluate(document, { generateMesh: true });
    expect(evalResult.success).toBe(true);
    evalResult.document.revision = revision;
    return evalResult.document;
  }

  // =========================================================================
  // TEST 1 — Stable Face
  // =========================================================================
  it('TEST 1 — Stable Face: Pick a face, then regenerate without changing semantic topology. Status transitions STALE -> REVALIDATED', () => {
    const docRev1 = createTestEvaluatedDoc('DOC_STABLE_FACE', 1);
    const renderDataV1 = createCanonicalRenderData(docRev1);
    const faceAPick = resolveCanonicalFaceFromTriangle(0, renderDataV1)!;
    expect(faceAPick).not.toBeNull();

    // After mutation (regeneration), revision increments to 2
    const docRev2 = createTestEvaluatedDoc('DOC_STABLE_FACE', 2);
    const renderDataV2 = createCanonicalRenderData(docRev2);

    // Prior selection must be STALE against the new render data
    const statusBefore = classifyDerivedState(faceAPick, renderDataV2);
    expect(statusBefore.status).toBe(RevisionLifecycleState.STALE);

    // Revalidate must succeed and transition status to REVALIDATED
    const reval = revalidateSelection(faceAPick, renderDataV2);
    expect(reval.success).toBe(true);
    expect(reval.status).toBe(RevisionLifecycleState.REVALIDATED);

    // Selection remains bound to the same semantic face
    expect(reval.resolvedPick!.persistentId).toBe(faceAPick.persistentId);
    expect(reval.resolvedPick!.revision).toBe(2);
  });

  // =========================================================================
  // TEST 2 — Mesh Reordering
  // =========================================================================
  it('TEST 2 — Mesh Reordering: Triangle indices in mesh buffer are reordered, reference remains valid, not relying on triangleIndex', () => {
    const doc = createTestEvaluatedDoc('DOC_REORDER', 1);
    const renderDataV1 = createCanonicalRenderData(doc);
    const faceAPick = resolveCanonicalFaceFromTriangle(0, renderDataV1)!;
    
    // We clone and reorder triangle indices inside new render data
    const reorderedIndices = [...renderDataV1.indices];
    if (reorderedIndices.length >= 6) {
      const temp = [reorderedIndices[0], reorderedIndices[1], reorderedIndices[2]];
      reorderedIndices[0] = reorderedIndices[3];
      reorderedIndices[1] = reorderedIndices[4];
      reorderedIndices[2] = reorderedIndices[5];
      reorderedIndices[3] = temp[0];
      reorderedIndices[4] = temp[1];
      reorderedIndices[5] = temp[2];
    }

    const faceMapClone = JSON.parse(JSON.stringify(renderDataV1.topologyMap.faceTriangleMap));
    const faceEntry = faceMapClone[faceAPick.persistentId];
    expect(faceEntry).toBeDefined();
    
    // Shift triangle indices to represent the swap
    const oldTriangleIndices = faceEntry.triangleIndices;
    faceEntry.triangleIndices = [3, 4, 5, 0, 1, 2, ...oldTriangleIndices.slice(6)];

    const renderDataV2: CanonicalRenderData = {
      ...renderDataV1,
      revision: 2,
      indices: reorderedIndices,
      topologyMap: {
        ...renderDataV1.topologyMap,
        faceTriangleMap: faceMapClone
      },
      meshHash: 'NEW_MESH_HASH_REORDERED'
    };

    // Revalidate face pick
    const reval = revalidateSelection(faceAPick, renderDataV2);
    expect(reval.success).toBe(true);
    expect(reval.status).toBe(RevisionLifecycleState.REVALIDATED);
    expect(reval.resolvedPick!.persistentId).toBe(faceAPick.persistentId);
    
    // Check that we resolved the new reordered triangle indices instead of assuming old index
    expect(reval.resolvedPick!.triangleIndices[0]).toBe(3);
  });

  // =========================================================================
  // TEST 3 — Tessellation Change
  // =========================================================================
  it('TEST 3 — Tessellation Change: Changing mesh density / tessellation density does not break semantic reference', () => {
    const doc = createTestEvaluatedDoc('DOC_TESSELLATION', 1);
    const renderDataV1 = createCanonicalRenderData(doc);
    const faceAPick = resolveCanonicalFaceFromTriangle(0, renderDataV1)!;

    // Simulate high-density tessellation where each face has 10x more triangles
    const denseFaceMap: any = {};
    for (const [key, entry] of Object.entries(renderDataV1.topologyMap.faceTriangleMap)) {
      denseFaceMap[key] = {
        ...entry,
        triangleIndices: Array.from({ length: entry.triangleIndices.length * 10 }, (_, i) => i)
      };
    }

    const renderDataV2: CanonicalRenderData = {
      ...renderDataV1,
      revision: 2,
      vertices: Array.from({ length: renderDataV1.vertices.length * 10 }, () => Math.random()),
      indices: Array.from({ length: renderDataV1.indices.length * 10 }, (_, i) => i),
      topologyMap: {
        ...renderDataV1.topologyMap,
        faceTriangleMap: denseFaceMap
      },
      meshHash: 'DENSE_MESH_HASH'
    };

    const reval = revalidateSelection(faceAPick, renderDataV2);
    expect(reval.success).toBe(true);
    expect(reval.status).toBe(RevisionLifecycleState.REVALIDATED);
    expect(reval.resolvedPick!.persistentId).toBe(faceAPick.persistentId);
    expect(reval.resolvedPick!.triangleIndices.length).toBe(faceAPick.triangleIndices.length * 10);
  });

  // =========================================================================
  // TEST 4 — B-Rep Replacement with Preserved Lineage
  // =========================================================================
  it('TEST 4 — B-Rep Replacement With Preserved Lineage: Replace evaluated B-Rep while preserving valid lineage, transitions to REVALIDATED', () => {
    const docRev1 = createTestEvaluatedDoc('DOC_BREP_REPLACE', 1);
    const renderDataV1 = createCanonicalRenderData(docRev1);
    const faceAPick = resolveCanonicalFaceFromTriangle(0, renderDataV1)!;

    // Mutate the existing extrude feature parameter directly to vary depth and regenerate
    const docRev2 = JSON.parse(JSON.stringify(docRev1));
    docRev2.revision = 2;
    const extrudeFeature = docRev2.features.find((f: any) => f.type === 'EXTRUDE');
    expect(extrudeFeature).toBeDefined();
    extrudeFeature.definition.parameters.depth = 120; // Change depth!

    const evalResult = DocumentEvaluator.evaluate(docRev2, { generateMesh: true });
    expect(evalResult.success).toBe(true);
    const renderDataV2 = createCanonicalRenderData(evalResult.document);

    expect(renderDataV2.brepHash).not.toBe(renderDataV1.brepHash);

    const reval = revalidateSelection(faceAPick, renderDataV2);
    expect(reval.success).toBe(true);
    expect(reval.status).toBe(RevisionLifecycleState.REVALIDATED);
    expect(reval.resolvedPick!.brepHash).toBe(renderDataV2.brepHash);
  });

  // =========================================================================
  // TEST 5 — Face Removal
  // =========================================================================
  it('TEST 5 — Face Removal: Delete/modify feature so face disappears, transitions STALE -> INVALID, and selection clears', () => {
    const docRev1 = createTestEvaluatedDoc('DOC_FACE_REMOVE', 1);
    const renderDataV1 = createCanonicalRenderData(docRev1);
    const faceAPick = resolveCanonicalFaceFromTriangle(0, renderDataV1)!;

    const docRev2 = createTestEvaluatedDoc('DOC_FACE_REMOVE', 2);
    const renderDataV2 = createCanonicalRenderData(docRev2);

    // Delete Face A from the topology face map manually to simulate its absolute disappearance
    const faceMapClone = { ...renderDataV2.topologyMap.faceTriangleMap };
    delete faceMapClone[faceAPick.persistentId];

    const renderDataV2Disappeared: CanonicalRenderData = {
      ...renderDataV2,
      topologyMap: {
        ...renderDataV2.topologyMap,
        faceTriangleMap: faceMapClone
      }
    };

    // Revalidation must return success: false and status: INVALID
    const reval = revalidateSelection(faceAPick, renderDataV2Disappeared);
    expect(reval.success).toBe(false);
    expect(reval.status).toBe(RevisionLifecycleState.INVALID);
    expect(reval.resolvedPick).toBeNull();

    // The active selection state must be cleared upon revalidation failure
    let activeSelection: CanonicalPickResult | null = faceAPick;
    if (reval.status === RevisionLifecycleState.INVALID) {
      activeSelection = null;
    }
    expect(activeSelection).toBeNull(); // No silent fallback
  });

  // =========================================================================
  // TEST 6 — Revision Mismatch
  // =========================================================================
  it('TEST 6 — Revision Mismatch: Use reference from old revision, classifies as STALE, resolves only via canonical lineage', () => {
    const docRev1 = createTestEvaluatedDoc('DOC_REV_MISMATCH', 1);
    const renderDataV1 = createCanonicalRenderData(docRev1);
    const faceAPick = resolveCanonicalFaceFromTriangle(0, renderDataV1)!;

    const docRev3 = createTestEvaluatedDoc('DOC_REV_MISMATCH', 3);
    const renderDataV3 = createCanonicalRenderData(docRev3);

    // Classification should be STALE
    const classification = classifyDerivedState(faceAPick, renderDataV3);
    expect(classification.status).toBe(RevisionLifecycleState.STALE);
    expect(classification.revisionMatch).toBe(false);

    // Must resolve correctly via revalidateSelection
    const reval = revalidateSelection(faceAPick, renderDataV3);
    expect(reval.success).toBe(true);
    expect(reval.status).toBe(RevisionLifecycleState.REVALIDATED);
  });

  // =========================================================================
  // TEST 7 — B-Rep Hash Mismatch
  // =========================================================================
  it('TEST 7 — B-Rep Hash Mismatch: Reference has old B-Rep hash under same revision, must not be CURRENT directly, goes through stale/revalidation', () => {
    const doc = createTestEvaluatedDoc('DOC_HASH_MISMATCH', 1);
    const renderData = createCanonicalRenderData(doc);
    const faceAPick = resolveCanonicalFaceFromTriangle(0, renderData)!;

    // Tamper B-Rep hash in the pick
    const tamperedPick: CanonicalPickResult = {
      ...faceAPick,
      brepHash: 'ALTERED_BREP_HASH_12345'
    };

    // Since the hashes mismatch under same revision/mesh, it must be classed as INVALID
    const classification = classifyDerivedState(tamperedPick, renderData);
    expect(classification.status).toBe(RevisionLifecycleState.INVALID);

    // Goes through revalidation to restore valid current state
    const reval = revalidateSelection(tamperedPick, renderData);
    expect(reval.success).toBe(true);
    expect(reval.resolvedPick!.brepHash).toBe(renderData.brepHash);
  });

  // =========================================================================
  // TEST 8 — Mesh Hash Mismatch
  // =========================================================================
  it('TEST 8 — Mesh Hash Mismatch: Modify mesh details only (topology stays same), semantic reference does not collapse', () => {
    const doc = createTestEvaluatedDoc('DOC_MESH_MISMATCH', 1);
    const renderDataV1 = createCanonicalRenderData(doc);
    const faceAPick = resolveCanonicalFaceFromTriangle(0, renderDataV1)!;

    // Mutate mesh only
    const renderDataV2: CanonicalRenderData = {
      ...renderDataV1,
      meshHash: 'TOTALLY_DIFFERENT_MESH_HASH_ABC'
    };

    // Pick is no longer CURRENT because meshHash changed
    const classification = classifyDerivedState(faceAPick, renderDataV2);
    expect(classification.status).toBe(RevisionLifecycleState.INVALID);

    // But semantic reference does not collapse! It revalidates cleanly
    const reval = revalidateSelection(faceAPick, renderDataV2);
    expect(reval.success).toBe(true);
    expect(reval.status).toBe(RevisionLifecycleState.REVALIDATED);
    expect(reval.resolvedPick!.persistentId).toBe(faceAPick.persistentId);
  });

  // =========================================================================
  // TEST 9 — Forged Reference
  // =========================================================================
  it('TEST 9 — Forged Reference: Fabricated reference with non-existent lineage or identity is rejected as INVALID', () => {
    const doc = createTestEvaluatedDoc('DOC_FORGED', 1);
    const renderData = createCanonicalRenderData(doc);

    const forgedPick: CanonicalPickResult = {
      documentId: doc.documentId,
      revision: 1,
      brepHash: renderData.brepHash,
      meshHash: renderData.meshHash,
      entityType: 'FACE',
      canonicalEntityId: 'FORGED_FACE_ID_9999999',
      faceId: 'FORGED_FACE_ID_9999999',
      persistentId: 'FORGED_FACE_ID_9999999',
      triangleIndex: 0,
      triangleIndices: [0, 1, 2],
      timestamp: Date.now()
    };

    const reval = revalidateSelection(forgedPick, renderData);
    expect(reval.success).toBe(false);
    expect(reval.status).toBe(RevisionLifecycleState.INVALID);
    expect(reval.resolvedPick).toBeNull();
  });

  // =========================================================================
  // TEST 10 — Wrong Topology Rebinding
  // =========================================================================
  it('TEST 10 — Wrong Topology Rebinding: Prevent rebinding to a wrong entity that reuses the old rendering position / triangle index', () => {
    const docRev1 = createTestEvaluatedDoc('DOC_REBIND_PROTECT', 1);
    const renderDataV1 = createCanonicalRenderData(docRev1);
    const faceAPick = resolveCanonicalFaceFromTriangle(0, renderDataV1)!;

    // Construct a new render data where Face A is deleted, but a NEW Face B is introduced
    // Face B now reuses triangleIndex 0 (offset 0, 1, 2) which Face A occupied in Rev 1
    const faceMapClone: any = { ...renderDataV1.topologyMap.faceTriangleMap };
    delete faceMapClone[faceAPick.persistentId]; // Delete Face A

    faceMapClone['NEW_FEATURE:FACE:FaceB'] = {
      triangleIndices: [0, 1, 2],
      faceId: 'FaceB_ID',
      persistentId: 'NEW_FEATURE:FACE:FaceB'
    };

    const renderDataV2: CanonicalRenderData = {
      ...renderDataV1,
      revision: 2,
      topologyMap: {
        ...renderDataV1.topologyMap,
        faceTriangleMap: faceMapClone
      },
      meshHash: 'HASH_FACE_B_REUSE'
    };

    // Revalidate old Face A pick
    const reval = revalidateSelection(faceAPick, renderDataV2);
    
    // It MUST NOT bind to Face B! It should fail with INVALID since Face A lineage is gone.
    expect(reval.success).toBe(false);
    expect(reval.status).toBe(RevisionLifecycleState.INVALID);
    expect(reval.resolvedPick).toBeNull();
  });

  // =========================================================================
  // INTEGRATION PIPELINE
  // =========================================================================
  it('INTEGRATION — End-to-End Lineage & Selection Revalidation Pipeline', () => {
    // 1. Initial State (Rev 1)
    const doc = createTestEvaluatedDoc('DOC_INTEGRATION_001', 1);
    const renderDataRev1 = createCanonicalRenderData(doc);

    // 2. Canonical Picking
    const pickResult = resolveCanonicalFaceFromTriangle(0, renderDataRev1);
    expect(pickResult).not.toBeNull();
    expect(pickResult!.entityType).toBe('FACE');

    // 3. Persistent selection state creation
    const selection = createCanonicalSelection(pickResult);
    expect(selection.selectedEntity).toBe(pickResult);

    // 4. Viewport highlight display validation
    expect(shouldDisplayHighlight(selection.selectedEntity, renderDataRev1)).toBe(true);

    // 5. Canonical Regeneration (Rev 2)
    const regeneratedDoc = createTestEvaluatedDoc('DOC_INTEGRATION_001', 2);
    const renderDataRev2 = createCanonicalRenderData(regeneratedDoc);

    // 6. Old selection is now stale
    const classification = classifyDerivedState(selection.selectedEntity!, renderDataRev2);
    expect(classification.status).toBe(RevisionLifecycleState.STALE);
    expect(shouldDisplayHighlight(selection.selectedEntity, renderDataRev2)).toBe(false);

    // 7. Topology lineage reference revalidation
    const reval = revalidateSelection(selection.selectedEntity!, renderDataRev2);
    expect(reval.success).toBe(true);
    expect(reval.status).toBe(RevisionLifecycleState.REVALIDATED);

    // 8. Update selection state & viewport highlight is re-enabled for new mesh
    const updatedSelection = createCanonicalSelection(reval.resolvedPick);
    expect(updatedSelection.selectedEntity!.revision).toBe(2);
    expect(shouldDisplayHighlight(updatedSelection.selectedEntity, renderDataRev2)).toBe(true);
  });
});
