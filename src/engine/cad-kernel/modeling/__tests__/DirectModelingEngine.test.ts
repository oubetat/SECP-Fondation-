/**
 * SECP CAD Kernel — Direct Modeling Engine Unit Tests
 * Phase 2 (PATCH-029)
 */

import { describe, it, expect } from 'vitest';
import { BoxFactory } from '../../boolean/BoxFactory';
import { DirectModelingEngine } from '../DirectModelingEngine';
import { DirectEdit } from '../DirectEdit';

describe('PATCH-029 — Direct Modeling Engine Tests', () => {
  it('TEST 02 — Direct face modification updates actual B-Rep coordinates', () => {
    const solid = BoxFactory.createBox('BOX_01', -10, -10, -10, 10, 10, 10);
    const targetFace = solid.outerShell.orientedFaces[0].face;

    const edit: DirectEdit = {
      id: 'DEDIT_01',
      operation: 'MOVE_FACE',
      targetEntityIds: [targetFace.id],
      parameters: { dx: 5, dy: 0, dz: 0 },
      beforeGeometryHash: '',
      afterGeometryHash: '',
      affectedTopologyIds: [],
      tolerance: 1e-7,
      timestamp: new Date().toISOString(),
      parentRevision: 'REV_0'
    };

    const res = DirectModelingEngine.applyDirectEdit(solid, edit);

    expect(res.status).toBe('SUCCESS');
    expect(res.beforeGeometryHash).not.toBe('');
    expect(res.afterGeometryHash).not.toBe('');
    expect(res.beforeGeometryHash).not.toBe(res.afterGeometryHash);
    expect(res.affectedTopologyIds.length).toBeGreaterThan(0);
  });

  it('TEST 11 — Geometry hash changes after actual geometric modification', () => {
    const solid = BoxFactory.createBox('BOX_02', 0, 0, 0, 20, 20, 20);
    const targetFace = solid.outerShell.orientedFaces[0].face;

    const edit: DirectEdit = {
      id: 'DEDIT_OFFSET',
      operation: 'OFFSET_FACE',
      targetEntityIds: [targetFace.id],
      parameters: { distance: 10 },
      beforeGeometryHash: '',
      afterGeometryHash: '',
      affectedTopologyIds: [],
      tolerance: 1e-7,
      timestamp: new Date().toISOString(),
      parentRevision: 'REV_0'
    };

    const res = DirectModelingEngine.applyDirectEdit(solid, edit);

    expect(res.status).toBe('SUCCESS');
    expect(res.beforeGeometryHash).not.toBe(res.afterGeometryHash);
  });

  it('TEST 12 — No-op operation does not produce geometry hash change', () => {
    const solid = BoxFactory.createBox('BOX_03', 0, 0, 0, 10, 10, 10);
    const targetFace = solid.outerShell.orientedFaces[0].face;

    const edit: DirectEdit = {
      id: 'DEDIT_NOOP',
      operation: 'MOVE_FACE',
      targetEntityIds: [targetFace.id],
      parameters: { dx: 0, dy: 0, dz: 0 },
      beforeGeometryHash: '',
      afterGeometryHash: '',
      affectedTopologyIds: [],
      tolerance: 1e-7,
      timestamp: new Date().toISOString(),
      parentRevision: 'REV_0'
    };

    const res = DirectModelingEngine.applyDirectEdit(solid, edit);

    expect(res.status).toBe('SUCCESS');
    expect(res.beforeGeometryHash).toBe(res.afterGeometryHash);
  });

  it('TEST 13 — Topology hash remains stable when topology is genuinely unchanged', () => {
    const solid = BoxFactory.createBox('BOX_04', 0, 0, 0, 10, 10, 10);
    const targetFace = solid.outerShell.orientedFaces[0].face;

    const edit: DirectEdit = {
      id: 'DEDIT_MOVE',
      operation: 'MOVE_FACE',
      targetEntityIds: [targetFace.id],
      parameters: { dx: 2, dy: 2, dz: 2 },
      beforeGeometryHash: '',
      afterGeometryHash: '',
      affectedTopologyIds: [],
      tolerance: 1e-7,
      timestamp: new Date().toISOString(),
      parentRevision: 'REV_0'
    };

    const res = DirectModelingEngine.applyDirectEdit(solid, edit);

    expect(res.status).toBe('SUCCESS');
    expect(res.beforeTopologyHash).toBe(res.afterTopologyHash);
  });

  it('ADVERSARIAL — Invalid target entity ID is rejected', () => {
    const solid = BoxFactory.createBox('BOX_05', 0, 0, 0, 10, 10, 10);

    const edit: DirectEdit = {
      id: 'DEDIT_BAD_ID',
      operation: 'MOVE_FACE',
      targetEntityIds: ['NON_EXISTENT_FACE_ID'],
      parameters: { dx: 5, dy: 0, dz: 0 },
      beforeGeometryHash: '',
      afterGeometryHash: '',
      affectedTopologyIds: [],
      tolerance: 1e-7,
      timestamp: new Date().toISOString(),
      parentRevision: 'REV_0'
    };

    const res = DirectModelingEngine.applyDirectEdit(solid, edit);

    expect(res.status).toBe('FAILED');
    expect(res.diagnostics.some(d => d.includes('not found'))).toBe(true);
  });

  it('ADVERSARIAL — Non-finite parameter value is rejected', () => {
    const solid = BoxFactory.createBox('BOX_06', 0, 0, 0, 10, 10, 10);
    const targetFace = solid.outerShell.orientedFaces[0].face;

    const edit: DirectEdit = {
      id: 'DEDIT_NAN',
      operation: 'MOVE_FACE',
      targetEntityIds: [targetFace.id],
      parameters: { dx: NaN, dy: 0, dz: 0 },
      beforeGeometryHash: '',
      afterGeometryHash: '',
      affectedTopologyIds: [],
      tolerance: 1e-7,
      timestamp: new Date().toISOString(),
      parentRevision: 'REV_0'
    };

    const res = DirectModelingEngine.applyDirectEdit(solid, edit);

    expect(res.status).toBe('FAILED');
    expect(res.diagnostics.some(d => d.includes('non-finite'))).toBe(true);
  });
});
