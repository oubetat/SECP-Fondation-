/**
 * SECP CAD Kernel — BRep Tessellator Tests
 * Phase 2 (PATCH-KERNEL-006)
 */

import { describe, it, expect } from 'vitest';
import { FeatureHistory } from '../../history/FeatureHistory';
import { BRepKernel } from '../../brep/BRepKernel';
import { BRepTessellator } from '../BRepTessellator';
import { BRepSolid } from '../../topology/BRepTopology';

describe('PATCH-KERNEL-006 — BRep → Mesh Derived Artifact & Topology Preservation', () => {
  it('TEST-01: Tessellates BRepSolid into derived MeshGeometryData while preserving underlying topology', () => {
    const brepKernel = BRepKernel.getCanonical();
    const boxSolid = brepKernel.createBox(0.04, 0.02, 0.02, 'Box001');

    const mesh = BRepTessellator.tessellate(boxSolid);

    expect(mesh).toBeDefined();
    expect(mesh.vertices.length).toBeGreaterThan(0);
    expect(mesh.indices.length).toBeGreaterThan(0);
    expect(mesh.facesCount).toBe(mesh.indices.length / 3);

    // Verify Topology Preservation Maps
    expect(mesh.topologyMap).toBeDefined();
    expect(mesh.topologyMap.faceTriangleMap).toBeDefined();
    expect(mesh.topologyMap.edgeVertexMap).toBeDefined();
    expect(mesh.topologyMap.vertexIndexMap).toBeDefined();
    expect(mesh.topologyMap.sharedEdges).toBeDefined();

    // Verify Face Mappings preserve BRep face IDs/lineage
    const faceKeys = Object.keys(mesh.topologyMap.faceTriangleMap);
    expect(faceKeys.length).toBe(6); // 6 faces for box solid

    // Verify Shared Edges demonstrate topological adjacency
    expect(mesh.topologyMap.sharedEdges.length).toBeGreaterThan(0);
    const sampleSharedEdge = mesh.topologyMap.sharedEdges[0];
    expect(sampleSharedEdge.faceA).toBeDefined();
    expect(sampleSharedEdge.faceB).toBeDefined();
    expect(sampleSharedEdge.faceA).not.toEqual(sampleSharedEdge.faceB);
    expect(sampleSharedEdge.sharedVertexIndices.length).toBe(2);

    // Cryptographic Hashes
    expect(mesh.brepHash).toBeDefined();
    expect(mesh.meshHash).toBeDefined();
    expect(mesh.brepHash.length).toBeGreaterThan(0);
    expect(mesh.meshHash.length).toBeGreaterThan(0);
  });

  it('TEST-02: Mandatory Parameter Modification Test (BRep A -> Mesh A vs BRep B -> Mesh B)', () => {
    const history = new FeatureHistory('DOC_TESSELLATOR_MOD_001');

    // 1. Create Sketch
    history.addFeature('SKETCH', 'Sketch001', {
      type: 'SKETCH',
      name: 'Sketch001',
      parameters: {
        plane: 'XY',
        closedProfile: true,
        entities: [
          { type: 'LINE', id: 'L1', points: [{ x: 0, y: 0 }, { x: 40, y: 0 }] },
          { type: 'LINE', id: 'L2', points: [{ x: 40, y: 0 }, { x: 40, y: 20 }] },
          { type: 'LINE', id: 'L3', points: [{ x: 40, y: 20 }, { x: 0, y: 20 }] },
          { type: 'LINE', id: 'L4', points: [{ x: 0, y: 20 }, { x: 0, y: 0 }] }
        ]
      },
      inputReferences: []
    }, [], undefined, 'Sketch001');

    // 2. Extrude Feature (Depth = 20 mm) -> BRep A
    const extrudeNode = history.addFeature('EXTRUDE', 'Extrude001', {
      type: 'EXTRUDE',
      name: 'Extrude001',
      parameters: {
        profileId: 'Sketch001',
        depth: 20
      },
      inputReferences: [{ type: 'PROFILE', targetFeatureId: 'Sketch001' }]
    }, ['Sketch001'], 'Sketch001', 'Extrude001');

    history.regenerate();

    const brepA = extrudeNode.outputGeometry as BRepSolid;
    expect(brepA).toBeDefined();

    // Mesh A derived from BRep A
    const meshA = BRepTessellator.tessellate(brepA);
    const brepHashA = meshA.brepHash;
    const meshHashA = meshA.meshHash;

    expect(brepHashA).toBeDefined();
    expect(meshHashA).toBeDefined();

    // 3. Modify Parameter (Depth = 20 mm -> 40 mm) -> BRep B
    history.updateFeatureDefinition('Extrude001', {
      type: 'EXTRUDE',
      name: 'Extrude001',
      parameters: {
        profileId: 'Sketch001',
        depth: 40
      },
      inputReferences: [{ type: 'PROFILE', targetFeatureId: 'Sketch001' }]
    });

    history.regenerate();

    const brepB = extrudeNode.outputGeometry as BRepSolid;
    expect(brepB).toBeDefined();

    // Mesh B derived from BRep B
    const meshB = BRepTessellator.tessellate(brepB);
    const brepHashB = meshB.brepHash;
    const meshHashB = meshB.meshHash;

    // PROOF: BRepHash A != BRepHash B
    expect(brepHashA).not.toEqual(brepHashB);

    // PROOF: MeshHash A != MeshHash B
    expect(meshHashA).not.toEqual(meshHashB);

    // PROOF: Mesh B = tessellate(BRep B)
    expect(meshB).toEqual(BRepTessellator.tessellate(brepB));
    expect(meshB.brepHash).toEqual(BRepTessellator.computeBRepHash(brepB));
    expect(meshB.meshHash).toEqual(BRepTessellator.computeMeshHash(meshB));
  });
});
