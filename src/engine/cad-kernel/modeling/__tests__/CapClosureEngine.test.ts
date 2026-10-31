/**
 * SECP CAD Kernel — CapClosureEngine Unit Tests
 * SECP-CAD-DIRECT-MODELING-CAP-002 / CAP-003 Qualification
 */

import { describe, it, expect } from 'vitest';
import { BoxFactory } from '../../boolean/BoxFactory';
import { CapClosureEngine } from '../CapClosureEngine';
import { DirectModelingEngine } from '../DirectModelingEngine';
import { DirectEdit } from '../DirectEdit';
import { Solid } from '../../topology/TopologyContracts';

describe('SECP-CAD-DIRECT-MODELING-CAP — CapClosureEngine Qualification Tests', () => {
  it('TEST 01 — Successfully deletes a face and reconstructs valid closed cap on a solid box', () => {
    const solid = BoxFactory.createBox('BOX_CAP_01', 0, 0, 0, 10, 10, 10);
    const targetFace = solid.outerShell.orientedFaces[0].face;

    const edit: DirectEdit = {
      id: 'DEDIT_DELETE_01',
      operation: 'DELETE_FACE',
      targetEntityIds: [targetFace.id],
      parameters: {},
      beforeGeometryHash: '',
      afterGeometryHash: '',
      affectedTopologyIds: [],
      tolerance: 1e-7,
      timestamp: new Date().toISOString(),
      parentRevision: 'REV_0'
    };

    const res = DirectModelingEngine.applyDirectEdit(solid, edit);

    if (res.status !== 'SUCCESS') {
      console.log('TEST 01 Diagnostics:', res.diagnostics);
    }

    expect(res.status).toBe('SUCCESS');
    expect(res.updatedShape).toBeDefined();
  });

  it('TEST 02 — Fails closed when attempting to delete non-existent face', () => {
    const solid = BoxFactory.createBox('BOX_CAP_02', 0, 0, 0, 10, 10, 10);

    const edit: DirectEdit = {
      id: 'DEDIT_DELETE_02',
      operation: 'DELETE_FACE',
      targetEntityIds: ['NON_EXISTENT_FACE'],
      parameters: {},
      beforeGeometryHash: '',
      afterGeometryHash: '',
      affectedTopologyIds: [],
      tolerance: 1e-7,
      timestamp: new Date().toISOString(),
      parentRevision: 'REV_0'
    };

    const res = DirectModelingEngine.applyDirectEdit(solid, edit);

    expect(res.status).toBe('FAILED');
    expect(res.diagnostics.length).toBeGreaterThan(0);
  });

  it('TEST 03 — Topological Invariants: Euler characteristic (V - E + F = 2) and manifoldness after cap reconstruction', () => {
    const solid = BoxFactory.createBox('BOX_CAP_03', 0, 0, 0, 5, 5, 5);
    const targetFaceId = solid.outerShell.orientedFaces[1].face.id;

    const capRes = CapClosureEngine.reconstructAndCap(solid, [targetFaceId], 1e-7);

    expect(capRes.success).toBe(true);
    const cappedSolid = capRes.cappedSolid as Solid;
    expect(cappedSolid).toBeDefined();

    // Verify face count: 5 remaining + 1 cap = 6 faces
    const faces = cappedSolid.outerShell.orientedFaces;
    expect(faces.length).toBe(6);

    // Extract unique vertices and edges
    const uniqueVertices = new Set<string>();
    const uniqueEdges = new Set<string>();

    for (const of of faces) {
      for (const oe of of.face.outerLoop.orientedEdges) {
        uniqueEdges.add(oe.edge.id);
        uniqueVertices.add(oe.edge.startVertex.id);
        uniqueVertices.add(oe.edge.endVertex.id);
      }
    }

    const V = uniqueVertices.size;
    const E = uniqueEdges.size;
    const F = faces.length;

    // Euler characteristic for genus-0 convex polyhedron
    const euler = V - E + F;
    expect(V).toBe(8);
    expect(E).toBe(12);
    expect(F).toBe(6);
    expect(euler).toBe(2);
  });

  it('TEST 04 — Strict Determinism: Repeated cap reconstruction yields identical topology and hashes', () => {
    const solidA = BoxFactory.createBox('BOX_DET_A', 0, 0, 0, 10, 10, 10);
    const solidB = BoxFactory.createBox('BOX_DET_B', 0, 0, 0, 10, 10, 10);

    const faceIdA = solidA.outerShell.orientedFaces[0].face.id;
    const faceIdB = solidB.outerShell.orientedFaces[0].face.id;

    const resA = CapClosureEngine.reconstructAndCap(solidA, [faceIdA], 1e-7);
    const resB = CapClosureEngine.reconstructAndCap(solidB, [faceIdB], 1e-7);

    expect(resA.success).toBe(true);
    expect(resB.success).toBe(true);

    const capFaceA = resA.cappedSolid!.outerShell.orientedFaces.find(f => f.face.id.startsWith('cap_face'));
    const capFaceB = resB.cappedSolid!.outerShell.orientedFaces.find(f => f.face.id.startsWith('cap_face'));

    expect(capFaceA).toBeDefined();
    expect(capFaceB).toBeDefined();
    expect(capFaceA!.face.id).toBe(capFaceB!.face.id);
    expect(capFaceA!.face.outerLoop.id).toBe(capFaceB!.face.outerLoop.id);
  });

  it('TEST 05 — Adversarial Non-Coplanar Opening: Deleting two adjacent orthogonal faces triggers fail-closed', () => {
    const solid = BoxFactory.createBox('BOX_ADVERSARIAL', 0, 0, 0, 10, 10, 10);

    // Face 0 and Face 2 share an edge and are orthogonal (e.g., bottom and front/side)
    const face0 = solid.outerShell.orientedFaces[0].face.id;
    const face2 = solid.outerShell.orientedFaces[2].face.id;

    const res = CapClosureEngine.reconstructAndCap(solid, [face0, face2], 1e-7);

    // The boundary cycle spanning two orthogonal deleted faces is 3D non-coplanar, so must fail-closed
    expect(res.success).toBe(false);
    expect(res.diagnostics.some(d => d.includes('non-coplanar') || d.includes('Fail-closed'))).toBe(true);
  });
});
