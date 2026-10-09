import { describe, it, expect, beforeEach } from 'vitest';
import { EngineeringDocument } from '../../cad-kernel/document/CADDocument';
import { SketchUIIntegration } from '../../cad-kernel/ui-integration/SketchUIIntegration';
import { CanonicalIntentDispatcher277 } from '../CanonicalIntentDispatcher277';
import { AnyEngineeringIntent } from '../EngineeringIntent277';
import { getActiveCanonicalSketch } from '../../sketch/canonical/CanonicalSketchContract';
import { CanonicalSketchAdapter } from '../../sketch/canonical/CanonicalSketchAdapter';

describe('PROMPT-017 — Sketch Modification Convergence Tests', () => {
  let testDoc: EngineeringDocument;
  let sketchId: string;

  beforeEach(() => {
    // Generate standard test document with active sketch
    const { document } = SketchUIIntegration.createPrimitiveDocument('BOX', 'DOC_SKETCH_MOD_TEST');
    testDoc = document;
    sketchId = testDoc.sketches[0].id;
  });

  function createIntent(toolId: string, params: any): AnyEngineeringIntent {
    return {
      intentId: `int_${Math.random().toString(36).substring(2, 9)}`,
      toolId,
      documentId: testDoc.documentId,
      parameters: {
        sketchId,
        ...params
      },
      timestamp: new Date().toISOString()
    } as AnyEngineeringIntent;
  }

  it('1. SKETCH_TRIM: Trims a line and returns verified B-Rep and evidence', async () => {
    // Let's add a line to trim
    const activeSketch = getActiveCanonicalSketch(testDoc, sketchId)!;
    const ind = CanonicalSketchAdapter.toIndustrialSketch(activeSketch);
    
    // Add two intersecting lines to make a real trim possible
    // Line 1: (0,0) -> (100,0)
    ind.entities['line_1'] = { id: 'line_1', type: 'LINE', startPointId: 'pt_s1', endPointId: 'pt_e1' } as any;
    ind.entities['pt_s1'] = { id: 'pt_s1', type: 'POINT', x: 0, y: 0 } as any;
    ind.entities['pt_e1'] = { id: 'pt_e1', type: 'POINT', x: 100, y: 0 } as any;

    // Line 2: (50, -50) -> (50, 50)
    ind.entities['line_2'] = { id: 'line_2', type: 'LINE', startPointId: 'pt_s2', endPointId: 'pt_e2' } as any;
    ind.entities['pt_s2'] = { id: 'pt_s2', type: 'POINT', x: 50, y: -50 } as any;
    ind.entities['pt_e2'] = { id: 'pt_e2', type: 'POINT', x: 50, y: 50 } as any;

    const populatedSketch = CanonicalSketchAdapter.fromIndustrialSketch(ind);
    testDoc.sketches[0] = populatedSketch;

    // Trim line_1 at (75,0)
    const intent = createIntent('SKETCH_TRIM', {
      targetEntityId: 'line_1',
      clickPoint: { x: 75, y: 0 }
    });

    const result = await CanonicalIntentDispatcher277.dispatch(intent, testDoc);
    expect(result.success).toBe(true);
    expect(result.affectedEntities.length).toBeGreaterThan(0);
    expect(result.evidence![0].type).toBe('SKETCH_MUTATION_EVIDENCE');
  });

  it('2. SKETCH_EXTEND: Extends a line to the nearest geometry boundary', async () => {
    // Add a line and a boundary
    const activeSketch = getActiveCanonicalSketch(testDoc, sketchId)!;
    const ind = CanonicalSketchAdapter.toIndustrialSketch(activeSketch);
    
    // Line 1 (Target): (0,0) -> (40,0)
    ind.entities['line_tgt'] = { id: 'line_tgt', type: 'LINE', startPointId: 'pt_ts', endPointId: 'pt_te' } as any;
    ind.entities['pt_ts'] = { id: 'pt_ts', type: 'POINT', x: 0, y: 0 } as any;
    ind.entities['pt_te'] = { id: 'pt_te', type: 'POINT', x: 40, y: 0 } as any;

    // Line 2 (Boundary): (50, -50) -> (50, 50)
    ind.entities['line_bnd'] = { id: 'line_bnd', type: 'LINE', startPointId: 'pt_bs', endPointId: 'pt_be' } as any;
    ind.entities['pt_bs'] = { id: 'pt_bs', type: 'POINT', x: 50, y: -50 } as any;
    ind.entities['pt_be'] = { id: 'pt_be', type: 'POINT', x: 50, y: 50 } as any;

    const populatedSketch = CanonicalSketchAdapter.fromIndustrialSketch(ind);
    testDoc.sketches[0] = populatedSketch;

    const intent = createIntent('SKETCH_EXTEND', {
      targetEntityId: 'line_tgt'
    });

    const result = await CanonicalIntentDispatcher277.dispatch(intent, testDoc);
    expect(result.success).toBe(true);
    expect(result.affectedEntities).toContain('line_tgt');
  });

  it('3. SKETCH_SPLIT: Splits a line segment into two parametric entities', async () => {
    const activeSketch = getActiveCanonicalSketch(testDoc, sketchId)!;
    const ind = CanonicalSketchAdapter.toIndustrialSketch(activeSketch);
    
    // Line to split: (0,0) -> (100,0)
    ind.entities['line_split'] = { id: 'line_split', type: 'LINE', startPointId: 'pt_a', endPointId: 'pt_b' } as any;
    ind.entities['pt_a'] = { id: 'pt_a', type: 'POINT', x: 0, y: 0 } as any;
    ind.entities['pt_b'] = { id: 'pt_b', type: 'POINT', x: 100, y: 0 } as any;

    const populatedSketch = CanonicalSketchAdapter.fromIndustrialSketch(ind);
    testDoc.sketches[0] = populatedSketch;

    const intent = createIntent('SKETCH_SPLIT', {
      targetEntityId: 'line_split',
      splitPoint: { x: 50, y: 0 }
    });

    const result = await CanonicalIntentDispatcher277.dispatch(intent, testDoc);
    expect(result.success).toBe(true);
    expect(result.affectedEntities.length).toBeGreaterThan(0);
    
    // Verify line_split was deleted, and split-lines created
    const updatedSketch = getActiveCanonicalSketch(result.document!, sketchId)!;
    expect(updatedSketch.entities['line_split']).toBeUndefined();
    
    const countSplitLines = Object.values(updatedSketch.entities).filter((e: any) => e.id.includes('line-split')).length;
    expect(countSplitLines).toBe(2);
  });

  it('4. SKETCH_OFFSET: Parametric geometry offset with valid selection reference', async () => {
    const activeSketch = getActiveCanonicalSketch(testDoc, sketchId)!;
    const ind = CanonicalSketchAdapter.toIndustrialSketch(activeSketch);
    
    ind.entities['line_off'] = { id: 'line_off', type: 'LINE', startPointId: 'pt_1', endPointId: 'pt_2' } as any;
    ind.entities['pt_1'] = { id: 'pt_1', type: 'POINT', x: 10, y: 10 } as any;
    ind.entities['pt_2'] = { id: 'pt_2', type: 'POINT', x: 10, y: 100 } as any;

    const populatedSketch = CanonicalSketchAdapter.fromIndustrialSketch(ind);
    testDoc.sketches[0] = populatedSketch;

    const intent = createIntent('SKETCH_OFFSET', {
      targetEntityId: 'line_off',
      offsetValue: 20
    });

    const result = await CanonicalIntentDispatcher277.dispatch(intent, testDoc);
    expect(result.success).toBe(true);
    expect(result.affectedEntities.length).toBeGreaterThan(0);
  });

  it('5. SKETCH_MIRROR: Parametric geometry mirroring', async () => {
    const activeSketch = getActiveCanonicalSketch(testDoc, sketchId)!;
    const ind = CanonicalSketchAdapter.toIndustrialSketch(activeSketch);
    
    ind.entities['line_mir'] = { id: 'line_mir', type: 'LINE', startPointId: 'pt_x1', endPointId: 'pt_x2' } as any;
    ind.entities['pt_x1'] = { id: 'pt_x1', type: 'POINT', x: 10, y: 10 } as any;
    ind.entities['pt_x2'] = { id: 'pt_x2', type: 'POINT', x: 20, y: 20 } as any;

    const populatedSketch = CanonicalSketchAdapter.fromIndustrialSketch(ind);
    testDoc.sketches[0] = populatedSketch;

    const intent = createIntent('SKETCH_MIRROR', {
      selectedEntityIds: ['line_mir'],
      mirrorLineId: 'Y'
    });

    const result = await CanonicalIntentDispatcher277.dispatch(intent, testDoc);
    expect(result.success).toBe(true);
    expect(result.affectedEntities.length).toBeGreaterThan(0);
  });

  it('6. SKETCH_PATTERN_LINEAR & CIRCULAR: Multi-entity array multiplication', async () => {
    const activeSketch = getActiveCanonicalSketch(testDoc, sketchId)!;
    const ind = CanonicalSketchAdapter.toIndustrialSketch(activeSketch);
    
    ind.entities['line_pat'] = { id: 'line_pat', type: 'LINE', startPointId: 'pt_y1', endPointId: 'pt_y2' } as any;
    ind.entities['pt_y1'] = { id: 'pt_y1', type: 'POINT', x: 10, y: 10 } as any;
    ind.entities['pt_y2'] = { id: 'pt_y2', type: 'POINT', x: 20, y: 20 } as any;

    const populatedSketch = CanonicalSketchAdapter.fromIndustrialSketch(ind);
    testDoc.sketches[0] = populatedSketch;

    const linearIntent = createIntent('SKETCH_PATTERN_LINEAR', {
      selectedEntityIds: ['line_pat'],
      count: 3,
      distance: 30,
      directionRad: 0
    });

    const linearResult = await CanonicalIntentDispatcher277.dispatch(linearIntent, testDoc);
    expect(linearResult.success).toBe(true);
    expect(linearResult.affectedEntities.length).toBeGreaterThan(0);

    const circularIntent = createIntent('SKETCH_PATTERN_CIRCULAR', {
      selectedEntityIds: ['line_pat'],
      count: 4,
      center: { x: 0, y: 0 },
      totalAngleRad: Math.PI * 2
    });

    const circularResult = await CanonicalIntentDispatcher277.dispatch(circularIntent, testDoc);
    expect(circularResult.success).toBe(true);
    expect(circularResult.affectedEntities.length).toBeGreaterThan(0);
  });
});
