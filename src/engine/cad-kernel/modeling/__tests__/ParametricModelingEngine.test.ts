/**
 * SECP CAD Kernel — Parametric Modeling Engine Unit Tests
 * Phase 2 (PATCH-029)
 */

import { describe, it, expect } from 'vitest';
import { FeatureHistory } from '../../history/FeatureHistory';
import { ParametricModelingEngine } from '../ParametricModelingEngine';
import { ParametricEdit } from '../ParametricEdit';

describe('PATCH-029 — Parametric Modeling Engine Tests', () => {
  it('TEST 01 — Create parametric feature → regenerate → verify geometry', () => {
    const history = new FeatureHistory('DOC_PARAM_01');

    const edit: ParametricEdit = {
      id: 'PEDIT_01',
      operation: 'CREATE_FEATURE',
      featureId: 'EXTRUDE_01',
      featureType: 'EXTRUDE',
      parameterChanges: { minX: 0, minY: 0, minZ: 0, height: 25 },
      dependencies: [],
      affectedEntities: [],
      timestamp: new Date().toISOString()
    };

    const res = ParametricModelingEngine.applyParametricEdit(history, edit);

    expect(res.status).toBe('SUCCESS');
    expect(res.beforeGeometryHash).not.toBe(res.afterGeometryHash);
    expect(history.getFeature('EXTRUDE_01')).toBeDefined();
  });

  it('TEST 01b — Modify parameters propagates changes', () => {
    const history = new FeatureHistory('DOC_PARAM_02');

    const createEdit: ParametricEdit = {
      id: 'PEDIT_CREATE',
      operation: 'CREATE_FEATURE',
      featureId: 'BOX_FEAT',
      featureType: 'EXTRUDE',
      parameterChanges: { minX: 0, minY: 0, minZ: 0, height: 10 },
      dependencies: [],
      affectedEntities: [],
      timestamp: new Date().toISOString()
    };
    ParametricModelingEngine.applyParametricEdit(history, createEdit);

    const modifyEdit: ParametricEdit = {
      id: 'PEDIT_MOD',
      operation: 'MODIFY_PARAMETERS',
      featureId: 'BOX_FEAT',
      parameterChanges: { height: 50 },
      dependencies: [],
      affectedEntities: ['BOX_FEAT'],
      timestamp: new Date().toISOString()
    };

    const res = ParametricModelingEngine.applyParametricEdit(history, modifyEdit);

    expect(res.status).toBe('SUCCESS');
    const feat = history.getFeature('BOX_FEAT');
    expect((feat?.definition.parameters as any).height).toBe(50);
  });

  it('ADVERSARIAL — Non-existent feature modification returns FAILED', () => {
    const history = new FeatureHistory('DOC_PARAM_03');

    const edit: ParametricEdit = {
      id: 'PEDIT_BAD',
      operation: 'MODIFY_PARAMETERS',
      featureId: 'GHOST_FEATURE',
      parameterChanges: { height: 100 },
      dependencies: [],
      affectedEntities: [],
      timestamp: new Date().toISOString()
    };

    const res = ParametricModelingEngine.applyParametricEdit(history, edit);

    expect(res.status).toBe('FAILED');
    expect(res.diagnostics.some(d => d.includes('not found'))).toBe(true);
  });
});
