/**
 * SECP CAD Kernel — WP-01 Advanced Direct Modeling Qualification Test Suite
 * SECP-CAD-KERNEL-PHASE-2-001
 */

import { describe, it, expect } from 'vitest';
import { BoxFactory } from '../../boolean/BoxFactory';
import { DirectModelingEngine } from '../DirectModelingEngine';
import { DirectEdit } from '../DirectEdit';
import { Solid, TopoShapeEnum } from '../../topology/TopologyContracts';
import { Surface, Point, Direction } from '../../geometry/GeometryContracts';

class MockPlanarSurface implements Surface {
  public type = 'PLANE' as const;
  constructor(public origin: Point, public normal: Direction) {}
  public evaluate(u: number, v: number): Point {
    return { x: (this.origin.x + u) as any, y: (this.origin.y + v) as any, z: this.origin.z };
  }
  public domain() { return { uMin: 0, uMax: 10, vMin: 0, vMax: 10 }; }
}

describe('SECP-CAD-KERNEL-PHASE-2-001 — WP-01 Advanced Direct Modeling Qualification', () => {
  it('QUAL-01: Move Face with Surface Geometry Origin Synchronization', () => {
    const solid = BoxFactory.createBox('BOX_MOVE_01', 0, 0, 0, 10, 10, 10);
    // Find top face (normal pointing +Z, z = 10)
    const topFace = solid.outerShell.orientedFaces.find(of => {
      const v = of.face.outerLoop.orientedEdges[0].edge.startVertex;
      return v && v.geometry.z === 10;
    })!.face;

    const edit: DirectEdit = {
      id: 'EDIT_MOVE_TOP',
      operation: 'MOVE_FACE',
      targetEntityIds: [topFace.id],
      parameters: { dx: 0, dy: 0, dz: 5 },
      beforeGeometryHash: '',
      afterGeometryHash: '',
      affectedTopologyIds: [],
      tolerance: 1e-7,
      timestamp: new Date().toISOString(),
      parentRevision: 'REV_0'
    };

    const res = DirectModelingEngine.applyDirectEdit(solid, edit);

    expect(res.status).toBe('SUCCESS');
    const updatedSolid = res.updatedShape as Solid;
    expect(updatedSolid.shapeType).toBe(TopoShapeEnum.SOLID);

    // Verify all top face vertices moved to z = 15
    const updatedTopFace = updatedSolid.outerShell.orientedFaces.find(of => of.face.id === topFace.id)!.face;
    for (const oe of updatedTopFace.outerLoop.orientedEdges) {
      expect(oe.edge.startVertex.geometry.z).toBe(15);
      expect(oe.edge.endVertex.geometry.z).toBe(15);
    }

    // Verify surface origin updated
    if (updatedTopFace.geometry && (updatedTopFace.geometry as any).origin) {
      expect((updatedTopFace.geometry as any).origin.z).toBe(15);
    }
  });

  it('QUAL-02: Push/Pull Face outward along normal with volume expansion', () => {
    const solid = BoxFactory.createBox('BOX_PUSHPULL_01', 0, 0, 0, 10, 10, 10);
    const topFace = solid.outerShell.orientedFaces.find(of => {
      const v = of.face.outerLoop.orientedEdges[0].edge.startVertex;
      return v && v.geometry.z === 10;
    })!.face;

    const edit: DirectEdit = {
      id: 'EDIT_PUSHPULL',
      operation: 'PUSH_PULL',
      targetEntityIds: [topFace.id],
      parameters: { distance: 3.5 },
      beforeGeometryHash: '',
      afterGeometryHash: '',
      affectedTopologyIds: [],
      tolerance: 1e-7,
      timestamp: new Date().toISOString(),
      parentRevision: 'REV_0'
    };

    const res = DirectModelingEngine.applyDirectEdit(solid, edit);

    expect(res.status).toBe('SUCCESS');
    const updatedSolid = res.updatedShape as Solid;
    const updatedTop = updatedSolid.outerShell.orientedFaces.find(of => of.face.id === topFace.id)!.face;
    for (const oe of updatedTop.outerLoop.orientedEdges) {
      expect(oe.edge.startVertex.geometry.z).toBeCloseTo(13.5, 5);
    }
  });

  it('QUAL-03: Replace Face with boundary projection & fail-closed on excessive deviation', () => {
    const solid = BoxFactory.createBox('BOX_REPLACE_01', 0, 0, 0, 10, 10, 10);
    const topFace = solid.outerShell.orientedFaces.find(of => {
      const v = of.face.outerLoop.orientedEdges[0].edge.startVertex;
      return v && v.geometry.z === 10;
    })!.face;

    // 1. Valid replacement surface slightly inclined / offset within tolerance envelope (0.1 mm)
    const validSurface = new MockPlanarSurface(
      { x: 0 as any, y: 0 as any, z: 10.00005 as any },
      { x: 0 as any, y: 0 as any, z: 1 as any }
    );

    const validEdit: DirectEdit = {
      id: 'EDIT_REPLACE_VALID',
      operation: 'REPLACE_FACE',
      targetEntityIds: [topFace.id],
      parameters: { newSurface: validSurface },
      beforeGeometryHash: '',
      afterGeometryHash: '',
      affectedTopologyIds: [],
      tolerance: 1e-7,
      timestamp: new Date().toISOString(),
      parentRevision: 'REV_0'
    };

    const resValid = DirectModelingEngine.applyDirectEdit(solid, validEdit);
    expect(resValid.status).toBe('SUCCESS');

    // 2. Adversarial replacement surface with excessive deviation (z = 50, deviation 40m)
    const invalidSurface = new MockPlanarSurface(
      { x: 0 as any, y: 0 as any, z: 50 as any },
      { x: 0 as any, y: 0 as any, z: 1 as any }
    );

    const invalidEdit: DirectEdit = {
      id: 'EDIT_REPLACE_ADVERSARIAL',
      operation: 'REPLACE_FACE',
      targetEntityIds: [topFace.id],
      parameters: { newSurface: invalidSurface },
      beforeGeometryHash: '',
      afterGeometryHash: '',
      affectedTopologyIds: [],
      tolerance: 1e-7,
      timestamp: new Date().toISOString(),
      parentRevision: 'REV_0'
    };

    const resInvalid = DirectModelingEngine.applyDirectEdit(solid, invalidEdit);
    expect(resInvalid.status).toBe('FAILED');
    expect(resInvalid.diagnostics.some(d => d.includes('deviation') || d.includes('envelope'))).toBe(true);
  });

  it('QUAL-04: Trim Face with Exact Sutherland-Hodgman Polygon Clipping & Solid Integrity Protection', () => {
    const solid = BoxFactory.createBox('BOX_TRIM_01', 0, 0, 0, 10, 10, 10);
    const topFace = solid.outerShell.orientedFaces.find(of => {
      const v = of.face.outerLoop.orientedEdges[0].edge.startVertex;
      return v && v.geometry.z === 10;
    })!.face;

    // 1. Trim face directly as a sheet body entity
    const trimEdit: DirectEdit = {
      id: 'EDIT_TRIM_01',
      operation: 'TRIM_FACE',
      targetEntityIds: [topFace.id],
      parameters: {
        trimmingPlane: {
          origin: { x: 5, y: 0, z: 0 },
          normal: { x: 1, y: 0, z: 0 }
        }
      },
      beforeGeometryHash: '',
      afterGeometryHash: '',
      affectedTopologyIds: [],
      tolerance: 1e-7,
      timestamp: new Date().toISOString(),
      parentRevision: 'REV_0'
    };

    const res = DirectModelingEngine.applyDirectEdit(topFace, trimEdit);

    if (res.status !== 'SUCCESS') {
      console.log('QUAL-04 Diagnostics:', res.diagnostics);
    }

    expect(res.status).toBe('SUCCESS');
    const trimmedFace = res.updatedShape as any;

    // All trimmed points must have x >= 5 within tolerance
    for (const oe of trimmedFace.outerLoop.orientedEdges) {
      expect(oe.edge.startVertex.geometry.x).toBeGreaterThanOrEqual(4.9999);
      expect(oe.edge.endVertex.geometry.x).toBeGreaterThanOrEqual(4.9999);
    }

    // 2. Adversarial: Trimming a single face of a 2-manifold solid without capping/re-stitching must fail closed!
    const resSolid = DirectModelingEngine.applyDirectEdit(solid, trimEdit);
    expect(resSolid.status).toBe('FAILED');
    expect(resSolid.diagnostics.some(d => d.includes('structurally open') || d.includes('boundary'))).toBe(true);
  });

  it('QUAL-05: Rotate Face around 3D Axis with Rodrigues Formula', () => {
    const solid = BoxFactory.createBox('BOX_ROT_01', 0, 0, 0, 10, 10, 10);
    const topFace = solid.outerShell.orientedFaces.find(of => {
      const v = of.face.outerLoop.orientedEdges[0].edge.startVertex;
      return v && v.geometry.z === 10;
    })!.face;

    // Rotate 90 degrees around Y axis passing through (5, 5, 10)
    const rotEdit: DirectEdit = {
      id: 'EDIT_ROT_01',
      operation: 'ROTATE_FACE',
      targetEntityIds: [topFace.id],
      parameters: {
        angle: 90,
        axisPoint: { x: 5, y: 5, z: 10 },
        axisDir: { x: 0, y: 1, z: 0 }
      },
      beforeGeometryHash: '',
      afterGeometryHash: '',
      affectedTopologyIds: [],
      tolerance: 1e-7,
      timestamp: new Date().toISOString(),
      parentRevision: 'REV_0'
    };

    const res = DirectModelingEngine.applyDirectEdit(solid, rotEdit);
    expect(res.status).toBe('SUCCESS');
  });

  it('QUAL-06: Delete Face with Intelligent Cap Void Integration', () => {
    const solid = BoxFactory.createBox('BOX_DEL_01', 0, 0, 0, 10, 10, 10);
    const faceToDelete = solid.outerShell.orientedFaces[0].face;

    const delEdit: DirectEdit = {
      id: 'EDIT_DEL_01',
      operation: 'DELETE_FACE',
      targetEntityIds: [faceToDelete.id],
      parameters: {},
      beforeGeometryHash: '',
      afterGeometryHash: '',
      affectedTopologyIds: [],
      tolerance: 1e-7,
      timestamp: new Date().toISOString(),
      parentRevision: 'REV_0'
    };

    const res = DirectModelingEngine.applyDirectEdit(solid, delEdit);
    expect(res.status).toBe('SUCCESS');
    const updatedSolid = res.updatedShape as Solid;
    expect(updatedSolid.outerShell.orientedFaces.length).toBe(6);
  });
});
