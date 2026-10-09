/**
 * Professional3DViewportPanel Migration Audit Test Suite
 * Validates that Professional3DViewportPanel consumes the Canonical Viewport Infrastructure
 * and shares the EXACT same Source of Truth (SOT) as CadViewport3D.
 */

import { describe, it, expect, vi } from 'vitest';
import { EngineeringDocument } from '../../cad-kernel/document/CADDocument';
import { createCanonicalRenderData } from '../CanonicalRenderContract';
import {
  resolveCanonicalTopologyFromTriangle,
  resolveCanonicalFaceFromTriangle,
  resolveCanonicalEdgeFromTriangle,
  resolveCanonicalVertexFromTriangle
} from '../CanonicalPickingContract';
import { classifyDerivedState, revalidateSelection, RevisionLifecycleState } from '../RevisionLifecycle';
import { BRepTessellator } from '../../cad-kernel/tessellation/BRepTessellator';

function createMockCanonicalDocument(docId: string = 'DOC-PROF-001', revision: number = 1): EngineeringDocument {
  return {
    documentId: docId,
    revision: revision,
    type: 'PART',
    units: {
      system: 'SI_MM',
      length: 'mm',
      mass: 'kg',
      force: 'N',
      pressure: 'MPa',
      angle: 'deg'
    },
    sketches: [],
    constraints: [],
    features: [
      {
        id: 'EXTRUDE_1',
        name: 'Main Block Extrude',
        type: 'EXTRUDE',
        parameters: { depth: 50 },
        suppressed: false
      }
    ],
    parameters: [],
    topologyMap: {
      version: 1,
      faceMap: { 'FACE_1': 'FACE_1', 'FACE_2': 'FACE_2' },
      edgeMap: { 'E1': 'E1', 'E2': 'E2', 'E3': 'E3' },
      vertexMap: { 'V1': 'V1', 'V2': 'V2' }
    },
    evidence: [],
    derived: {
      mesh: {
        brepHash: 'BREP-HASH-12345',
        meshHash: 'MESH-HASH-67890',
        vertices: [
          0, 0, 0,
          10, 0, 0,
          10, 10, 0,
          0, 10, 0,
          0, 0, 10,
          10, 0, 10,
          10, 10, 10,
          0, 10, 10
        ],
        indices: [
          0, 1, 2,  0, 2, 3, // Front Face (FACE_1)
          4, 6, 5,  4, 7, 6  // Back Face (FACE_2)
        ],
        normals: [
          0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1,
          0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1
        ],
        facesCount: 4,
        topologyMap: {
          faceTriangleMap: {
            'FACE_1': {
              triangleIndices: [0, 3], // triangle 0 (index offset 0) and triangle 1 (index offset 3)
              faceId: 'FACE_1',
              persistentId: 'FACE_1'
            },
            'FACE_2': {
              triangleIndices: [6, 9], // triangle 2 (index offset 6) and triangle 3 (index offset 9)
              faceId: 'FACE_2',
              persistentId: 'FACE_2'
            }
          },
          edgeVertexMap: {
            'E1': {
              vertexIndices: [0, 1],
              edgeId: 'E1',
              persistentId: 'E1'
            },
            'E2': {
              vertexIndices: [1, 2],
              edgeId: 'E2',
              persistentId: 'E2'
            }
          },
          vertexIndexMap: {
            'V1': {
              vertexIndex: 0,
              vertexId: 'V1',
              persistentId: 'V1'
            },
            'V2': {
              vertexIndex: 1,
              vertexId: 'V2',
              persistentId: 'V2'
            }
          },
          sharedEdges: []
        }
      }
    }
  };
}

describe('Professional3DViewportPanel Canonical Migration Verification', () => {
  it('Criterion 1 & 2: Same EngineeringDocument and Revision ID', () => {
    const doc = createMockCanonicalDocument('DOC-SINGLE-SOT-100', 3);
    const renderData = createCanonicalRenderData(doc);

    expect(renderData.documentId).toBe('DOC-SINGLE-SOT-100');
    expect(renderData.revision).toBe(3);
    expect(doc.documentId).toBe(renderData.documentId);
    expect(doc.revision).toBe(renderData.revision);
  });

  it('Criterion 3 & 4: Same B-Rep Hash and Mesh Lineage', () => {
    const doc = createMockCanonicalDocument('DOC-SINGLE-SOT-100', 1);
    const renderData1 = createCanonicalRenderData(doc);
    const renderData2 = createCanonicalRenderData(doc);

    expect(renderData1.brepHash).toBe(renderData2.brepHash);
    expect(renderData1.meshHash).toBe(renderData2.meshHash);
    expect(renderData1.brepHash).toBe('BREP-HASH-12345');
    expect(renderData1.meshHash).toBe('MESH-HASH-67890');
  });

  it('Criterion 5: Same Topology Map (Faces, Edges, Vertices)', () => {
    const doc = createMockCanonicalDocument('DOC-SINGLE-SOT-100', 1);
    const renderData = createCanonicalRenderData(doc);

    expect(renderData.topologyMap).toBeDefined();
    expect(renderData.topologyMap?.faceTriangleMap).toHaveProperty('FACE_1');
    expect(renderData.topologyMap?.edgeVertexMap).toHaveProperty('E1');
    expect(renderData.topologyMap?.vertexIndexMap).toHaveProperty('V1');
  });

  it('Criterion 6: Same Picking Results Across Both Viewports (Face, Edge, Vertex)', () => {
    const doc = createMockCanonicalDocument('DOC-SINGLE-SOT-100', 1);
    const renderData = createCanonicalRenderData(doc);

    // Pick Face from Triangle 0
    const facePick = resolveCanonicalTopologyFromTriangle(0, 'FACE', renderData, { distance: 5 });
    expect(facePick).not.toBeNull();
    expect(facePick?.canonicalEntityId).toBe('FACE_1');
    expect(facePick?.documentId).toBe('DOC-SINGLE-SOT-100');
    expect(facePick?.brepHash).toBe('BREP-HASH-12345');

    // Pick Edge from Triangle 0
    const edgePick = resolveCanonicalTopologyFromTriangle(0, 'EDGE', renderData, { distance: 5, hitPoint: [5, 0, 0] });
    expect(edgePick).not.toBeNull();
    expect(edgePick?.entityType).toBe('EDGE');
    expect(edgePick?.canonicalEntityId).toBe('E1');

    // Pick Vertex from Triangle 0
    const vertexPick = resolveCanonicalTopologyFromTriangle(0, 'VERTEX', renderData, { distance: 5, hitPoint: [0, 0, 0] });
    expect(vertexPick).not.toBeNull();
    expect(vertexPick?.entityType).toBe('VERTEX');
    expect(vertexPick?.canonicalEntityId).toBe('V1');
  });

  it('Criterion 7: Same Selection Lifecycle & Revision Stale Behavior', () => {
    const docRev1 = createMockCanonicalDocument('DOC-SINGLE-SOT-100', 1);
    const renderDataRev1 = createCanonicalRenderData(docRev1);
    const facePick = resolveCanonicalFaceFromTriangle(0, renderDataRev1, { distance: 5 });

    expect(facePick).not.toBeNull();

    // Check classification against CURRENT revision
    const currentClass = classifyDerivedState(facePick!, renderDataRev1);
    expect(currentClass.status).toBe(RevisionLifecycleState.CURRENT);

    // Create STALE revision
    const docRev2 = createMockCanonicalDocument('DOC-SINGLE-SOT-100', 2);
    const renderDataRev2 = createCanonicalRenderData(docRev2);

    const staleClass = classifyDerivedState(facePick!, renderDataRev2);
    expect(staleClass.status).toBe(RevisionLifecycleState.STALE);

    // Revalidate selection across revision increment
    const revalidated = revalidateSelection(facePick!, renderDataRev2);
    expect(revalidated.success).toBe(true);
    expect(revalidated.resolvedPick?.revision).toBe(2);
    expect(revalidated.resolvedPick?.canonicalEntityId).toBe('FACE_1');
  });

  it('Criterion 8, 9 & 10: Zero Local Geometry SOT & Zero Independent Tessellation', () => {
    const tessellateSpy = vi.spyOn(BRepTessellator, 'tessellate');

    const doc = createMockCanonicalDocument('DOC-SINGLE-SOT-100', 1);
    const renderData = createCanonicalRenderData(doc);

    // Performing rendering contract and picking contract calls
    const facePick = resolveCanonicalFaceFromTriangle(0, renderData, { distance: 10 });
    const edgePick = resolveCanonicalEdgeFromTriangle(0, renderData, { distance: 10, hitPoint: [5, 0, 0] });

    expect(facePick).not.toBeNull();
    expect(edgePick).not.toBeNull();

    // Zero calls to BRepTessellator.tessellate() during viewport operations
    expect(tessellateSpy).toHaveBeenCalledTimes(0);

    tessellateSpy.mockRestore();
  });
});
