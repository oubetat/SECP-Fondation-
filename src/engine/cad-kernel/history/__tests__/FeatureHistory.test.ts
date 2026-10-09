/**
 * SECP CAD Kernel — Feature History Subsystem Unit Tests
 * Phase 2 (PATCH-022)
 */

import { describe, it, expect } from 'vitest';
import { FeatureHistory } from '../FeatureHistory';
import { FeatureNode } from '../FeatureNode';
import { FeatureStateMachine } from '../FeatureState';
import { FeatureHistoryEvidence } from '../FeatureHistoryEvidence';
import { ToleranceOperation } from '../../tolerance';

describe('PATCH-022 — Feature History Subsystem', () => {
  // A. Feature identity determinism
  it('A. generates deterministic feature IDs for identical definitions', () => {
    const history1 = new FeatureHistory('DOC_DET_001');
    const f1 = history1.addFeature('SKETCH', 'Profile-1', {
      type: 'SKETCH',
      name: 'Profile-1',
      parameters: { plane: 'XY', entities: [], closedProfile: true },
      inputReferences: []
    });

    const history2 = new FeatureHistory('DOC_DET_001');
    const f2 = history2.addFeature('SKETCH', 'Profile-1', {
      type: 'SKETCH',
      name: 'Profile-1',
      parameters: { plane: 'XY', entities: [], closedProfile: true },
      inputReferences: []
    });

    expect(f1.id).toBe(f2.id);
  });

  // B. Dependency ordering
  it('B. enforces that dependencies execute before dependents in topological order', () => {
    const history = new FeatureHistory('DOC_DEP_001');
    const sketch = history.addFeature('SKETCH', 'Sketch-1', {
      type: 'SKETCH',
      name: 'Sketch-1',
      parameters: { plane: 'XY', entities: [], closedProfile: true },
      inputReferences: []
    });

    const extrude = history.addFeature('EXTRUDE', 'Extrude-1', {
      type: 'EXTRUDE',
      name: 'Extrude-1',
      parameters: { width: 10, height: 10, depth: 10 },
      inputReferences: [{ type: 'SKETCH', targetFeatureId: sketch.id }]
    }, [sketch.id]);

    const fillet = history.addFeature('FILLET', 'Fillet-1', {
      type: 'FILLET',
      name: 'Fillet-1',
      parameters: { radius: 2.0 },
      inputReferences: [{ type: 'FEATURE', targetFeatureId: extrude.id }]
    }, [extrude.id]);

    const order = history.getTopologicalOrder();
    expect(order).toEqual([sketch.id, extrude.id, fillet.id]);
  });

  // C. Circular dependency detection
  it('C. fails explicitly on circular dependencies (A -> B -> A)', () => {
    const history = new FeatureHistory('DOC_CIRC_001');
    const f1 = history.addFeature('EXTRUDE', 'F1', {
      type: 'EXTRUDE',
      name: 'F1',
      parameters: { width: 10 },
      inputReferences: []
    });

    const f2 = history.addFeature('EXTRUDE', 'F2', {
      type: 'EXTRUDE',
      name: 'F2',
      parameters: { width: 10 },
      inputReferences: []
    });

    // Manually introduce cycle
    history.getGraph().addDependency(f1.id, f2.id);
    history.getGraph().addDependency(f2.id, f1.id);

    const val = history.validate();
    expect(val.isValid).toBe(false);
    expect(val.errors.some(e => e.includes('Circular dependency'))).toBe(true);
    expect(() => history.getTopologicalOrder()).toThrow();
  });

  // D. Self dependency
  it('D. fails explicitly on self-dependency (A -> A)', () => {
    const history = new FeatureHistory('DOC_SELF_001');
    const f1 = history.addFeature('EXTRUDE', 'F1', {
      type: 'EXTRUDE',
      name: 'F1',
      parameters: { width: 10 },
      inputReferences: []
    });

    history.getGraph().addDependency(f1.id, f1.id);
    const val = history.validate();
    expect(val.isValid).toBe(false);
    expect(val.errors.some(e => e.includes('cannot depend on itself'))).toBe(true);
  });

  // E. Missing dependency
  it('E. fails explicitly when referencing a non-existent feature', () => {
    const history = new FeatureHistory('DOC_MISSING_001');
    history.addFeature('EXTRUDE', 'F1', {
      type: 'EXTRUDE',
      name: 'F1',
      parameters: { width: 10 },
      inputReferences: [{ type: 'FEATURE', targetFeatureId: 'NON_EXISTENT_ID' }]
    }, ['NON_EXISTENT_ID']);

    const val = history.validate();
    expect(val.isValid).toBe(false);
    expect(val.errors.some(e => e.includes('depends on non-existent feature'))).toBe(true);
  });

  // F. Duplicate feature ID
  it('F. fails explicitly when adding a duplicate Feature ID', () => {
    const history = new FeatureHistory('DOC_DUP_001');
    const node = new FeatureNode({
      id: 'SECP:GEOMETRY:feat_duplicate_001',
      documentId: 'DOC_DUP_001',
      type: 'EXTRUDE',
      name: 'Dup-1',
      definition: {
        type: 'EXTRUDE',
        name: 'Dup-1',
        parameters: { width: 10 },
        inputReferences: []
      },
      sequence: 1
    });

    history.addNode(node);
    expect(() => history.addNode(node)).toThrow(/Duplicate feature ID/);
  });

  // G. Deterministic topological order
  it('G. produces identical topological execution order regardless of insertion order', () => {
    // History 1: Add Root -> Sketch -> Extrude
    const h1 = new FeatureHistory('DOC_TIE_001');
    const r1 = h1.addFeature('ROOT', 'Root', { type: 'ROOT', name: 'Root', parameters: {}, inputReferences: [] });
    const s1 = h1.addFeature('SKETCH', 'Sketch', { type: 'SKETCH', name: 'Sketch', parameters: {}, inputReferences: [] }, [r1.id]);
    const e1 = h1.addFeature('EXTRUDE', 'Extrude', { type: 'EXTRUDE', name: 'Extrude', parameters: { width: 10 }, inputReferences: [] }, [s1.id]);

    const order1 = h1.getTopologicalOrder();

    // History 2: Add nodes in reverse order
    const h2 = new FeatureHistory('DOC_TIE_001');
    h2.addNode(e1);
    h2.addNode(s1);
    h2.addNode(r1);

    const order2 = h2.getTopologicalOrder();
    expect(order1).toEqual(order2);
  });

  // H. Parameter modification
  it('H. marks feature STALE upon parameter modification', () => {
    const history = new FeatureHistory('DOC_MUT_001');
    const ext = history.addFeature('EXTRUDE', 'Extrude-1', {
      type: 'EXTRUDE',
      name: 'Extrude-1',
      parameters: { width: 10, height: 10, depth: 10 },
      inputReferences: []
    });

    // Initial regeneration
    const regen1 = history.regenerate();
    expect(regen1.success).toBe(true);
    expect(ext.state).toBe('VALID');

    // Mutate parameter
    history.updateFeatureDefinition(ext.id, {
      type: 'EXTRUDE',
      name: 'Extrude-1',
      parameters: { width: 20, height: 10, depth: 10 },
      inputReferences: []
    });

    expect(ext.state).toBe('STALE');
  });

  // I. Dependency invalidation
  it('I. propagates invalidation to downstream features when upstream is modified', () => {
    const history = new FeatureHistory('DOC_INV_001');
    const sketch = history.addFeature('SKETCH', 'Sketch-1', {
      type: 'SKETCH',
      name: 'Sketch-1',
      parameters: { plane: 'XY', entities: [], closedProfile: true },
      inputReferences: []
    });

    const extrude = history.addFeature('EXTRUDE', 'Extrude-1', {
      type: 'EXTRUDE',
      name: 'Extrude-1',
      parameters: { width: 10, height: 10, depth: 10 },
      inputReferences: [{ type: 'SKETCH', targetFeatureId: sketch.id }]
    }, [sketch.id]);

    const fillet = history.addFeature('FILLET', 'Fillet-1', {
      type: 'FILLET',
      name: 'Fillet-1',
      parameters: { radius: 2.0 },
      inputReferences: [{ type: 'FEATURE', targetFeatureId: extrude.id }]
    }, [extrude.id]);

    history.regenerate();
    expect(sketch.state).toBe('VALID');
    expect(extrude.state).toBe('VALID');
    expect(fillet.state).toBe('VALID');

    // Mutate Sketch
    history.updateFeatureDefinition(sketch.id, {
      type: 'SKETCH',
      name: 'Sketch-1',
      parameters: { plane: 'XZ', entities: [], closedProfile: true },
      inputReferences: []
    });

    expect(sketch.state).toBe('STALE');
    expect(extrude.state).toBe('STALE');
    expect(fillet.state).toBe('STALE');
  });

  // J. Incremental regeneration
  it('J. performs incremental regeneration without re-executing unchanged valid features', () => {
    const history = new FeatureHistory('DOC_INC_001');
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

    // Initial full regeneration
    const res1 = history.regenerate();
    expect(res1.executedFeatureIds.length).toBe(2);

    // Update only Box-2
    history.updateFeatureDefinition(f2.id, {
      type: 'EXTRUDE',
      name: 'Box-2',
      parameters: { width: 8, height: 8, depth: 8 },
      inputReferences: [{ type: 'FEATURE', targetFeatureId: f1.id }]
    });

    // Regenerate incrementally
    const res2 = history.regenerate();
    expect(res2.skippedFeatureIds).toContain(f1.id);
    expect(res2.executedFeatureIds).toContain(f2.id);
  });

  // K. Suppression
  it('K. skips execution of suppressed features', () => {
    const history = new FeatureHistory('DOC_SUPP_001');
    const f1 = history.addFeature('EXTRUDE', 'Box-1', {
      type: 'EXTRUDE',
      name: 'Box-1',
      parameters: { width: 10, height: 10, depth: 10 },
      inputReferences: []
    });

    history.setSuppressed(f1.id, true);
    expect(f1.state).toBe('SUPPRESSED');

    const res = history.regenerate();
    expect(res.skippedFeatureIds).toContain(f1.id);
  });

  // L. Rollback
  it('L. performs logical rollback to Feature-N without destroying history structure', () => {
    const history = new FeatureHistory('DOC_RB_001');
    const f1 = history.addFeature('EXTRUDE', 'F1', { type: 'EXTRUDE', name: 'F1', parameters: { width: 10 }, inputReferences: [] });
    const f2 = history.addFeature('EXTRUDE', 'F2', { type: 'EXTRUDE', name: 'F2', parameters: { width: 10 }, inputReferences: [] }, [f1.id]);
    const f3 = history.addFeature('EXTRUDE', 'F3', { type: 'EXTRUDE', name: 'F3', parameters: { width: 10 }, inputReferences: [] }, [f2.id]);

    history.setRollbackTarget(f2.id);
    const res = history.regenerate();

    expect(res.executedFeatureIds).toContain(f1.id);
    expect(res.executedFeatureIds).toContain(f2.id);
    expect(res.executedFeatureIds).not.toContain(f3.id);
    expect(history.getAllFeatures().length).toBe(3); // History structure intact
  });

  // M. History hash & N. History mutation
  it('M & N. computes deterministic history hash and detects history mutations', () => {
    const history = new FeatureHistory('DOC_HASH_001');
    const f1 = history.addFeature('EXTRUDE', 'F1', { type: 'EXTRUDE', name: 'F1', parameters: { width: 10 }, inputReferences: [] });

    const hashBefore = history.getHistoryHash();
    expect(hashBefore).toBeDefined();

    // Mutate feature definition
    history.updateFeatureDefinition(f1.id, {
      type: 'EXTRUDE',
      name: 'F1',
      parameters: { width: 25 },
      inputReferences: []
    });

    const hashAfter = history.getHistoryHash();
    expect(hashBefore).not.toBe(hashAfter);
  });

  // O. Timestamp independence
  it('O. ensures feature identity and history hash are independent of wall-clock time', () => {
    const history1 = new FeatureHistory('DOC_TIME_001');
    const f1 = history1.addFeature('SKETCH', 'Sketch-1', {
      type: 'SKETCH',
      name: 'Sketch-1',
      parameters: { plane: 'XY' },
      inputReferences: []
    });

    // Simulate time passing by re-instantiating with identical canonical definition
    const history2 = new FeatureHistory('DOC_TIME_001');
    const f2 = history2.addFeature('SKETCH', 'Sketch-1', {
      type: 'SKETCH',
      name: 'Sketch-1',
      parameters: { plane: 'XY' },
      inputReferences: []
    });

    expect(f1.id).toBe(f2.id);
    expect(history1.getHistoryHash()).toBe(history2.getHistoryHash());
  });

  // P. Tolerance integration
  it('P. executes features with explicit ToleranceContext', () => {
    const history = new FeatureHistory('DOC_TOL_001');
    const f1 = history.addFeature('EXTRUDE', 'F1', {
      type: 'EXTRUDE',
      name: 'F1',
      parameters: { width: 10, height: 10, depth: 10 },
      inputReferences: []
    });

    const res = history.regenerate({
      toleranceContext: {
        operation: ToleranceOperation.BOOLEAN,
        geometryScale: 1.0,
        unitSystem: 'mm',
        requestedTolerance: 1e-6,
        policy: 'STRICT_INDUSTRIAL'
      }
    });

    expect(res.success).toBe(true);
  });

  // Q. Provenance
  it('Q. generates traceable evidence and provenance for feature history', () => {
    const history = new FeatureHistory('DOC_PROV_001');
    history.addFeature('EXTRUDE', 'F1', { type: 'EXTRUDE', name: 'F1', parameters: { width: 10 }, inputReferences: [] });

    const regen = history.regenerate();
    const evidence = history.generateEvidence(regen);

    expect(evidence.patchId).toBe('PATCH-022');
    expect(evidence.evidenceHash).toBeDefined();
    expect(evidence.historyHash).toBeDefined();
  });
});
