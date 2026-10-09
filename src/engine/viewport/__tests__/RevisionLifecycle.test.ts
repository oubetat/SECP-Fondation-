/**
 * SECP CAD Kernel — Canonical Revision & Stale Lifecycle Verification Suite
 * Phase 2 (SECP — REVISION / STALE LIFECYCLE)
 *
 * MANDATORY TEST BATTERY:
 * - Test A: Same Revision (documentId + revision + hashes identical -> CURRENT)
 * - Test B: Revision Changed (revision N -> N+1 -> old derived state STALE)
 * - Test C: Different Document (DOC-A -> DOC-B -> INVALID)
 * - Test D: Persistent Re-resolution Success (Face identity resolves into new revision)
 * - Test E: Persistent Re-resolution Failure (Non-existent face identity -> INVALID)
 * - Test F: Hash Mismatch (Same revision but divergent mesh hash -> INVALID)
 * - Test G: Highlight Lifecycle (STALE / INVALID selections suppress visual highlight)
 * - Test H: No Parallel Geometry (Lifecycle performs zero B-Rep synthesis or tessellation)
 * - Test I: Deterministic Invariance (Identical inputs yield identical classifications)
 * - Test J: Tab Switching / Multi-Workbench (Shared single canonical revision truth)
 */

import { describe, it, expect, vi } from 'vitest';
import {
  RevisionLifecycleState,
  captureCanonicalRevision,
  compareRevision,
  classifyDerivedState,
  markStale,
  invalidate,
  revalidateSelection,
  shouldDisplayHighlight,
  CanonicalRevisionIdentity
} from '../RevisionLifecycle';
import {
  createCanonicalRenderData,
  CanonicalRenderData
} from '../CanonicalRenderContract';
import {
  resolveCanonicalFaceFromTriangle,
  CanonicalPickResult
} from '../CanonicalPickingContract';
import { SketchUIIntegration } from '../../cad-kernel/ui-integration/SketchUIIntegration';
import { DocumentEvaluator } from '../../cad-kernel/document/DocumentEvaluator';
import { BRepTessellator } from '../../cad-kernel/tessellation/BRepTessellator';

describe('SECP Revision & Stale Lifecycle Verification Suite', () => {
  function createEvaluatedDoc(docId = 'DOC_LIFECYCLE_001', rev = 1) {
    const { document } = SketchUIIntegration.createPrimitiveDocument('BOX', docId);
    document.revision = rev;
    const evalResult = DocumentEvaluator.evaluate(document, { generateMesh: true });
    expect(evalResult.success).toBe(true);
    evalResult.document.revision = rev;
    return evalResult.document;
  }

  // =========================================================================
  // Test A — Same Revision
  // =========================================================================
  it('Test A: Same Revision — identical (docId, rev, brepHash, meshHash) classifies as CURRENT', () => {
    const doc = createEvaluatedDoc('DOC-A', 1);
    const renderData = createCanonicalRenderData(doc);
    const pick = resolveCanonicalFaceFromTriangle(0, renderData);

    expect(pick).not.toBeNull();

    // Derived identity from pick against renderData
    const classification = classifyDerivedState(pick!, renderData);
    expect(classification.status).toBe(RevisionLifecycleState.CURRENT);
    expect(classification.documentIdMatch).toBe(true);
    expect(classification.revisionMatch).toBe(true);
    expect(classification.brepHashMatch).toBe(true);
    expect(classification.meshHashMatch).toBe(true);
  });

  // =========================================================================
  // Test B — Revision Changed
  // =========================================================================
  it('Test B: Revision Changed — revision N -> N+1 classifies old derived state as STALE', () => {
    const docRev1 = createEvaluatedDoc('DOC-PARTS-001', 1);
    const renderDataRev1 = createCanonicalRenderData(docRev1);
    const pickRev1 = resolveCanonicalFaceFromTriangle(0, renderDataRev1);

    expect(pickRev1).not.toBeNull();
    expect(pickRev1!.revision).toBe(1);

    // Simulate canonical document mutation to Revision 2
    const docRev2 = createEvaluatedDoc('DOC-PARTS-001', 2);
    const renderDataRev2 = createCanonicalRenderData(docRev2);

    // Pick from Rev 1 evaluated against Rev 2
    const classification = classifyDerivedState(pickRev1!, renderDataRev2);
    expect(classification.status).toBe(RevisionLifecycleState.STALE);
    expect(classification.documentIdMatch).toBe(true);
    expect(classification.revisionMatch).toBe(false);
    expect(classification.reason).toContain('Revision divergence');
  });

  // =========================================================================
  // Test C — Different Document
  // =========================================================================
  it('Test C: Different Document — DOC-A -> DOC-B classifies derived state as INVALID', () => {
    const docA = createEvaluatedDoc('DOC-PROJECT-A', 1);
    const renderDataA = createCanonicalRenderData(docA);
    const pickA = resolveCanonicalFaceFromTriangle(0, renderDataA);

    const docB = createEvaluatedDoc('DOC-PROJECT-B', 1);
    const renderDataB = createCanonicalRenderData(docB);

    const classification = classifyDerivedState(pickA!, renderDataB);
    expect(classification.status).toBe(RevisionLifecycleState.INVALID);
    expect(classification.documentIdMatch).toBe(false);
    expect(classification.reason).toContain('Document mismatch');
  });

  // =========================================================================
  // Test D — Persistent Re-resolution Success
  // =========================================================================
  it('Test D: Persistent Re-resolution Success — preserves face identity across revisions with new provenance', () => {
    const docRev1 = createEvaluatedDoc('DOC-VALVE-CYLINDER', 1);
    const renderDataRev1 = createCanonicalRenderData(docRev1);
    const pickRev1 = resolveCanonicalFaceFromTriangle(0, renderDataRev1);

    expect(pickRev1).not.toBeNull();
    const originalPersistentId = pickRev1!.canonicalEntityId;

    // Mutate to Revision 2
    const docRev2 = createEvaluatedDoc('DOC-VALVE-CYLINDER', 2);
    const renderDataRev2 = createCanonicalRenderData(docRev2);

    // Revalidate
    const revalidation = revalidateSelection(pickRev1!, renderDataRev2);
    expect(revalidation.success).toBe(true);
    expect(revalidation.status).toBe(RevisionLifecycleState.REVALIDATED);
    expect(revalidation.sourceRevision).toBe(1);
    expect(revalidation.targetRevision).toBe(2);

    const resolvedPick = revalidation.resolvedPick!;
    expect(resolvedPick).not.toBeNull();
    expect(resolvedPick.documentId).toBe('DOC-VALVE-CYLINDER');
    expect(resolvedPick.revision).toBe(2);
    expect(resolvedPick.canonicalEntityId).toBe(originalPersistentId);
    expect(resolvedPick.brepHash).toBe(renderDataRev2.brepHash);
    expect(resolvedPick.meshHash).toBe(renderDataRev2.meshHash);

    // Now verify the revalidated pick is strictly CURRENT against Revision 2
    const classification = classifyDerivedState(resolvedPick, renderDataRev2);
    expect(classification.status).toBe(RevisionLifecycleState.CURRENT);
  });

  // =========================================================================
  // Test E — Persistent Re-resolution Failure
  // =========================================================================
  it('Test E: Persistent Re-resolution Failure — deleted / nonexistent face resolves to INVALID', () => {
    const docRev1 = createEvaluatedDoc('DOC-ENGINE-BLOCK', 1);
    const renderDataRev1 = createCanonicalRenderData(docRev1);
    const pickRev1 = resolveCanonicalFaceFromTriangle(0, renderDataRev1);

    // Create a fake pick referring to a deleted face
    const nonExistentPick: CanonicalPickResult = {
      ...pickRev1!,
      canonicalEntityId: 'F_NON_EXISTENT_FEATURE:FACE:DeletedFace',
      persistentId: 'F_NON_EXISTENT_FEATURE:FACE:DeletedFace',
      faceId: 'FACE_DELETED_999'
    };

    const docRev2 = createEvaluatedDoc('DOC-ENGINE-BLOCK', 2);
    const renderDataRev2 = createCanonicalRenderData(docRev2);

    const revalidation = revalidateSelection(nonExistentPick, renderDataRev2);
    expect(revalidation.success).toBe(false);
    expect(revalidation.status).toBe(RevisionLifecycleState.INVALID);
    expect(revalidation.resolvedPick).toBeNull();
    expect(revalidation.error).toContain('could not be resolved');
  });

  // =========================================================================
  // Test F — Hash Mismatch
  // =========================================================================
  it('Test F: Hash Mismatch — same revision but altered meshHash classifies as INVALID', () => {
    const doc = createEvaluatedDoc('DOC-FLANGE', 1);
    const renderData = createCanonicalRenderData(doc);
    const pick = resolveCanonicalFaceFromTriangle(0, renderData);

    const tamperedPick: CanonicalPickResult = {
      ...pick!,
      meshHash: 'TAMPERED_MESH_HASH_00000000'
    };

    const classification = classifyDerivedState(tamperedPick, renderData);
    expect(classification.status).toBe(RevisionLifecycleState.INVALID);
    expect(classification.revisionMatch).toBe(true);
    expect(classification.meshHashMatch).toBe(false);
    expect(classification.reason).toContain('Hash divergence');
  });

  // =========================================================================
  // Test G — Highlight Lifecycle
  // =========================================================================
  it('Test G: Highlight Lifecycle — STALE and INVALID selections strictly suppress highlight rendering', () => {
    const docRev1 = createEvaluatedDoc('DOC-HOUSING', 1);
    const renderDataRev1 = createCanonicalRenderData(docRev1);
    const pickRev1 = resolveCanonicalFaceFromTriangle(0, renderDataRev1);

    // CURRENT selection -> highlight permitted
    expect(shouldDisplayHighlight(pickRev1, renderDataRev1)).toBe(true);

    // Document moves to Rev 2
    const docRev2 = createEvaluatedDoc('DOC-HOUSING', 2);
    const renderDataRev2 = createCanonicalRenderData(docRev2);

    // Old Rev 1 pick against Rev 2 renderData -> STALE -> highlight FORBIDDEN
    expect(shouldDisplayHighlight(pickRev1, renderDataRev2)).toBe(false);

    // Revalidate pick into Rev 2
    const revalidation = revalidateSelection(pickRev1!, renderDataRev2);
    expect(revalidation.success).toBe(true);

    // Revalidated pick is now CURRENT in Rev 2 -> highlight permitted
    expect(shouldDisplayHighlight(revalidation.resolvedPick, renderDataRev2)).toBe(true);

    // Null or invalid pick -> highlight FORBIDDEN
    expect(shouldDisplayHighlight(null, renderDataRev2)).toBe(false);
    expect(shouldDisplayHighlight({ ...pickRev1!, documentId: 'OTHER_DOC' }, renderDataRev2)).toBe(false);
  });

  // =========================================================================
  // Test H — No Parallel Geometry
  // =========================================================================
  it('Test H: No Parallel Geometry — lifecycle operations do not invoke B-Rep tessellation or kernel regeneration', () => {
    const doc = createEvaluatedDoc('DOC-BEARING', 1);
    const renderData = createCanonicalRenderData(doc);
    const pick = resolveCanonicalFaceFromTriangle(0, renderData);

    // Spy on BRepTessellator.tessellate to prove zero tessellation happens during lifecycle operations
    const tessellateSpy = vi.spyOn(BRepTessellator, 'tessellate');

    const classification = classifyDerivedState(pick!, renderData);
    expect(classification.status).toBe(RevisionLifecycleState.CURRENT);

    const revalidation = revalidateSelection(pick!, renderData);
    expect(revalidation.success).toBe(true);

    const displayHighlight = shouldDisplayHighlight(pick, renderData);
    expect(displayHighlight).toBe(true);

    // Verifies strict read-only nature: NO tessellation called
    expect(tessellateSpy).not.toHaveBeenCalled();
    tessellateSpy.mockRestore();
  });

  // =========================================================================
  // Test I — Determinism
  // =========================================================================
  it('Test I: Deterministic Invariance — identical inputs always yield identical classifications and comparisons', () => {
    const doc = createEvaluatedDoc('DOC-SHAFT', 5);
    const renderData = createCanonicalRenderData(doc);
    const pick = resolveCanonicalFaceFromTriangle(0, renderData)!;

    const classif1 = classifyDerivedState(pick, renderData);
    const classif2 = classifyDerivedState(pick, renderData);

    expect(classif1.status).toBe(classif2.status);
    expect(classif1.reason).toBe(classif2.reason);
    expect(classif1.documentIdMatch).toBe(classif2.documentIdMatch);
    expect(classif1.revisionMatch).toBe(classif2.revisionMatch);
    expect(classif1.brepHashMatch).toBe(classif2.brepHashMatch);
    expect(classif1.meshHashMatch).toBe(classif2.meshHashMatch);

    const id1 = captureCanonicalRevision(renderData);
    const id2 = captureCanonicalRevision(renderData);
    expect(id1.documentId).toBe(id2.documentId);
    expect(id1.revision).toBe(id2.revision);
    expect(id1.brepHash).toBe(id2.brepHash);
    expect(id1.meshHash).toBe(id2.meshHash);

    const comparison = compareRevision(id1, id2);
    expect(comparison.isIdentical).toBe(true);
  });

  // =========================================================================
  // Test J — Tab Switching / Multi-Workbench
  // =========================================================================
  it('Test J: Tab Switching — selection remains valid across workbenches if revision is unchanged; detects STALE if revision changes', () => {
    // Workbench 1 (e.g. Part Studio): select Face A under Revision 1
    const canonicalDoc = createEvaluatedDoc('DOC-MULTI-WORKBENCH', 1);
    const renderData = createCanonicalRenderData(canonicalDoc);
    const faceAPick = resolveCanonicalFaceFromTriangle(0, renderData)!;

    // Simulate switching to Workbench 2 (e.g. FEA Analysis Workbench):
    // As long as canonicalDoc revision has not changed, selection is CURRENT
    const workbench2Classification = classifyDerivedState(faceAPick, renderData);
    expect(workbench2Classification.status).toBe(RevisionLifecycleState.CURRENT);
    expect(shouldDisplayHighlight(faceAPick, renderData)).toBe(true);

    // Now simulate user performing an edit in Workbench 2 that increments revision to 2
    const updatedDoc = createEvaluatedDoc('DOC-MULTI-WORKBENCH', 2);
    const updatedRenderData = createCanonicalRenderData(updatedDoc);

    // Workbench 1 now inspects the old selection:
    const workbench1AfterMutation = classifyDerivedState(faceAPick, updatedRenderData);
    expect(workbench1AfterMutation.status).toBe(RevisionLifecycleState.STALE);
    // Visual highlight in Workbench 1 must be suppressed until revalidation
    expect(shouldDisplayHighlight(faceAPick, updatedRenderData)).toBe(false);

    // Both workbenches revalidate against the single canonical revision 2:
    const revalidation = revalidateSelection(faceAPick, updatedRenderData);
    expect(revalidation.success).toBe(true);
    expect(revalidation.resolvedPick!.revision).toBe(2);
    expect(shouldDisplayHighlight(revalidation.resolvedPick, updatedRenderData)).toBe(true);
  });
});
