import { describe, it, expect } from 'vitest';
import { DirectModelingEngine } from '../modeling/DirectModelingEngine';
import { DirectEdit } from '../modeling/DirectEdit';
import { BoxFactory } from '../boolean/BoxFactory';
import { TopoShapeEnum, Solid } from '../topology/TopologyContracts';

describe('WP-01: Advanced Direct Modeling Qualification', () => {
  it('CAP_DIRECT_MOVE_FACE: moves face vertices correctly', () => {
    const box = BoxFactory.createBox('BOX_MOVE', -10, -10, 0, 20, 20, 10);
    // Box coordinates in this environment are used as-is (BoxFactory uses asM which is a cast)
    
    const topFaceId = box.outerShell.orientedFaces.find(of => {
      const zSum = of.face.outerLoop.orientedEdges.reduce((sum, oe) => sum + oe.edge.startVertex.geometry.z, 0);
      const zAvg = zSum / of.face.outerLoop.orientedEdges.length;
      return Math.abs(zAvg - 10) < 1e-4;
    })?.face.id;

    expect(topFaceId).toBeDefined();

    const edit: DirectEdit = {
      id: 'EDIT_001',
      operation: 'MOVE_FACE',
      targetEntityIds: [topFaceId!],
      parameters: { dz: 5 }, // Move up 5 units
      beforeGeometryHash: '',
      afterGeometryHash: '',
      affectedTopologyIds: [],
      tolerance: 1e-7,
      timestamp: new Date().toISOString(),
      parentRevision: '1'
    };

    const result = DirectModelingEngine.applyDirectEdit(box, edit);
    expect(result.status).toBe('SUCCESS');
    
    const updatedSolid = result.updatedShape as Solid;
    const movedFace = updatedSolid.outerShell.orientedFaces.find(of => of.face.id === topFaceId)?.face;
    const zSumNew = movedFace!.outerLoop.orientedEdges.reduce((sum, oe) => sum + oe.edge.startVertex.geometry.z, 0);
    const zAvgNew = zSumNew / movedFace!.outerLoop.orientedEdges.length;
    expect(zAvgNew).toBeCloseTo(15, 5);
  });

  it('CAP_DIRECT_ROTATE_FACE: rotates face vertices around an axis', () => {
    const box = BoxFactory.createBox('BOX_ROTATE', -10, -10, 0, 20, 20, 10);
    const rightFaceId = box.outerShell.orientedFaces.find(of => {
      const xSum = of.face.outerLoop.orientedEdges.reduce((sum, oe) => sum + oe.edge.startVertex.geometry.x, 0);
      const xAvg = xSum / of.face.outerLoop.orientedEdges.length;
      return Math.abs(xAvg - 20) < 1e-4;
    })?.face.id;

    expect(rightFaceId).toBeDefined();

    const edit: DirectEdit = {
      id: 'EDIT_002',
      operation: 'ROTATE_FACE',
      targetEntityIds: [rightFaceId!],
      parameters: { 
        angle: 45, 
        axisPoint: { x: 20, y: 0, z: 0 }, 
        axisDir: { x: 0, y: 1, z: 0 } 
      },
      beforeGeometryHash: '',
      afterGeometryHash: '',
      affectedTopologyIds: [],
      tolerance: 1e-7,
      timestamp: new Date().toISOString(),
      parentRevision: '1'
    };

    const result = DirectModelingEngine.applyDirectEdit(box, edit);
    expect(result.status).toBe('SUCCESS');
    expect(result.afterGeometryHash).not.toBe(result.beforeGeometryHash);
  });

  it('CAP_DIRECT_EXTEND_FACE: extends face boundary edges', () => {
    const box = BoxFactory.createBox('BOX_EXTEND', -10, -10, 0, 20, 20, 10);
    const topFaceId = box.outerShell.orientedFaces[0].face.id;

    const edit: DirectEdit = {
      id: 'EDIT_003',
      operation: 'EXTEND_FACE',
      targetEntityIds: [topFaceId],
      parameters: { distance: 0.002 },
      beforeGeometryHash: '',
      afterGeometryHash: '',
      affectedTopologyIds: [],
      tolerance: 1e-7,
      timestamp: new Date().toISOString(),
      parentRevision: '1'
    };

    const result = DirectModelingEngine.applyDirectEdit(box, edit);
    expect(result.status).toBe('SUCCESS');
  });

  it('ADVERSARIAL: fails gracefully if target entity not found', () => {
    const box = BoxFactory.createBox('BOX_MISSING', -10, -10, 0, 20, 20, 10);
    const edit: DirectEdit = {
      id: 'EDIT_004',
      operation: 'MOVE_FACE',
      targetEntityIds: ['NON_EXISTENT_ID'],
      parameters: { dz: 0.005 },
      beforeGeometryHash: '',
      afterGeometryHash: '',
      affectedTopologyIds: [],
      tolerance: 1e-7,
      timestamp: new Date().toISOString(),
      parentRevision: '1'
    };

    const result = DirectModelingEngine.applyDirectEdit(box, edit);
    expect(result.status).toBe('FAILED');
    expect(result.diagnostics.some(d => d.includes('not found'))).toBe(true);
  });
});
