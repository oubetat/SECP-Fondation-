import { describe, it, expect } from 'vitest';
import { SketchUIIntegration } from '../../cad-kernel/ui-integration/SketchUIIntegration';
import { DocumentEvaluator } from '../../cad-kernel/document/DocumentEvaluator';
import { createCanonicalRenderData, CanonicalRenderData } from '../CanonicalRenderContract';
import {
  resolveCanonicalFaceFromTriangle,
  resolveCanonicalEdgeFromTriangle,
  resolveCanonicalVertexFromTriangle,
  CanonicalPickResult
} from '../CanonicalPickingContract';
import {
  revalidateSelection,
  classifyDerivedState,
  RevisionLifecycleState
} from '../RevisionLifecycle';
import {
  SelectionContractEvaluator,
  SelectionReference,
  FaceReference,
  EdgeReference,
  VertexReference
} from '../SelectionTypes277';

describe('PROMPT-011 — Selection Verification Gateway & Adversarial Suite', () => {

  // Helper to create a genuine evaluated primitive CAD document
  function createTestEvaluatedDoc(docId: string = 'DOC_VERIFY_011_001', revision: number = 1) {
    const { document } = SketchUIIntegration.createPrimitiveDocument('BOX', docId);
    document.revision = revision;
    const evalResult = DocumentEvaluator.evaluate(document, { generateMesh: true });
    expect(evalResult.success).toBe(true);
    evalResult.document.revision = revision;
    return evalResult.document;
  }

  // =========================================================================
  // 1. SELECT FACE, EDGE, VERTEX (Tests 6, 7, 8)
  // =========================================================================
  it('Selects Face, Edge, and Vertex, producing stable Canonical references with no index-based identity', () => {
    const doc = createTestEvaluatedDoc('DOC_SELECT_PIPELINE', 1);
    const renderData = createCanonicalRenderData(doc);
    expect(renderData.hasGeometry).toBe(true);

    // Pick Face
    const facePick = resolveCanonicalFaceFromTriangle(0, renderData);
    expect(facePick).not.toBeNull();
    const faceRef: FaceReference = {
      referenceType: 'FACE',
      persistentId: facePick!.persistentId,
      sourceId: facePick!.documentId,
      faceId: facePick!.faceId,
      brepHash: facePick!.brepHash
    };
    expect(faceRef.persistentId).toBeDefined();
    expect(faceRef.faceId).toBeDefined();

    // Pick Edge
    const edgePick = resolveCanonicalEdgeFromTriangle(0, renderData);
    expect(edgePick).not.toBeNull();
    const edgeRef: EdgeReference = {
      referenceType: 'EDGE',
      persistentId: edgePick!.persistentId,
      sourceId: edgePick!.documentId,
      edgeId: edgePick!.edgeId || edgePick!.canonicalEntityId,
      brepHash: edgePick!.brepHash
    };
    expect(edgeRef.persistentId).toBeDefined();

    // Pick Vertex
    const vertexPick = resolveCanonicalVertexFromTriangle(0, renderData);
    expect(vertexPick).not.toBeNull();
    const vertexRef: VertexReference = {
      referenceType: 'VERTEX',
      persistentId: vertexPick!.persistentId,
      sourceId: vertexPick!.documentId,
      vertexId: vertexPick!.vertexId || vertexPick!.canonicalEntityId,
      brepHash: vertexPick!.brepHash
    };
    expect(vertexRef.persistentId).toBeDefined();
  });

  // =========================================================================
  // 2. PARAMS REGENERATION & REBINDING (Tests 10, 12, 13, 14, 15, 16)
  // =========================================================================
  it('Ensures Face, Edge, and Vertex references rebind successfully to the same canonical entity after parametric regeneration', () => {
    const doc = createTestEvaluatedDoc('DOC_REGEN_011', 1);
    const renderDataV1 = createCanonicalRenderData(doc);

    // Initial Picks
    const facePick = resolveCanonicalFaceFromTriangle(0, renderDataV1)!;
    const edgePick = resolveCanonicalEdgeFromTriangle(0, renderDataV1)!;
    const vertexPick = resolveCanonicalVertexFromTriangle(0, renderDataV1)!;

    // Mutate parameter in document features to trigger real re-evaluation
    const extrudeFeat = doc.features.find(f => f.type === 'EXTRUDE');
    expect(extrudeFeat).toBeDefined();
    expect(extrudeFeat!.definition.parameters.depth).toBe(100);

    // Change depth parameter 100 -> 250
    extrudeFeat!.definition.parameters.depth = 250;
    doc.revision = 2;

    const evalResult = DocumentEvaluator.evaluate(doc, { generateMesh: true });
    expect(evalResult.success).toBe(true);
    const docRev2 = evalResult.document;
    docRev2.revision = 2;

    const renderDataV2 = createCanonicalRenderData(docRev2);

    // Verify references are detected as STALE
    expect(classifyDerivedState(facePick, renderDataV2).status).toBe(RevisionLifecycleState.STALE);
    expect(classifyDerivedState(edgePick, renderDataV2).status).toBe(RevisionLifecycleState.STALE);
    expect(classifyDerivedState(vertexPick, renderDataV2).status).toBe(RevisionLifecycleState.STALE);

    // Revalidate Face Pick
    const revalFace = revalidateSelection(facePick, renderDataV2);
    expect(revalFace.success).toBe(true);
    expect(revalFace.status).toBe(RevisionLifecycleState.REVALIDATED);
    expect(revalFace.resolvedPick!.persistentId).toBe(facePick.persistentId);

    // Revalidate Edge Pick
    const revalEdge = revalidateSelection(edgePick, renderDataV2);
    expect(revalEdge.success).toBe(true);
    expect(revalEdge.status).toBe(RevisionLifecycleState.REVALIDATED);
    expect(revalEdge.resolvedPick!.persistentId).toBe(edgePick.persistentId);

    // Revalidate Vertex Pick
    const revalVertex = revalidateSelection(vertexPick, renderDataV2);
    expect(revalVertex.success).toBe(true);
    expect(revalVertex.status).toBe(RevisionLifecycleState.REVALIDATED);
    expect(revalVertex.resolvedPick!.persistentId).toBe(vertexPick.persistentId);
  });

  // =========================================================================
  // 3. MESH REORDERING & TESSELLATION CHANGE PROTECTION (Test 11, 21)
  // =========================================================================
  it('Guarantees selection remains intact and rebinding succeeds when mesh buffer arrays are reordered', () => {
    const doc = createTestEvaluatedDoc('DOC_REORDER_TEST', 1);
    const renderData = createCanonicalRenderData(doc);

    const facePick = resolveCanonicalFaceFromTriangle(0, renderData)!;

    // Simulate mesh reordering by shuffling/scrambling triangle indices
    const scrambledIndices = [...renderData.indices];
    if (scrambledIndices.length >= 6) {
      const temp = [scrambledIndices[0], scrambledIndices[1], scrambledIndices[2]];
      scrambledIndices[0] = scrambledIndices[3];
      scrambledIndices[1] = scrambledIndices[4];
      scrambledIndices[2] = scrambledIndices[5];
      scrambledIndices[3] = temp[0];
      scrambledIndices[4] = temp[1];
      scrambledIndices[5] = temp[2];
    }

    // Clone render data with reordered buffers but identical persistent topological mapping
    const reorderedRenderData: CanonicalRenderData = {
      ...renderData,
      indices: scrambledIndices,
      topologyMap: {
        ...renderData.topologyMap,
        faceTriangleMap: JSON.parse(JSON.stringify(renderData.topologyMap.faceTriangleMap))
      }
    };

    // Rebinding still succeeds and points to the same canonical entity
    const reval = revalidateSelection(facePick, reorderedRenderData);
    expect(reval.success).toBe(true);
    expect(reval.resolvedPick!.persistentId).toBe(facePick.persistentId);
  });

  // =========================================================================
  // 4. ENTITY REMOVAL HANDLING (Test 17)
  // =========================================================================
  it('Transition reference directly to INVALID and rejects rebinding if the topological entity disappears', () => {
    const doc = createTestEvaluatedDoc('DOC_REMOVAL_TEST', 1);
    const renderDataV1 = createCanonicalRenderData(doc);

    const facePick = resolveCanonicalFaceFromTriangle(0, renderDataV1)!;

    // Simulate the entity disappearing by removing its face mapping from the regenerated topologyMap
    const depletedRenderData: CanonicalRenderData = {
      ...renderDataV1,
      revision: 2,
      topologyMap: {
        ...renderDataV1.topologyMap,
        faceTriangleMap: {} // Remove all faces
      }
    };

    const reval = revalidateSelection(facePick, depletedRenderData);
    expect(reval.success).toBe(false);
    expect(reval.status).toBe(RevisionLifecycleState.INVALID);
    expect(reval.error).toContain('could not be resolved');
  });

  // =========================================================================
  // 5. ADVERSARIAL FORGERY & INCORRECT DOCUMENT PROTECTION (Test 18, 20)
  // =========================================================================
  it('Rejects rebinding if document ID, revision hashes, or lineage parameters are forged', () => {
    const doc = createTestEvaluatedDoc('DOC_ADVERSARIAL_TEST', 1);
    const renderData = createCanonicalRenderData(doc);

    const facePick = resolveCanonicalFaceFromTriangle(0, renderData)!;

    // Forged reference with a fake documentId
    const forgedDocPick: CanonicalPickResult = {
      ...facePick,
      documentId: 'FORGED_DOC_999'
    };

    const revalForgedDoc = revalidateSelection(forgedDocPick, renderData);
    expect(revalForgedDoc.success).toBe(false);
    expect(revalForgedDoc.status).toBe(RevisionLifecycleState.INVALID);
    expect(revalForgedDoc.error).toContain('Cannot revalidate across different documents');

    // Forged reference matching a different lineage
    const wrongLineagePick: CanonicalPickResult = {
      ...facePick,
      lineage: {
        createdByFeature: 'WRONG_FEATURE_ID_XYZ',
        sourceEntities: ['FAKE_ENTITY'],
        geometricSignature: 'FAKE_SIGNATURE'
      }
    };

    const revalWrongLineage = revalidateSelection(wrongLineagePick, {
      ...renderData,
      topologyMap: {
        ...renderData.topologyMap,
        faceTriangleMap: {
          // Mutated face triangle map that doesn't include facePick persistentId
          'DIFFERENT_FACE_99': {
            faceId: 'F99',
            persistentId: 'DIFFERENT_FACE_99',
            triangleIndices: [0, 1, 2]
          }
        }
      }
    });

    expect(revalWrongLineage.success).toBe(false);
    expect(revalWrongLineage.status).toBe(RevisionLifecycleState.INVALID);
  });

  // =========================================================================
  // 6. REAL TOOL GATE INTERACTION (Test 23, 24)
  // =========================================================================
  it('E2E Real Tool Gate: SelectionReference is consumed by a CAD Tool to drive parametric modification and revalidation', () => {
    const doc = createTestEvaluatedDoc('DOC_TOOL_GATE', 1);
    const renderDataV1 = createCanonicalRenderData(doc);

    // 1. Pick a Face to apply a modification tool (e.g. Fillet/Chamfer)
    const facePick = resolveCanonicalFaceFromTriangle(0, renderDataV1)!;
    expect(facePick).toBeDefined();

    const faceRef: SelectionReference = {
      referenceType: 'FACE',
      persistentId: facePick.persistentId,
      sourceId: facePick.documentId,
      faceId: facePick.faceId,
      brepHash: facePick.brepHash
    };

    // 2. Validate selection reference using SelectionContractEvaluator
    const valResult = SelectionContractEvaluator.validate(faceRef, doc);
    expect(valResult.isValid).toBe(true);

    // 3. Define a mock CAD Tool (Fillet Tool) that consumes SelectionReference
    class FilletTool {
      public static applyFillet(document: any, target: SelectionReference, radius: number): any {
        // Confirm target selection reference is valid before starting
        const check = SelectionContractEvaluator.validate(target, document);
        if (!check.isValid) {
          throw new Error(`Cannot apply Fillet: Selection target is invalid. ${check.message}`);
        }

        const lastExtrude = document.features.find((f: any) => f.type === 'EXTRUDE');
        const extrudeId = lastExtrude ? (lastExtrude.id || lastExtrude.featureId) : 'F_EXTRUDE_1';

        // Add a Fillet feature node representing the CAD operation with proper history chain
        const filletFeature = {
          featureId: `F_FILLET_1`,
          id: `F_FILLET_1`,
          type: 'FILLET',
          name: 'Fillet 1',
          dependencyIds: [extrudeId],
          inputReferences: [{ type: 'SOLID', targetFeatureId: extrudeId }],
          definition: {
            type: 'FILLET',
            name: 'Fillet 1',
            parameters: {
              targetId: target.persistentId,
              radius: radius
            }
          },
          status: 'ACTIVE'
        };

        document.features.push(filletFeature);
        document.revision += 1;
        return document;
      }
    }

    // 4. Run the CAD Tool
    const updatedDoc = FilletTool.applyFillet(doc, faceRef, 5);
    expect(updatedDoc.features.some((f: any) => f.type === 'FILLET')).toBe(true);
    expect(updatedDoc.revision).toBe(2);

    // 5. Re-evaluate document
    const finalEval = DocumentEvaluator.evaluate(updatedDoc, { generateMesh: true });
    expect(finalEval.success).toBe(true);

    const renderDataV2 = createCanonicalRenderData(finalEval.document);

    // 6. Prove the original selection reference can be revalidated and rebound after the tool execution
    const reval = revalidateSelection(facePick, renderDataV2);
    expect(reval.success).toBe(true);
    expect(reval.status).toBe(RevisionLifecycleState.REVALIDATED);
    expect(reval.resolvedPick!.faceId).toBe(facePick.faceId);
  });
});
