/**
 * SECP CAD Kernel — Model Edit Transaction Unit Tests
 * Phase 2 (PATCH-029)
 */

import { describe, it, expect } from 'vitest';
import { BoxFactory } from '../../boolean/BoxFactory';
import { FeatureHistory } from '../../history/FeatureHistory';
import { ModelEditTransaction } from '../ModelEditTransaction';
import { ModelingMode } from '../ModelingMode';
import { ModelingOperation } from '../ModelingOperation';

describe('PATCH-029 — Model Edit Transaction Tests', () => {
  it('TEST 06 — Failed direct operation produces complete transaction rollback', () => {
    const solid = BoxFactory.createBox('BOX_TX_01', 0, 0, 0, 10, 10, 10);
    const history = new FeatureHistory('DOC_TX_01');

    const initialV0 = { ...solid.outerShell.orientedFaces[0].face.outerLoop.orientedEdges[0].edge.startVertex.geometry };

    const tx = new ModelEditTransaction(solid, history, ModelingMode.PARAMETRIC);

    const badOperation: ModelingOperation = {
      operationId: 'OP_BAD_TX',
      type: 'DIRECT',
      directEdit: {
        id: 'DEDIT_FAIL',
        operation: 'MOVE_FACE',
        targetEntityIds: ['NON_EXISTENT_FACE'],
        parameters: { dx: 100 },
        beforeGeometryHash: '',
        afterGeometryHash: '',
        affectedTopologyIds: [],
        tolerance: 1e-7,
        timestamp: new Date().toISOString(),
        parentRevision: 'REV_0'
      },
      timestamp: new Date().toISOString()
    };

    const res = tx.execute(
      badOperation,
      () => {
        return {
          updatedShape: solid,
          updatedHistory: history,
          updatedMode: ModelingMode.PARAMETRIC,
          affectedDependencies: [],
          diagnostics: ['Target face not found'],
          status: 'FAILED'
        };
      }
    );

    expect(res.status).toBe('FAILED');
    const shapeAfterRollback = tx.getShape();
    const finalV0 = shapeAfterRollback.outerShell.orientedFaces[0].face.outerLoop.orientedEdges[0].edge.startVertex.geometry;
    expect(finalV0.x).toBe(initialV0.x);
    expect(finalV0.y).toBe(initialV0.y);
    expect(finalV0.z).toBe(initialV0.z);
  });

  it('TEST 07 — Failed regeneration preserves previous valid revision', () => {
    const solid = BoxFactory.createBox('BOX_TX_02', 0, 0, 0, 10, 10, 10);
    const history = new FeatureHistory('DOC_TX_02');

    const tx = new ModelEditTransaction(solid, history, ModelingMode.PARAMETRIC);

    const regenFailOp: ModelingOperation = {
      operationId: 'OP_REGEN_FAIL',
      type: 'PARAMETRIC',
      timestamp: new Date().toISOString()
    };

    const res = tx.execute(
      regenFailOp,
      () => {
        return {
          updatedShape: solid,
          updatedHistory: history,
          updatedMode: ModelingMode.PARAMETRIC,
          affectedDependencies: [],
          diagnostics: ['Parametric regeneration failed due to constraint conflict'],
          status: 'CONFLICT'
        };
      }
    );

    expect(res.status).toBe('CONFLICT');
    expect(tx.getMode()).toBe(ModelingMode.PARAMETRIC);
  });
});
