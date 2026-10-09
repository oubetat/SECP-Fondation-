/**
 * PROMPT-027 Test Suite: Holes / Threads Canonical Feature Convergence
 * 
 * Verifies:
 * 1. Face Selection -> Hole Intent -> Hole Evaluator -> Engineering Kernel -> Real B-Rep Mutation
 * 2. Real Physical Thread Geometry vs Cosmetic Metadata
 * 3. Counterbore and Countersink B-Rep geometry
 * 4. BRepMutationGate277 SUBTRACTIVE verification
 * 5. Full Canonical Dispatcher & History Regeneration
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { HoleEvaluator, ISO_METRIC_COARSE_TABLE } from '../../brep/HoleEvaluator';
import { BoxFactory } from '../../boolean/BoxFactory';
import { BRepKernel } from '../../brep/BRepKernel';
import { mmToM } from '../../core/Units';
import { HoleAction277 } from '../../../viewport/HoleAction277';
import { HoleTool277 } from '../../../viewport/HoleTool277';
import { ThreadTool277 } from '../../../viewport/ThreadTool277';
import { CanonicalIntentDispatcher277 } from '../../../viewport/CanonicalIntentDispatcher277';
import { SketchUIIntegration } from '../../ui-integration/SketchUIIntegration';
import { DocumentEvaluator } from '../../document/DocumentEvaluator';
import { EngineeringDocument, DEFAULT_UNIT_SYSTEM_MM } from '../../document/CADDocument';
import { BRepMutationGate277 } from '../../brep/BRepMutationGate277';

describe('PROMPT-027: Holes & Threads Canonical Feature Convergence', () => {
  let doc: EngineeringDocument;

  beforeEach(() => {
    doc = SketchUIIntegration.createEmptyDocument('DOC_HOLE_TEST');
    // Add base extrude solid: 50mm x 50mm x 30mm box
    const extrudeRes = SketchUIIntegration.applyExtrudeAction(
      doc,
      [
        { x: 0, y: 0 },
        { x: 50, y: 0 },
        { x: 50, y: 50 },
        { x: 0, y: 50 }
      ],
      30,
      { extrudeId: 'F_BASE_EXTRUDE', operation: 'NEW' }
    );
    doc = extrudeRes.document;
  });

  it('1. Standard Thread Library provides correct ISO Metric parameters', () => {
    const m8 = HoleEvaluator.resolveThreadSpecification('M8');
    expect(m8.standard).toBe('ISO_METRIC');
    expect(m8.majorDiameter).toBe(8.0);
    expect(m8.pitch).toBe(1.25);
    expect(m8.minorDiameter).toBeCloseTo(8.0 - 1.08253 * 1.25, 2);
    expect(m8.isRealGeometry).toBe(true);

    const m6 = HoleEvaluator.resolveThreadSpecification('M6x1.0');
    expect(m6.majorDiameter).toBe(6.0);
    expect(m6.pitch).toBe(1.0);
  });

  it('2. Evaluates Simple Blind Hole with conical drill tip via real B-Rep difference', () => {
    const solid = doc.evaluatedShape;
    expect(solid).toBeDefined();

    const evalRes = HoleEvaluator.evaluateHole(solid, {
      diameter: 10,
      depth: 15,
      termination: 'BLIND',
      tipAngleDeg: 118
    }, 'HOLE_BLIND_1');

    expect(evalRes.success).toBe(true);
    expect(evalRes.resultSolid).toBeDefined();
    expect(evalRes.cutterSolid).toBeDefined();

    // Verify face count of cutter: top cap + lateral quads + drill point triangles
    const cutterFaces = evalRes.cutterSolid!.outerShell.orientedFaces;
    expect(cutterFaces.length).toBeGreaterThan(40);

    // Verify resultant solid is a real solid with outer shell
    const resFaces = evalRes.resultSolid!.outerShell.orientedFaces;
    expect(resFaces.length).toBeGreaterThan(6); // Box had 6 faces, hole adds internal faces
  });

  it('3. Evaluates Through-All Hole spanning the entire solid thickness', () => {
    const solid = doc.evaluatedShape;
    const evalRes = HoleEvaluator.evaluateHole(solid, {
      diameter: 8,
      throughAll: true,
      termination: 'THROUGH_ALL'
    }, 'HOLE_THROUGH_1');

    expect(evalRes.success).toBe(true);
    expect(evalRes.resultSolid).toBeDefined();
  });

  it('4. Evaluates Counterbore Hole with stepped shoulder ring', () => {
    const solid = doc.evaluatedShape;
    const evalRes = HoleEvaluator.evaluateHole(solid, {
      diameter: 6,
      depth: 20,
      holeType: 'COUNTERBORE',
      counterbore: {
        diameter: 12,
        depth: 6
      }
    }, 'HOLE_CB_1');

    expect(evalRes.success).toBe(true);
    expect(evalRes.resultSolid).toBeDefined();
    expect(evalRes.lineageTags['HOLE_CB_1_counterbore']).toBeDefined();
  });

  it('5. Evaluates Countersink Hole with chamfer cone geometry', () => {
    const solid = doc.evaluatedShape;
    const evalRes = HoleEvaluator.evaluateHole(solid, {
      diameter: 6,
      depth: 20,
      holeType: 'COUNTERSINK',
      countersink: {
        diameter: 12,
        angleDeg: 90
      }
    }, 'HOLE_CS_1');

    expect(evalRes.success).toBe(true);
    expect(evalRes.resultSolid).toBeDefined();
    expect(evalRes.lineageTags['HOLE_CS_1_countersink']).toBeDefined();
  });

  it('6. Evaluates Physical Threaded Hole generating authentic 60° metric tooth profiles', () => {
    const solid = doc.evaluatedShape;
    const evalRes = HoleEvaluator.evaluateHole(solid, {
      diameter: 8,
      depth: 15,
      holeType: 'THREADED',
      threadSpec: {
        standard: 'ISO_METRIC',
        designation: 'M8x1.25',
        pitch: 1.25,
        majorDiameter: 8.0,
        minorDiameter: 6.647,
        isRealGeometry: true
      }
    }, 'HOLE_THREADED_1');

    expect(evalRes.success).toBe(true);
    expect(evalRes.resultSolid).toBeDefined();
    expect(evalRes.threadMetrics).toBeDefined();
    expect(evalRes.threadMetrics!.isPhysical).toBe(true);
    expect(evalRes.threadMetrics!.threadCount).toBeGreaterThanOrEqual(2);
    expect(evalRes.lineageTags['HOLE_THREADED_1_threads']).toBeDefined();

    // Physical thread teeth should produce significantly more faces than a plain cylinder
    const cutterFaces = evalRes.cutterSolid!.outerShell.orientedFaces;
    expect(cutterFaces.length).toBeGreaterThan(100);
  });

  it('7. Rejects invalid selection when target face does not exist', () => {
    const solid = doc.evaluatedShape;
    const evalRes = HoleEvaluator.evaluateHole(solid, {
      diameter: 8,
      depth: 10,
      targetFaceId: 'NON_EXISTENT_FACE_ID'
    }, 'HOLE_INVALID_FACE');

    expect(evalRes.success).toBe(false);
    expect(evalRes.diagnostics[0]).toContain('INVALID_SELECTION');
  });

  it('8. Executes HoleAction277 with BRepMutationGate277 verification', async () => {
    const action = new HoleAction277();
    const intent = new HoleTool277().createIntent(doc.documentId, {
      diameter: 10,
      depth: 15,
      holeType: 'SIMPLE'
    });

    const result = await action.execute(intent, doc);
    expect(result.success).toBe(true);
    expect(result.document).toBeDefined();
    expect(result.document.features.some((f: any) => f.type === 'HOLE')).toBe(true);

    // Verify that the document evaluation succeeded with real geometry
    expect(result.document.evaluatedShape).toBeDefined();
  });

  it('9. Dispatches Hole and Thread through CanonicalIntentDispatcher277', async () => {
    const holeTool = new HoleTool277();
    const holeIntent = holeTool.createIntent(doc.documentId, {
      diameter: 8,
      depth: 12,
      holeType: 'COUNTERBORE',
      counterbore: { diameter: 14, depth: 4 }
    });

    const dispatchRes = await CanonicalIntentDispatcher277.dispatch(holeIntent, doc);
    expect(dispatchRes.success).toBe(true);
    expect(dispatchRes.canonicalActionId).toBe('FeatureAction.hole');

    const updatedDoc = dispatchRes.document;
    expect(updatedDoc).toBeDefined();

    // Add a thread intent on top of the document (at distinct center x=35, y=35)
    const threadTool = new ThreadTool277();
    const threadIntent = threadTool.createIntent(updatedDoc.documentId, {
      center: { x: 35, y: 35 },
      threadSpec: {
        standard: 'ISO_METRIC',
        designation: 'M8x1.25',
        pitch: 1.25,
        majorDiameter: 8.0,
        minorDiameter: 6.647,
        isRealGeometry: true
      },
      depth: 10
    });

    const threadDispatchRes = await CanonicalIntentDispatcher277.dispatch(threadIntent, updatedDoc);
    expect(threadDispatchRes.success).toBe(true);
    expect(threadDispatchRes.canonicalActionId).toBe('FeatureAction.thread');
  });

  it('10. BRepMutationGate277 detects and verifies SUBTRACTIVE topology mutation', () => {
    const before = BRepMutationGate277.captureSnapshot(doc);

    // Apply Hole via UI integration
    const evalRes = SketchUIIntegration.applyHoleAction(doc, {
      diameter: 12,
      depth: 20
    });
    expect(evalRes.success).toBe(true);

    const after = BRepMutationGate277.captureSnapshot(evalRes.document);
    const gateVerdict = BRepMutationGate277.verify(before, after, 'SUBTRACTIVE');
    if (gateVerdict.status !== 'PASS') {
      console.log('GATE VERDICT FAILURE REASON:', gateVerdict.reason, 'DELTA:', gateVerdict.delta);
    }

    expect(gateVerdict.status).toBe('PASS');
    expect(gateVerdict.delta.topologyChanged).toBe(true);
  });
});
