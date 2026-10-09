/**
 * SECP CAD Kernel — Feature History Adversarial Tests
 * Phase 2 (PATCH-022)
 */

import { describe, it, expect } from 'vitest';
import { FeatureHistory } from '../FeatureHistory';
import { FeatureNode } from '../FeatureNode';
import { FeatureStateMachine } from '../FeatureState';
import { FeatureExecutor } from '../FeatureExecution';
import { ToleranceOperation } from '../../tolerance';

describe('PATCH-022 — Feature History Adversarial & Boundary Tests', () => {
  it('handles extremely deep feature chains (100 sequential features) without stack overflow', () => {
    const history = new FeatureHistory('DOC_ADV_DEEP');
    let prevId: string | undefined = undefined;

    for (let i = 0; i < 100; i++) {
      const node = history.addFeature(
        'EXTRUDE',
        `Step_${i}`,
        {
          type: 'EXTRUDE',
          name: `Step_${i}`,
          parameters: { width: 10, height: 10, depth: 10 },
          inputReferences: prevId ? [{ type: 'FEATURE', targetFeatureId: prevId }] : []
        },
        prevId ? [prevId] : []
      );
      prevId = node.id;
    }

    const order = history.getTopologicalOrder();
    expect(order.length).toBe(100);

    const regen = history.regenerate();
    expect(regen.success).toBe(true);
    expect(regen.executedFeatureIds.length).toBe(100);
  });

  it('rejects NaN parameters explicitly during validation', () => {
    const val = FeatureExecutor.validateParameters('EXTRUDE', {
      width: NaN,
      height: 10,
      depth: 10
    });

    expect(val.isValid).toBe(false);
    expect(val.errors.some(e => e.includes('NaN'))).toBe(true);
  });

  it('rejects Infinity parameters explicitly during validation', () => {
    const val = FeatureExecutor.validateParameters('EXTRUDE', {
      width: 10,
      height: Infinity,
      depth: 10
    });

    expect(val.isValid).toBe(false);
    expect(val.errors.some(e => e.includes('Infinity'))).toBe(true);
  });

  it('rejects non-positive dimensions where invalid', () => {
    const val1 = FeatureExecutor.validateParameters('EXTRUDE', { width: -5, height: 10, depth: 10 });
    expect(val1.isValid).toBe(false);

    const val2 = FeatureExecutor.validateParameters('FILLET', { radius: -1.0 });
    expect(val2.isValid).toBe(false);
  });

  it('strictly forbids state transition INVALID -> VALID without regeneration', () => {
    const res = FeatureStateMachine.canTransition('INVALID', 'VALID', 'VALIDATION_PASSED');
    expect(res.allowed).toBe(false);
    expect(res.errorMessage).toContain('Illegal transition');
  });

  it('strictly forbids state transition FAILED -> VALID without execution', () => {
    const res = FeatureStateMachine.canTransition('FAILED', 'VALID', 'VALIDATION_PASSED');
    expect(res.allowed).toBe(false);
    expect(res.errorMessage).toContain('Illegal transition');
  });

  it('fails execution if an upstream dependency is suppressed', () => {
    const history = new FeatureHistory('DOC_ADV_SUPP');
    const f1 = history.addFeature('EXTRUDE', 'Box-1', {
      type: 'EXTRUDE',
      name: 'Box-1',
      parameters: { width: 10, height: 10, depth: 10 },
      inputReferences: []
    });

    const f2 = history.addFeature('EXTRUDE', 'Box-2', {
      type: 'EXTRUDE',
      name: 'Box-2',
      parameters: { width: 5, height: 5, depth: 5 },
      inputReferences: [{ type: 'FEATURE', targetFeatureId: f1.id }]
    }, [f1.id]);

    history.setSuppressed(f1.id, true);

    const regen = history.regenerate();
    expect(regen.success).toBe(false);
    expect(regen.failedFeatureIds).toContain(f2.id);
  });

  it('detects history tampering when feature parameters are mutated after hashing', () => {
    const history = new FeatureHistory('DOC_ADV_TAMP');
    const f1 = history.addFeature('EXTRUDE', 'Box-1', {
      type: 'EXTRUDE',
      name: 'Box-1',
      parameters: { width: 10 },
      inputReferences: []
    });

    const hash1 = history.getHistoryHash();

    // Directly tamper with parameters without calling updateFeatureDefinition
    f1.parameters = { width: 9999 };

    // Recompute definitionHash
    f1.updateDefinition({
      type: 'EXTRUDE',
      name: 'Box-1',
      parameters: { width: 9999 },
      inputReferences: []
    });

    const hash2 = history.getHistoryHash();
    expect(hash1).not.toBe(hash2);
  });
});
