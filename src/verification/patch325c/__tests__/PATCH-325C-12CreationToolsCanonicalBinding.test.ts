import { describe, it, expect } from 'vitest';
import { CanonicalIntentDispatcher277 } from '../../../engine/viewport/CanonicalIntentDispatcher277';
import { updateCanonicalSketchInDocument, createEmptyCanonicalSketch, getActiveCanonicalSketch } from '../../../engine/sketch/canonical/CanonicalSketchContract';
import { EngineeringDocument } from '../../../engine/cad-kernel/document/CADDocument';
import { DesignToolContractRegistry } from '../../../engine/cad-kernel/registry/DesignToolContractRegistry';
import {
  SketchLineIntent,
  SketchConstructionLineIntent,
  SketchCenterlineIntent,
  SketchPointIntent,
  SketchCircleIntent,
  SketchArcIntent,
  Sketch3PointArcIntent,
  SketchRectangleIntent,
  SketchPolygonIntent,
  SketchPolylineIntent,
  SketchSlotIntent,
  SketchEllipseIntent
} from '../../../engine/viewport/EngineeringIntent277';

describe('PATCH-325C — 12 Creation Tools Native Canonical Binding & Contract Proof', () => {
  const initialSketch = createEmptyCanonicalSketch('sketch_325c_root');
  const baseDoc: EngineeringDocument = updateCanonicalSketchInDocument(null, initialSketch);

  const getActiveSketch = (doc: EngineeringDocument) => {
    const s = getActiveCanonicalSketch(doc, 'sketch_325c_root');
    if (!s) throw new Error('Active sketch not found');
    return s;
  };

  it('1. SKETCH_LINE: Canonical dispatch creates line segment with terminal points in canonical document', async () => {
    const intent: SketchLineIntent = {
      intentId: 'int_line_001',
      toolId: 'SKETCH_LINE',
      documentId: baseDoc.documentId,
      parameters: {
        sketchId: 'sketch_325c_root',
        startX: 0,
        startY: 0,
        endX: 100,
        endY: 0
      },
      timestamp: new Date().toISOString()
    };

    const result = await CanonicalIntentDispatcher277.dispatch(intent, baseDoc);
    expect(result.success).toBe(true);
    expect(result.document).toBeDefined();

    const sketch = getActiveSketch(result.document!);
    const lines = Object.values(sketch.entities).filter(e => e.type === 'LINE');
    const points = Object.values(sketch.entities).filter(e => e.type === 'POINT');

    expect(lines.length).toBe(1);
    expect(points.length).toBe(2);
    expect((lines[0] as any).isConstruction).toBe(false);
    expect(result.evaluationResult?.solverStatus).toBeDefined();
  });

  it('2. SKETCH_CONSTRUCTION_LINE: Canonical dispatch creates construction line with isConstruction=true', async () => {
    const intent: SketchConstructionLineIntent = {
      intentId: 'int_cline_001',
      toolId: 'SKETCH_CONSTRUCTION_LINE',
      documentId: baseDoc.documentId,
      parameters: {
        sketchId: 'sketch_325c_root',
        startX: 0,
        startY: 0,
        endX: 50,
        endY: 50,
        isConstruction: true
      },
      timestamp: new Date().toISOString()
    };

    const result = await CanonicalIntentDispatcher277.dispatch(intent, baseDoc);
    expect(result.success).toBe(true);

    const sketch = getActiveSketch(result.document!);
    const lines = Object.values(sketch.entities).filter(e => e.type === 'LINE');
    expect(lines.length).toBe(1);
    expect((lines[0] as any).isConstruction).toBe(true);
  });

  it('3. SKETCH_CENTERLINE: Canonical dispatch creates centerline with isCenterline=true and isConstruction=true', async () => {
    const intent: SketchCenterlineIntent = {
      intentId: 'int_centerline_001',
      toolId: 'SKETCH_CENTERLINE',
      documentId: baseDoc.documentId,
      parameters: {
        sketchId: 'sketch_325c_root',
        startX: -50,
        startY: 0,
        endX: 50,
        endY: 0,
        isCenterline: true,
        isConstruction: true
      },
      timestamp: new Date().toISOString()
    };

    const result = await CanonicalIntentDispatcher277.dispatch(intent, baseDoc);
    expect(result.success).toBe(true);

    const sketch = getActiveSketch(result.document!);
    const lines = Object.values(sketch.entities).filter(e => e.type === 'LINE');
    expect(lines.length).toBe(1);
    expect((lines[0] as any).isCenterline).toBe(true);
    expect((lines[0] as any).isConstruction).toBe(true);
  });

  it('4. SKETCH_POINT: Canonical dispatch creates isolated 2D sketch point', async () => {
    const intent: SketchPointIntent = {
      intentId: 'int_pt_001',
      toolId: 'SKETCH_POINT',
      documentId: baseDoc.documentId,
      parameters: {
        sketchId: 'sketch_325c_root',
        x: 42,
        y: 84
      },
      timestamp: new Date().toISOString()
    };

    const result = await CanonicalIntentDispatcher277.dispatch(intent, baseDoc);
    expect(result.success).toBe(true);

    const sketch = getActiveSketch(result.document!);
    const points = Object.values(sketch.entities).filter(e => e.type === 'POINT');
    expect(points.length).toBe(1);
    expect(points[0].x).toBe(42);
    expect(points[0].y).toBe(84);
  });

  it('5. SKETCH_CIRCLE: Canonical dispatch creates center point and circle entity with radius parameter', async () => {
    const intent: SketchCircleIntent = {
      intentId: 'int_circ_001',
      toolId: 'SKETCH_CIRCLE',
      documentId: baseDoc.documentId,
      parameters: {
        sketchId: 'sketch_325c_root',
        centerX: 25,
        centerY: 25,
        radius: 30
      },
      timestamp: new Date().toISOString()
    };

    const result = await CanonicalIntentDispatcher277.dispatch(intent, baseDoc);
    expect(result.success).toBe(true);

    const sketch = getActiveSketch(result.document!);
    const circles = Object.values(sketch.entities).filter(e => e.type === 'CIRCLE');
    const points = Object.values(sketch.entities).filter(e => e.type === 'POINT');
    expect(circles.length).toBe(1);
    expect((circles[0] as any).radius).toBe(30);
    expect(points.length).toBe(1);
  });

  it('6. SKETCH_ARC: Canonical dispatch creates center-start-end arc curve', async () => {
    const intent: SketchArcIntent = {
      intentId: 'int_arc_001',
      toolId: 'SKETCH_ARC',
      documentId: baseDoc.documentId,
      parameters: {
        sketchId: 'sketch_325c_root',
        centerX: 0,
        centerY: 0,
        startX: 50,
        startY: 0,
        endX: 0,
        endY: 50
      },
      timestamp: new Date().toISOString()
    };

    const result = await CanonicalIntentDispatcher277.dispatch(intent, baseDoc);
    expect(result.success).toBe(true);

    const sketch = getActiveSketch(result.document!);
    const arcs = Object.values(sketch.entities).filter(e => e.type === 'ARC');
    expect(arcs.length).toBe(1);
    expect((arcs[0] as any).radius).toBeCloseTo(50, 4);
  });

  it('7. SKETCH_3POINT_ARC: Canonical dispatch creates arc through 3 points with circumcenter calculation', async () => {
    const intent: Sketch3PointArcIntent = {
      intentId: 'int_3pt_arc_001',
      toolId: 'SKETCH_3POINT_ARC',
      documentId: baseDoc.documentId,
      parameters: {
        sketchId: 'sketch_325c_root',
        p1: { x: 0, y: 0 },
        p2: { x: 100, y: 0 },
        p3: { x: 50, y: 25 }
      },
      timestamp: new Date().toISOString()
    };

    const result = await CanonicalIntentDispatcher277.dispatch(intent, baseDoc);
    expect(result.success).toBe(true);

    const sketch = getActiveSketch(result.document!);
    const arcs = Object.values(sketch.entities).filter(e => e.type === 'ARC');
    expect(arcs.length).toBe(1);
    expect((arcs[0] as any).radius).toBeGreaterThan(0);
  });

  it('8. SKETCH_RECTANGLE: Canonical dispatch creates 4 corner points, 4 lines and orthogonal/equal constraints', async () => {
    const intent: SketchRectangleIntent = {
      intentId: 'int_rect_001',
      toolId: 'SKETCH_RECTANGLE',
      documentId: baseDoc.documentId,
      parameters: {
        sketchId: 'sketch_325c_root',
        startX: 0,
        startY: 0,
        endX: 80,
        endY: 40
      },
      timestamp: new Date().toISOString()
    };

    const result = await CanonicalIntentDispatcher277.dispatch(intent, baseDoc);
    expect(result.success).toBe(true);

    const sketch = getActiveSketch(result.document!);
    const lines = Object.values(sketch.entities).filter(e => e.type === 'LINE');
    const points = Object.values(sketch.entities).filter(e => e.type === 'POINT');
    expect(lines.length).toBe(4);
    expect(points.length).toBe(4);
    expect(Object.keys(sketch.constraints).length).toBeGreaterThanOrEqual(4);
  });

  it('9. SKETCH_POLYGON: Canonical dispatch creates regular N-gon with N vertices, N segments, and constraints', async () => {
    const intent: SketchPolygonIntent = {
      intentId: 'int_polygon_001',
      toolId: 'SKETCH_POLYGON',
      documentId: baseDoc.documentId,
      parameters: {
        sketchId: 'sketch_325c_root',
        centerX: 0,
        centerY: 0,
        radius: 60,
        sides: 6
      },
      timestamp: new Date().toISOString()
    };

    const result = await CanonicalIntentDispatcher277.dispatch(intent, baseDoc);
    expect(result.success).toBe(true);

    const sketch = getActiveSketch(result.document!);
    const lines = Object.values(sketch.entities).filter(e => e.type === 'LINE');
    const points = Object.values(sketch.entities).filter(e => e.type === 'POINT');
    expect(lines.length).toBe(6);
    expect(points.length).toBe(7); // 6 perimeter vertices + 1 center point
  });

  it('10. SKETCH_POLYLINE: Canonical dispatch creates continuous connected polyline chain', async () => {
    const intent: SketchPolylineIntent = {
      intentId: 'int_polyline_001',
      toolId: 'SKETCH_POLYLINE',
      documentId: baseDoc.documentId,
      parameters: {
        sketchId: 'sketch_325c_root',
        points: [
          { x: 0, y: 0 },
          { x: 20, y: 30 },
          { x: 60, y: 40 },
          { x: 90, y: 10 }
        ],
        isClosed: false
      },
      timestamp: new Date().toISOString()
    };

    const result = await CanonicalIntentDispatcher277.dispatch(intent, baseDoc);
    expect(result.success).toBe(true);

    const sketch = getActiveSketch(result.document!);
    const lines = Object.values(sketch.entities).filter(e => e.type === 'LINE');
    const points = Object.values(sketch.entities).filter(e => e.type === 'POINT');
    expect(lines.length).toBe(3);
    expect(points.length).toBe(4);
  });

  it('11. SKETCH_SLOT: Canonical dispatch creates 2 straight lines, 2 rounded arcs, centerline and points', async () => {
    const intent: SketchSlotIntent = {
      intentId: 'int_slot_001',
      toolId: 'SKETCH_SLOT',
      documentId: baseDoc.documentId,
      parameters: {
        sketchId: 'sketch_325c_root',
        startX: 0,
        startY: 0,
        endX: 100,
        endY: 0,
        width: 30,
        type: 'STRAIGHT'
      },
      timestamp: new Date().toISOString()
    };

    const result = await CanonicalIntentDispatcher277.dispatch(intent, baseDoc);
    expect(result.success).toBe(true);

    const sketch = getActiveSketch(result.document!);
    const lines = Object.values(sketch.entities).filter(e => e.type === 'LINE');
    const arcs = Object.values(sketch.entities).filter(e => e.type === 'ARC');
    const centerlines = lines.filter(l => (l as any).isCenterline);

    expect(lines.length).toBe(3); // 2 side lines + 1 centerline
    expect(arcs.length).toBe(2);  // 2 end semi-circular arcs
    expect(centerlines.length).toBe(1);
  });

  it('12. SKETCH_ELLIPSE: Canonical dispatch creates ellipse entity with major/minor axes and focal parameters', async () => {
    const intent: SketchEllipseIntent = {
      intentId: 'int_ellipse_001',
      toolId: 'SKETCH_ELLIPSE',
      documentId: baseDoc.documentId,
      parameters: {
        sketchId: 'sketch_325c_root',
        centerX: 0,
        centerY: 0,
        majorX: 80,
        majorY: 0,
        minorRadius: 35
      },
      timestamp: new Date().toISOString()
    };

    const result = await CanonicalIntentDispatcher277.dispatch(intent, baseDoc);
    expect(result.success).toBe(true);

    const sketch = getActiveSketch(result.document!);
    const ellipses = Object.values(sketch.entities).filter(e => e.type === 'ELLIPSE');
    expect(ellipses.length).toBe(1);
    expect((ellipses[0] as any).majorRadius).toBeCloseTo(80, 4);
    expect((ellipses[0] as any).minorRadius).toBeCloseTo(35, 4);
  });

  it('13. Multi-Tool Composition: Sequential execution of multiple tools maintains monotonic document revisions and solver integrity', async () => {
    let currentDoc = baseDoc;

    const tools: { toolId: string; intent: any }[] = [
      {
        toolId: 'SKETCH_LINE',
        intent: {
          intentId: 'int_seq_1',
          toolId: 'SKETCH_LINE',
          documentId: currentDoc.documentId,
          parameters: { sketchId: 'sketch_325c_root', startX: 0, startY: 0, endX: 50, endY: 0 },
          timestamp: new Date().toISOString()
        }
      },
      {
        toolId: 'SKETCH_CIRCLE',
        intent: {
          intentId: 'int_seq_2',
          toolId: 'SKETCH_CIRCLE',
          documentId: currentDoc.documentId,
          parameters: { sketchId: 'sketch_325c_root', centerX: 50, centerY: 50, radius: 25 },
          timestamp: new Date().toISOString()
        }
      },
      {
        toolId: 'SKETCH_RECTANGLE',
        intent: {
          intentId: 'int_seq_3',
          toolId: 'SKETCH_RECTANGLE',
          documentId: currentDoc.documentId,
          parameters: { sketchId: 'sketch_325c_root', startX: 100, startY: 100, endX: 150, endY: 130 },
          timestamp: new Date().toISOString()
        }
      }
    ];

    let lastRev = Number(currentDoc.revision);

    for (const step of tools) {
      const res = await CanonicalIntentDispatcher277.dispatch(step.intent, currentDoc);
      expect(res.success).toBe(true);
      expect(res.document).toBeDefined();
      expect(Number(res.document!.revision)).toBeGreaterThan(lastRev);
      lastRev = Number(res.document!.revision);
      currentDoc = res.document!;
    }

    const finalSketch = getActiveSketch(currentDoc);
    expect(Object.keys(finalSketch.entities).length).toBeGreaterThanOrEqual(10);
  });

  it('14. DesignToolContractRegistry Audit: All 12 creation tools have complete, verified contracts registered', () => {
    const requiredTools = [
      'SKETCH_LINE',
      'SKETCH_CONSTRUCTION_LINE',
      'SKETCH_CENTERLINE',
      'SKETCH_POINT',
      'SKETCH_CIRCLE',
      'SKETCH_ARC',
      'SKETCH_3POINT_ARC',
      'SKETCH_RECTANGLE',
      'SKETCH_POLYGON',
      'SKETCH_POLYLINE',
      'SKETCH_SLOT',
      'SKETCH_ELLIPSE'
    ];

    for (const toolId of requiredTools) {
      const contract = DesignToolContractRegistry.get(toolId);
      expect(contract, `Contract for ${toolId} must be registered`).toBeDefined();
      expect(contract!.workbench).toBe('Sketch');
      expect(contract!.persistence).toBe('CANONICAL');
      expect(contract!.canonicalAction.status).toBe('IMPLEMENTED');
      expect(contract!.status.canonical).toBe(true);
      expect(contract!.status.implemented).toBe(true);
    }
  });
});
