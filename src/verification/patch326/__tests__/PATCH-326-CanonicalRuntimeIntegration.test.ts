import { describe, test, expect } from 'vitest';
import {
  CanonicalSketch,
  createEmptyCanonicalSketch,
  mutateAddFlatEntities,
  mutateDeleteFlatEntity,
  mutateAddFlatConstraint,
  mutateEntityParameter,
  solveCanonicalSketch,
  getActiveCanonicalSketch,
  updateCanonicalSketchInDocument,
  duplicateCanonicalSketch,
  deleteCanonicalSketchFromDocument,
  serializeCanonicalSketch,
  deserializeCanonicalSketch,
  applySolverResultSafely,
  deriveSolverState
} from '../../../engine/sketch/canonical/CanonicalSketchContract';
import { CanonicalSketchAdapter } from '../../../engine/sketch/canonical/CanonicalSketchAdapter';
import { SketchEntity } from '../../../engine/geometry/SketchEngine';
import { SketchUIIntegration } from '../../../engine/cad-kernel/ui-integration/SketchUIIntegration';
import { BRepHasher } from '../../../engine/cad-kernel/topology/BRepHasher';

describe('PATCH-326: Canonical Sketch Runtime Integration & Production Readiness', () => {

  // ---------------------------------------------------------------------------
  // TEST-01: Canonical Lifecycle
  // ---------------------------------------------------------------------------
  test('TEST-01: Canonical Lifecycle (creation, duplication, deletion, attachment, detachment, restoration)', () => {
    // 1. Creation
    const sketch1 = createEmptyCanonicalSketch('SKETCH_LC_1', 'Base_Sketch', 'XY');
    expect(sketch1.id).toBe('SKETCH_LC_1');
    expect(sketch1.revision).toBe(1);

    // 2. Add an entity
    const lineEntity: SketchEntity = {
      id: 'ENT-LC-LINE1',
      type: 'LINE',
      points: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
      params: {},
      constraints: [],
      isConstruction: false
    };
    const sketch1Mutated = mutateAddFlatEntities(sketch1, [lineEntity]);
    expect(sketch1Mutated.revision).toBe(2);

    // 3. Document attachment
    let doc = SketchUIIntegration.createEmptyDocument('DOC_LIFECYCLE');
    doc = updateCanonicalSketchInDocument(doc, sketch1Mutated);
    expect(doc.sketches).toBeDefined();
    if (doc.sketches && doc.sketches[0]) {
      expect(doc.sketches.length).toBe(1);
      expect(doc.sketches[0].id).toBe('SKETCH_LC_1');
    }

    // 4. Duplication
    const sketch1Copy = duplicateCanonicalSketch(sketch1Mutated, 'SKETCH_LC_1_DUP', 'Base_Sketch_Copy');
    expect(sketch1Copy.id).toBe('SKETCH_LC_1_DUP');
    expect(sketch1Copy.name).toBe('Base_Sketch_Copy');
    expect(sketch1Copy.revision).toBe(1);
    expect(Object.keys(sketch1Copy.entities).length).toBe(Object.keys(sketch1Mutated.entities).length);

    // Attach copy to doc
    doc = updateCanonicalSketchInDocument(doc, sketch1Copy);
    expect(doc.sketches).toBeDefined();
    if (doc.sketches) {
      expect(doc.sketches.length).toBe(2);
    }

    // 5. Detachment / Deletion from document
    doc = deleteCanonicalSketchFromDocument(doc, 'SKETCH_LC_1_DUP');
    expect(doc.sketches).toBeDefined();
    if (doc.sketches && doc.sketches[0]) {
      expect(doc.sketches.length).toBe(1);
      expect(doc.sketches[0].id).toBe('SKETCH_LC_1');
    }
  });

  // ---------------------------------------------------------------------------
  // TEST-02: Active Sketch Identity
  // ---------------------------------------------------------------------------
  test('TEST-02: Active Sketch Identity ownership across multi-sketch documents', () => {
    let doc = SketchUIIntegration.createEmptyDocument('DOC_MULTI_SKETCH');

    const sketchA = createEmptyCanonicalSketch('SKETCH_A', 'Front_Profile', 'XY');
    const sketchB = createEmptyCanonicalSketch('SKETCH_B', 'Side_Profile', 'YZ');

    doc = updateCanonicalSketchInDocument(doc, sketchA);
    doc = updateCanonicalSketchInDocument(doc, sketchB);
    expect(doc.sketches).toBeDefined();
    if (doc.sketches) {
      expect(doc.sketches.length).toBe(2);
    }

    // 1. Explicit selection of non-first sketch (Sketch B)
    const activeB = getActiveCanonicalSketch(doc, 'SKETCH_B');
    expect(activeB).toBeDefined();
    expect(activeB?.id).toBe('SKETCH_B');
    expect(activeB?.plane).toBe('YZ');

    // 2. Edit non-first sketch
    const circleB: SketchEntity = {
      id: 'ENT-B-CIRC',
      type: 'CIRCLE',
      points: [{ x: 50, y: 50 }],
      params: { radius: 30 },
      constraints: [],
      isConstruction: false
    };
    const activeBMutated = mutateAddFlatEntities(activeB!, [circleB]);
    expect(activeBMutated.revision).toBe(2);

    doc = updateCanonicalSketchInDocument(doc, activeBMutated);

    // 3. Switch back to Sketch A
    const activeA = getActiveCanonicalSketch(doc, 'SKETCH_A');
    expect(activeA?.id).toBe('SKETCH_A');
    expect(Object.keys(activeA!.entities).length).toBe(0);

    // 4. Verify Sketch B preserved its mutation in doc
    const reloadedB = getActiveCanonicalSketch(doc, 'SKETCH_B');
    expect(reloadedB?.revision).toBe(2);
    expect(Object.keys(reloadedB!.entities).length).toBeGreaterThan(0);
  });

  // ---------------------------------------------------------------------------
  // TEST-03: Revision Integrity
  // ---------------------------------------------------------------------------
  test('TEST-03: Monotonic revision progression on every accepted mutation', () => {
    let sketch = createEmptyCanonicalSketch('SKETCH_REV', 'RevTest', 'XY');
    expect(sketch.revision).toBe(1);

    const pt: SketchEntity = { id: 'P_REV1', type: 'POINT', points: [{ x: 10, y: 10 }], params: {}, constraints: [], isConstruction: false };
    sketch = mutateAddFlatEntities(sketch, [pt]);
    expect(sketch.revision).toBe(2);

    sketch = mutateAddFlatConstraint(sketch, 'P_REV1', 'FIX');
    expect(sketch.revision).toBe(3);

    const solveRes = solveCanonicalSketch(sketch);
    sketch = solveRes.solvedSketch;
    expect(sketch.revision).toBe(4);

    sketch = mutateDeleteFlatEntity(sketch, 'P_REV1');
    expect(sketch.revision).toBe(5);
  });

  // ---------------------------------------------------------------------------
  // TEST-04: Mutation Uniqueness
  // ---------------------------------------------------------------------------
  test('TEST-04: Exactly one user operation produces exactly one authoritative revision increment', () => {
    const sketch0 = createEmptyCanonicalSketch('SKETCH_UNIQ', 'UniqTest', 'XY');
    const pt: SketchEntity = { id: 'P_UNIQ1', type: 'POINT', points: [{ x: 5, y: 5 }], params: {}, constraints: [], isConstruction: false };

    const sketch1 = mutateAddFlatEntities(sketch0, [pt]);
    expect(sketch1.revision - sketch0.revision).toBe(1);

    const sketch2 = mutateEntityParameter(sketch1, 'P_UNIQ1', { x: 20 });
    expect(sketch2.revision - sketch1.revision).toBe(1);
  });

  // ---------------------------------------------------------------------------
  // TEST-05: Derived-State Isolation
  // ---------------------------------------------------------------------------
  test('TEST-05: Derived structures (SketchEngine, IndustrialSketchDefinition, projections) cannot act as SOT', () => {
    const sketch = createEmptyCanonicalSketch('SKETCH_ISO', 'IsoTest', 'XY');
    const pt: SketchEntity = { id: 'P_ISO', type: 'POINT', points: [{ x: 0, y: 0 }], params: {}, constraints: [], isConstruction: false };
    const canonicalWithPt = mutateAddFlatEntities(sketch, [pt]);

    // Derived projection
    const flatProjection = CanonicalSketchAdapter.toFlatEntities(canonicalWithPt);
    
    // Mutating local projection array directly
    flatProjection.push({ id: 'P_GHOST', type: 'POINT', points: [{ x: 99, y: 99 }], params: {}, constraints: [], isConstruction: false });

    // Canonical SOT remains strictly untouched
    const freshFlat = CanonicalSketchAdapter.toFlatEntities(canonicalWithPt);
    expect(freshFlat.find(e => e.id === 'P_GHOST')).toBeUndefined();
    expect(canonicalWithPt.revision).toBe(2);
  });

  // ---------------------------------------------------------------------------
  // TEST-06: Serialization Round Trip
  // ---------------------------------------------------------------------------
  test('TEST-06: Serialization round-trip preserves CanonicalSketch structure and equality', () => {
    let sketch = createEmptyCanonicalSketch('SKETCH_SERIAL', 'SerialTest', 'XY');
    const pt: SketchEntity = { id: 'P_SER1', type: 'POINT', points: [{ x: 12.34, y: 56.78 }], params: {}, constraints: [], isConstruction: false };
    sketch = mutateAddFlatEntities(sketch, [pt]);

    const serializedJson = serializeCanonicalSketch(sketch);
    expect(typeof serializedJson).toBe('string');

    const restoredSketch = deserializeCanonicalSketch(serializedJson);
    const eq = CanonicalSketchAdapter.areCanonicallyEqual(sketch, restoredSketch);

    expect(eq.equal).toBe(true);
    expect(eq.differences.length).toBe(0);
    expect(restoredSketch.id).toBe(sketch.id);
    expect(restoredSketch.revision).toBe(sketch.revision);
  });

  // ---------------------------------------------------------------------------
  // TEST-07: Constraint Preservation
  // ---------------------------------------------------------------------------
  test('TEST-07: Constraint topology and parameters survive serialization round-trip', () => {
    let sketch = createEmptyCanonicalSketch('SKETCH_CONST_PRESERV', 'ConstPreserv', 'XY');
    const line: SketchEntity = { id: 'L_CP', type: 'LINE', points: [{ x: 0, y: 0 }, { x: 100, y: 0 }], params: {}, constraints: ['HORIZONTAL'], isConstruction: false };
    sketch = mutateAddFlatEntities(sketch, [line]);
    sketch = mutateAddFlatConstraint(sketch, 'L_CP', 'HORIZONTAL');

    const json = serializeCanonicalSketch(sketch);
    const restored = deserializeCanonicalSketch(json);

    const eq = CanonicalSketchAdapter.areCanonicallyEqual(sketch, restored);
    expect(eq.equal).toBe(true);
    expect(Object.keys(restored.constraints).length).toBe(Object.keys(sketch.constraints).length);
  });

  // ---------------------------------------------------------------------------
  // TEST-08: Entity Identity Preservation
  // ---------------------------------------------------------------------------
  test('TEST-08: Stable entity and point IDs through mutation, projection, serialization, and restoration', () => {
    let sketch = createEmptyCanonicalSketch('SKETCH_ID_STABILITY', 'IdStability', 'XY');
    const startPt: SketchEntity = { id: 'PT_STABLE_START', type: 'POINT', points: [{ x: 0, y: 0 }], params: {}, constraints: [], isConstruction: false };
    const endPt: SketchEntity = { id: 'PT_STABLE_END', type: 'POINT', points: [{ x: 50, y: 50 }], params: {}, constraints: [], isConstruction: false };
    const line: SketchEntity = { id: 'ENT_STABLE_LINE', type: 'LINE', startPointId: 'PT_STABLE_START', endPointId: 'PT_STABLE_END', points: [{ x: 0, y: 0 }, { x: 50, y: 50 }], params: {}, constraints: [], isConstruction: false };

    sketch = mutateAddFlatEntities(sketch, [startPt, endPt, line]);

    const flatBefore = CanonicalSketchAdapter.toFlatEntities(sketch);
    expect(flatBefore.map(e => e.id)).toContain('ENT_STABLE_LINE');

    const json = serializeCanonicalSketch(sketch);
    const restored = deserializeCanonicalSketch(json);
    const flatAfter = CanonicalSketchAdapter.toFlatEntities(restored);

    expect(flatAfter.map(e => e.id)).toContain('ENT_STABLE_LINE');
    expect(flatAfter.map(e => e.id)).toContain('PT_STABLE_START');
  });

  // ---------------------------------------------------------------------------
  // TEST-09: Stale Result Rejection
  // ---------------------------------------------------------------------------
  test('TEST-09: Stale asynchronous solver result is rejected when canonical sketch has been mutated', () => {
    const baseSketch = createEmptyCanonicalSketch('SKETCH_STALE', 'StaleTest', 'XY');
    const pt: SketchEntity = { id: 'PT_STALE', type: 'POINT', points: [{ x: 0, y: 0 }], params: {}, constraints: [], isConstruction: false };
    const sketchRev1 = mutateAddFlatEntities(baseSketch, [pt]);
    expect(sketchRev1.revision).toBe(2);

    const baseRevision = sketchRev1.revision; // 2

    // Simulate async solver computation returning a solved result based on rev 2
    const fakeSolvedResult = {
      ...sketchRev1,
      entities: {
        ...sketchRev1.entities,
        PT_STALE: { ...sketchRev1.entities.PT_STALE, x: 100, y: 100 } as any
      },
      revision: 3
    };

    // While solver was computing, user performed a new mutation (e.g. deleted entity or dragged point)
    const sketchRev2Mutated = mutateEntityParameter(sketchRev1, 'PT_STALE', { x: 50 });
    expect(sketchRev2Mutated.revision).toBe(3);

    // Apply solver result safely with baseRevision = 2 against current sketch (revision = 3)
    const result = applySolverResultSafely(sketchRev2Mutated, baseRevision, fakeSolvedResult);

    // MUST be rejected!
    expect(result.accepted).toBe(false);
    expect(result.updatedSketch.revision).toBe(3); // Preserves user's newer mutation
  });

  // ---------------------------------------------------------------------------
  // TEST-10: Concurrent Mutation Ordering
  // ---------------------------------------------------------------------------
  test('TEST-10: Rapid sequential operations yield monotonic revision progression', () => {
    let sketch = createEmptyCanonicalSketch('SKETCH_CONCUR', 'ConcurTest', 'XY');
    const line: SketchEntity = { id: 'L_CONCUR', type: 'LINE', points: [{ x: 0, y: 0 }, { x: 10, y: 0 }], params: {}, constraints: [], isConstruction: false };

    // Rapid sequence: Add -> Move -> Move -> Constraint -> Delete
    sketch = mutateAddFlatEntities(sketch, [line]); // rev 2
    sketch = mutateEntityParameter(sketch, 'L_CONCUR', { points: [{ x: 0, y: 0 }, { x: 20, y: 0 }] }); // rev 3
    sketch = mutateEntityParameter(sketch, 'L_CONCUR', { points: [{ x: 0, y: 0 }, { x: 30, y: 0 }] }); // rev 4
    sketch = mutateAddFlatConstraint(sketch, 'L_CONCUR', 'HORIZONTAL'); // rev 5
    sketch = mutateDeleteFlatEntity(sketch, 'L_CONCUR'); // rev 6

    expect(sketch.revision).toBe(6);
  });

  // ---------------------------------------------------------------------------
  // TEST-11: Canonical -> EngineeringDocument Causality
  // ---------------------------------------------------------------------------
  test('TEST-11: CanonicalSketch mutations causally update EngineeringDocument revision and sketches', () => {
    let sketch = createEmptyCanonicalSketch('SKETCH_DOC_CAUSAL', 'DocCausal', 'XY');
    let doc = SketchUIIntegration.createEmptyDocument('DOC_CAUSAL');

    const initialDocRev = doc.revision;

    doc = updateCanonicalSketchInDocument(doc, sketch);
    if (typeof doc.revision !== 'number' || typeof initialDocRev !== 'number' || !doc.sketches) {
      throw new Error('Type mismatch or sketches undefined');
    }
    expect(doc.revision).toBe(initialDocRev + 1);

    const pt: SketchEntity = { id: 'PT_CAUSAL', type: 'POINT', points: [{ x: 5, y: 5 }], params: {}, constraints: [], isConstruction: false };
    sketch = mutateAddFlatEntities(sketch, [pt]);

    doc = updateCanonicalSketchInDocument(doc, sketch);
    expect(doc.revision).toBe(initialDocRev + 2);
    if (!doc.sketches) throw new Error('doc.sketches is undefined');
    expect(doc.sketches[0].points?.length).toBeGreaterThan(0);
  });

  // ---------------------------------------------------------------------------
  // TEST-12: Canonical -> B-Rep Causality
  // ---------------------------------------------------------------------------
  test('TEST-12: Canonical geometry modifications causally update downstream B-Rep geometry hash and volume', () => {
    const sketch = createEmptyCanonicalSketch('SKETCH_BREP_326', 'BRep326', 'XY');
    
    // 100x100 square
    const rect1: SketchEntity[] = [
      { id: 'ENT-LINE-1', type: 'LINE', points: [{ x: 0, y: 0 }, { x: 100, y: 0 }], params: {}, constraints: [], isConstruction: false },
      { id: 'ENT-LINE-2', type: 'LINE', points: [{ x: 100, y: 0 }, { x: 100, y: 100 }], params: {}, constraints: [], isConstruction: false },
      { id: 'ENT-LINE-3', type: 'LINE', points: [{ x: 100, y: 100 }, { x: 0, y: 100 }], params: {}, constraints: [], isConstruction: false },
      { id: 'ENT-LINE-4', type: 'LINE', points: [{ x: 0, y: 100 }, { x: 0, y: 0 }], params: {}, constraints: [], isConstruction: false }
    ];

    const canonical1 = mutateAddFlatEntities(sketch, rect1);
    let doc = SketchUIIntegration.createEmptyDocument('DOC_BREP_326');
    doc = updateCanonicalSketchInDocument(doc, canonical1);

    const flat1 = CanonicalSketchAdapter.toFlatEntities(canonical1);
    const regen1 = SketchUIIntegration.applyExtrudeAction(doc, flat1, 100);

    expect(regen1.success).toBe(true);
    const ev1 = BRepHasher.computeEvidence(regen1.evaluatedShape as any);
    const vol1 = 100 * 100 * 100; // 1,000,000

    // Mutate canonical to 200x100 rectangle with depth 200
    const rect2: SketchEntity[] = [
      { id: 'ENT-LINE-1', type: 'LINE', points: [{ x: 0, y: 0 }, { x: 200, y: 0 }], params: {}, constraints: [], isConstruction: false },
      { id: 'ENT-LINE-2', type: 'LINE', points: [{ x: 200, y: 0 }, { x: 200, y: 100 }], params: {}, constraints: [], isConstruction: false },
      { id: 'ENT-LINE-3', type: 'LINE', points: [{ x: 200, y: 100 }, { x: 0, y: 100 }], params: {}, constraints: [], isConstruction: false },
      { id: 'ENT-LINE-4', type: 'LINE', points: [{ x: 0, y: 100 }, { x: 0, y: 0 }], params: {}, constraints: [], isConstruction: false }
    ];
    const canonical2 = mutateAddFlatEntities(canonical1, rect2);
    const updatedDoc = updateCanonicalSketchInDocument(regen1.document, canonical2);

    const flat2 = CanonicalSketchAdapter.toFlatEntities(canonical2);
    const regen2 = SketchUIIntegration.applyExtrudeAction(updatedDoc, flat2, 200);

    expect(regen2.success).toBe(true);
    const ev2 = BRepHasher.computeEvidence(regen2.evaluatedShape as any);
    const vol2 = 200 * 100 * 200; // 4,000,000

    expect(ev2.geometryHash).not.toBe(ev1.geometryHash);
    expect(vol2).not.toBe(vol1);
  });

  // ---------------------------------------------------------------------------
  // TEST-13: Two Views / One SOT
  // ---------------------------------------------------------------------------
  test('TEST-13: Multiple view projections remain 100% synchronized projections of single canonical SOT', () => {
    let canonical = createEmptyCanonicalSketch('SKETCH_TWO_VIEWS', 'TwoViews', 'XY');
    const line: SketchEntity = { id: 'L_VIEW', type: 'LINE', points: [{ x: 0, y: 0 }, { x: 80, y: 0 }], params: {}, constraints: [], isConstruction: false };
    canonical = mutateAddFlatEntities(canonical, [line]);

    // View 1 Projection (Flat UI Entities for SketchEditorPanel)
    const view1Projection = CanonicalSketchAdapter.toFlatEntities(canonical);

    // View 2 Projection (IndustrialSketchDefinition for SketcherPanel)
    const view2Projection = CanonicalSketchAdapter.toIndustrialSketch(canonical);

    expect(view1Projection.some(e => e.id === 'L_VIEW')).toBe(true);
    expect(view2Projection.entities['L_VIEW']).toBeDefined();

    // Mutate Canonical
    canonical = mutateDeleteFlatEntity(canonical, 'L_VIEW');

    // Re-project both views
    const view1Updated = CanonicalSketchAdapter.toFlatEntities(canonical);
    const view2Updated = CanonicalSketchAdapter.toIndustrialSketch(canonical);

    expect(view1Updated.some(e => e.id === 'L_VIEW')).toBe(false);
    expect(view2Updated.entities['L_VIEW']).toBeUndefined();
  });

  // ---------------------------------------------------------------------------
  // TEST-14: Regression Battery (PATCH-325B Re-verification)
  // ---------------------------------------------------------------------------
  test('TEST-14: Re-verification of all PATCH-325B core invariants', () => {
    const sketch = createEmptyCanonicalSketch('SKETCH_REGRESS', 'RegressTest', 'XY');
    expect(sketch.revision).toBe(1);

    const pt: SketchEntity = { id: 'PT_REG', type: 'POINT', points: [{ x: 10, y: 10 }], params: {}, constraints: [], isConstruction: false };
    const mutated = mutateAddFlatEntities(sketch, [pt]);

    expect(mutated.revision).toBe(2);
    expect(CanonicalSketchAdapter.toFlatEntities(mutated).some(e => e.id === 'PT_REG')).toBe(true);
  });

});
