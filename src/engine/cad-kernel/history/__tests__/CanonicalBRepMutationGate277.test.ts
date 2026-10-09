import { describe, it, expect, vi } from 'vitest';
import { BRepMutationGate277, BRepSnapshot } from '../../brep/BRepMutationGate277';
import { EngineeringDocument } from '../../document/CADDocument';
import { SketchUIIntegration } from '../../ui-integration/SketchUIIntegration';
import { BRepKernel } from '../../brep/BRepKernel';
import { Meters } from '../../core/Units';

describe('PROMPT-015 — B-Rep Mutation Gate', () => {
  
  const createBaseDoc = () => {
    return SketchUIIntegration.createEmptyDocument('TEST_DOC');
  };

  it('AC-01 & AC-02: Captures Before and After snapshots', () => {
    const doc = createBaseDoc();
    const snapshot = BRepMutationGate277.captureSnapshot(doc);
    
    expect(snapshot.documentId).toBe('TEST_DOC');
    expect(snapshot.revision).toBe(1);
    expect(snapshot.topologyHash).toBe('EMPTY');
    expect(snapshot.volume).toBe(0);
  });

  it('AC-11 & AC-12: Rejects Fake UI Mutation (UI Success != Engineering Success)', () => {
    const doc = createBaseDoc();
    const before = BRepMutationGate277.captureSnapshot(doc);
    
    // Simulate a "success" evaluation that doesn't actually change the B-Rep
    const afterDoc = { ...doc, revision: 2 }; 
    const after = BRepMutationGate277.captureSnapshot(afterDoc);
    
    const verdict = BRepMutationGate277.verify(before, after, 'ADDITIVE');
    
    expect(verdict.status).toBe('FAIL');
    expect(verdict.reason).toContain('No B-Rep mutation detected');
  });

  it('AC-15: Real Tool E2E (Extrude Mutation Proof)', () => {
    const doc = createBaseDoc();
    const before = BRepMutationGate277.captureSnapshot(doc);
    
    // Real Extrude
    const sketchEnts = [
      { type: 'LINE', points: [{ x: 0, y: 0 }, { x: 10, y: 0 }] },
      { type: 'LINE', points: [{ x: 10, y: 0 }, { x: 10, y: 10 }] },
      { type: 'LINE', points: [{ x: 10, y: 10 }, { x: 0, y: 10 }] },
      { type: 'LINE', points: [{ x: 0, y: 10 }, { x: 0, y: 0 }] }
    ];
    const evalResult = SketchUIIntegration.applyExtrudeAction(doc, sketchEnts, 50);
    
    const after = BRepMutationGate277.captureSnapshot(evalResult.document);
    const verdict = BRepMutationGate277.verify(before, after, 'ADDITIVE');
    
    expect(evalResult.success).toBe(true);
    expect(verdict.status).toBe('PASS');
    expect(verdict.delta.topologyChanged).toBe(true);
    expect(verdict.delta.geometryChanged).toBe(true);
    expect(verdict.delta.volumeDelta).toBeGreaterThan(0);
  });

  it('AC-07: Verifies Volume Change Semantics', () => {
    const doc = createBaseDoc();
    
    // Setup a starting solid (10x10x50 mm = 5000 mm3 = 5e-6 m3)
    const sketchEnts = [{ type: 'LINE', points: [{x:0,y:0}, {x:10,y:0}, {x:10,y:10}, {x:0,y:10}] }];
    const firstEval = SketchUIIntegration.applyExtrudeAction(doc, sketchEnts, 50);
    const before = BRepMutationGate277.captureSnapshot(firstEval.document);

    // Mock an "ADDITIVE" operation that somehow reduces volume
    // smallerSolid = 1x1x1 mm = 1 mm3 = 1e-9 m3
    const smallerSolid = BRepKernel.getCanonical().createBox(0.001 as Meters, 0.001 as Meters, 0.001 as Meters);
    const fakeAfterDoc: EngineeringDocument = {
      ...firstEval.document,
      revision: 3,
      evaluatedShape: smallerSolid
    };
    
    const after = BRepMutationGate277.captureSnapshot(fakeAfterDoc);
    const verdict = BRepMutationGate277.verify(before, after, 'ADDITIVE');
    
    expect(verdict.status).toBe('FAIL');
    expect(verdict.reason).toContain('volume reduction');
  });

  it('AC-13: Parameter Sensitivity (Geometry A != Geometry B)', () => {
    const doc = createBaseDoc();
    const sketchEnts = [{ type: 'LINE', points: [{x:0,y:0}, {x:10,y:0}, {x:10,y:10}, {x:0,y:10}] }];
    
    const res1 = SketchUIIntegration.applyExtrudeAction(doc, sketchEnts, 10);
    const snap1 = BRepMutationGate277.captureSnapshot(res1.document);
    
    // Use res1.document to ensure revision increases
    const res2 = SketchUIIntegration.applyExtrudeAction(res1.document, sketchEnts, 20);
    const snap2 = BRepMutationGate277.captureSnapshot(res2.document);
    
    expect(snap1.geometryHash).not.toBe(snap2.geometryHash);
    expect(snap1.volume).not.toBe(snap2.volume);
    
    const verdict = BRepMutationGate277.verify(snap1, snap2, 'ADDITIVE');
    expect(verdict.status).toBe('PASS');
  });

  it('AC-09: Supports NON_GEOMETRIC operations without B-Rep proof', () => {
    const doc = createBaseDoc();
    const before = BRepMutationGate277.captureSnapshot(doc);
    
    const afterDoc = { ...doc, revision: 2 };
    const after = BRepMutationGate277.captureSnapshot(afterDoc);
    
    const verdict = BRepMutationGate277.verify(before, after, 'NON_GEOMETRIC');
    expect(verdict.status).toBe('PASS');
    expect(verdict.reason).toContain('Non-geometric');
  });
});
