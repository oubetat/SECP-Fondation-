import { describe, it, expect } from 'vitest';
import {
  createEmptyCanonicalSketch,
  mutateAddFlatEntities,
  mutateDeleteFlatEntity,
  mutateAddFlatConstraint
} from '../canonical/CanonicalSketchContract';
import { CanonicalSketchAdapter } from '../canonical/CanonicalSketchAdapter';

describe('Sketch Editor Tools Comprehensive Integration & Verification Suite', () => {

  it('TOOL 1: Circle Tool — creates circular entity with accurate center point and radius', () => {
    const sketch = createEmptyCanonicalSketch('sk-circ-01', 'Circle_Test', 'XY');

    const circleEntity = {
      id: 'ENT-CIRC-0001',
      type: 'CIRCLE',
      points: [{ x: 250, y: 150 }],
      params: { radius: 45 },
      constraints: [],
      isConstruction: false
    };

    const mutated = mutateAddFlatEntities(sketch, [circleEntity]);
    expect(mutated.revision).toBe(sketch.revision + 1);

    // Verify canonical entity structure
    const circCanonical = mutated.entities['ENT-CIRC-0001'] as any;
    expect(circCanonical).toBeDefined();
    expect(circCanonical.type).toBe('CIRCLE');
    expect(circCanonical.radius).toBe(45);
    expect(circCanonical.centerPointId).toBeDefined();

    // Verify center point in canonical entities
    const centerPoint = mutated.entities[circCanonical.centerPointId] as any;
    expect(centerPoint).toBeDefined();
    expect(centerPoint.type).toBe('POINT');
    expect(centerPoint.x).toBe(250);
    expect(centerPoint.y).toBe(150);

    // Verify flat entities projection for renderer
    const flat = CanonicalSketchAdapter.toFlatEntities(mutated);
    const flatCirc = flat.find(e => e.id === 'ENT-CIRC-0001');
    expect(flatCirc).toBeDefined();
    expect(flatCirc.type).toBe('CIRCLE');
    expect(flatCirc.points[0].x).toBe(250);
    expect(flatCirc.points[0].y).toBe(150);
    expect(flatCirc.params.radius).toBe(45);

    // Verify center point is also in flat entities
    const flatPt = flat.find(e => e.id === circCanonical.centerPointId);
    expect(flatPt).toBeDefined();
    expect(flatPt.points[0].x).toBe(250);
    expect(flatPt.points[0].y).toBe(150);
  });

  it('TOOL 1B: Circle Tool — supports multiple concentric and independent circles', () => {
    let sketch = createEmptyCanonicalSketch('sk-circ-multi', 'Multi_Circle', 'XY');

    const circleA = {
      id: 'ENT-CIRC-0001',
      type: 'CIRCLE',
      points: [{ x: 100, y: 100 }],
      params: { radius: 30 },
      constraints: [],
      isConstruction: false
    };

    const circleB = {
      id: 'ENT-CIRC-0002',
      type: 'CIRCLE',
      points: [{ x: 100, y: 100 }],
      params: { radius: 60 },
      constraints: ['CONCENTRIC'],
      isConstruction: false
    };

    const circleC = {
      id: 'ENT-CIRC-0003',
      type: 'CIRCLE',
      points: [{ x: 300, y: 300 }],
      params: { radius: 25 },
      constraints: [],
      isConstruction: true
    };

    sketch = mutateAddFlatEntities(sketch, [circleA]);
    sketch = mutateAddFlatEntities(sketch, [circleB]);
    sketch = mutateAddFlatEntities(sketch, [circleC]);

    const flat = CanonicalSketchAdapter.toFlatEntities(sketch);
    const circles = flat.filter(e => e.type === 'CIRCLE');
    expect(circles.length).toBe(3);

    const circC = circles.find(e => e.id === 'ENT-CIRC-0003');
    expect(circC?.isConstruction).toBe(true);
    expect(circC?.params.radius).toBe(25);
  });

  it('TOOL 2: Line & Construction Line & Centerline — creates line segments with proper flags', () => {
    const sketch = createEmptyCanonicalSketch('sk-line-01', 'Line_Test', 'XY');

    const solidLine = {
      id: 'ENT-LINE-0001',
      type: 'LINE',
      points: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
      params: {},
      constraints: ['HORIZONTAL'],
      isConstruction: false,
      isCenterline: false
    };

    const constLine = {
      id: 'ENT-LINE-0002',
      type: 'LINE',
      points: [{ x: 0, y: 0 }, { x: 0, y: 100 }],
      params: {},
      constraints: ['VERTICAL'],
      isConstruction: true,
      isCenterline: false
    };

    const centerline = {
      id: 'ENT-LINE-0003',
      type: 'LINE',
      points: [{ x: -50, y: 50 }, { x: 50, y: 50 }],
      params: {},
      constraints: ['HORIZONTAL'],
      isConstruction: true,
      isCenterline: true
    };

    const mutated = mutateAddFlatEntities(sketch, [solidLine, constLine, centerline]);
    const flat = CanonicalSketchAdapter.toFlatEntities(mutated);

    const l1 = flat.find(e => e.id === 'ENT-LINE-0001');
    expect(l1).toBeDefined();
    expect(l1?.isConstruction).toBe(false);

    const l2 = flat.find(e => e.id === 'ENT-LINE-0002');
    expect(l2).toBeDefined();
    expect(l2?.isConstruction).toBe(true);

    const l3 = flat.find(e => e.id === 'ENT-LINE-0003');
    expect(l3).toBeDefined();
    expect(l3?.isCenterline).toBe(true);
  });

  it('TOOL 3: Point Tool — creates standalone points', () => {
    const sketch = createEmptyCanonicalSketch('sk-pt-01', 'Point_Test', 'XY');

    const pt = {
      id: 'ENT-PT-0001',
      type: 'POINT',
      points: [{ x: 42, y: 88 }],
      params: {},
      constraints: [],
      isConstruction: false
    };

    const mutated = mutateAddFlatEntities(sketch, [pt]);
    const flat = CanonicalSketchAdapter.toFlatEntities(mutated);
    const foundPt = flat.find(e => e.id === 'ENT-PT-0001');
    expect(foundPt).toBeDefined();
    expect(foundPt?.points[0].x).toBe(42);
    expect(foundPt?.points[0].y).toBe(88);
  });

  it('TOOL 4: Rectangle Tool — decomposes into 4 boundary lines with geometric constraints', () => {
    const sketch = createEmptyCanonicalSketch('sk-rect-01', 'Rect_Test', 'XY');

    const rect = {
      id: 'ENT-RECT-0001',
      type: 'RECTANGLE',
      points: [{ x: 10, y: 20 }, { x: 110, y: 80 }],
      params: { width: 100, height: 60 },
      constraints: [],
      isConstruction: false
    };

    const mutated = mutateAddFlatEntities(sketch, [rect]);
    const flat = CanonicalSketchAdapter.toFlatEntities(mutated);

    // Decomposed into lines
    const lines = flat.filter(e => e.type === 'LINE');
    expect(lines.length).toBe(4);

    // Decomposed into points
    const points = flat.filter(e => e.type === 'POINT');
    expect(points.length).toBe(4);
  });

  it('TOOL 5: Arc & 3-Point Arc — creates arcs with center, start, end points and radius', () => {
    const sketch = createEmptyCanonicalSketch('sk-arc-01', 'Arc_Test', 'XY');

    const arc = {
      id: 'ENT-ARC-0001',
      type: 'ARC',
      points: [{ x: 0, y: 0 }, { x: 50, y: 25 }, { x: 100, y: 0 }],
      params: { radius: 55 },
      constraints: [],
      isConstruction: false
    };

    const mutated = mutateAddFlatEntities(sketch, [arc]);
    const flat = CanonicalSketchAdapter.toFlatEntities(mutated);
    const foundArc = flat.find(e => e.id === 'ENT-ARC-0001');
    expect(foundArc).toBeDefined();
    expect(foundArc?.type).toBe('ARC');
    expect(foundArc?.params.radius).toBe(55);
  });

  it('TOOL 6: Ellipse Tool — creates ellipse with center point, major and minor radii', () => {
    const sketch = createEmptyCanonicalSketch('sk-ell-01', 'Ellipse_Test', 'XY');

    const ellipse = {
      id: 'ENT-ELLIPSE-0001',
      type: 'ELLIPSE',
      points: [{ x: 150, y: 150 }],
      params: { rx: 70, ry: 35 },
      constraints: [],
      isConstruction: false
    };

    const mutated = mutateAddFlatEntities(sketch, [ellipse]);
    const flat = CanonicalSketchAdapter.toFlatEntities(mutated);
    const foundEll = flat.find(e => e.id === 'ENT-ELLIPSE-0001');
    expect(foundEll).toBeDefined();
    expect(foundEll?.type).toBe('ELLIPSE');
    expect(foundEll?.params.rx).toBe(70);
    expect(foundEll?.params.ry).toBe(35);
  });

  it('TOOL 7: Polygon Tool — creates regular closed polygon with all vertices and perimeter segments', () => {
    const sketch = createEmptyCanonicalSketch('sk-poly-01', 'Polygon_Test', 'XY');

    const polygon = {
      id: 'ENT-POLY-0001',
      type: 'POLYGON',
      points: [{ x: 200, y: 200 }],
      params: { sides: 6, radius: 50 },
      constraints: [],
      isConstruction: false
    };

    const mutated = mutateAddFlatEntities(sketch, [polygon]);
    const flat = CanonicalSketchAdapter.toFlatEntities(mutated);

    const polyLines = flat.filter(e => e.type === 'LINE' && e.id.startsWith('ENT-POLY-0001_SEG_'));
    expect(polyLines.length).toBe(6);

    const polyPoints = flat.filter(e => e.type === 'POINT' && e.id.startsWith('P_POLY_'));
    expect(polyPoints.length).toBe(6);
  });

  it('TOOL 8: Slot Tool — creates straight slot contour with 2 lines, 2 arcs and 4 points', () => {
    const sketch = createEmptyCanonicalSketch('sk-slot-01', 'Slot_Test', 'XY');

    const slot = {
      id: 'ENT-SLOT-0001',
      type: 'SLOT',
      points: [{ x: 50, y: 50 }, { x: 150, y: 50 }],
      params: { slotWidth: 30 },
      constraints: [],
      isConstruction: false
    };

    const mutated = mutateAddFlatEntities(sketch, [slot]);
    const flat = CanonicalSketchAdapter.toFlatEntities(mutated);

    const slotLines = flat.filter(e => e.type === 'LINE' && e.id.startsWith('ENT-SLOT-0001_L'));
    expect(slotLines.length).toBe(2);

    const slotArcs = flat.filter(e => e.type === 'ARC' && e.id.startsWith('ENT-SLOT-0001_ARC'));
    expect(slotArcs.length).toBe(2);
    expect(slotArcs[0].params.radius).toBe(15);
  });

  it('TOOL 9: Spline Tool — creates multi-segment spline curve chain', () => {
    const sketch = createEmptyCanonicalSketch('sk-spl-01', 'Spline_Test', 'XY');

    const spline = {
      id: 'ENT-SPLINE-0001',
      type: 'SPLINE',
      points: [{ x: 0, y: 0 }, { x: 30, y: 60 }, { x: 70, y: -40 }, { x: 100, y: 0 }],
      params: { segments: 4 },
      constraints: [],
      isConstruction: false
    };

    const mutated = mutateAddFlatEntities(sketch, [spline]);
    const flat = CanonicalSketchAdapter.toFlatEntities(mutated);

    const splineSegments = flat.filter(e => e.type === 'LINE' && e.id.startsWith('ENT-SPLINE-0001_SEG_'));
    expect(splineSegments.length).toBe(3);
  });

  it('TOOL 10: Trim Tool — deletes target entity cleanly from canonical sketch', () => {
    const sketch = createEmptyCanonicalSketch('sk-trim-01', 'Trim_Test', 'XY');

    const circle = {
      id: 'ENT-CIRC-TRIM',
      type: 'CIRCLE',
      points: [{ x: 100, y: 100 }],
      params: { radius: 40 },
      constraints: [],
      isConstruction: false
    };

    const withCircle = mutateAddFlatEntities(sketch, [circle]);
    expect(CanonicalSketchAdapter.toFlatEntities(withCircle).some(e => e.id === 'ENT-CIRC-TRIM')).toBe(true);

    const trimmed = mutateDeleteFlatEntity(withCircle, 'ENT-CIRC-TRIM');
    expect(CanonicalSketchAdapter.toFlatEntities(trimmed).some(e => e.id === 'ENT-CIRC-TRIM')).toBe(false);
  });

  it('TOOL 11: Dimension Tool — attaches constraints to sketch entities', () => {
    const sketch = createEmptyCanonicalSketch('sk-dim-01', 'Dim_Test', 'XY');

    const pt = {
      id: 'ENT-PT-FIX',
      type: 'POINT',
      points: [{ x: 0, y: 0 }],
      params: {},
      constraints: [],
      isConstruction: false
    };

    const withPt = mutateAddFlatEntities(sketch, [pt]);
    const constrained = mutateAddFlatConstraint(withPt, 'ENT-PT-FIX', 'FIX');

    const flat = CanonicalSketchAdapter.toFlatEntities(constrained);
    const target = flat.find(e => e.id === 'ENT-PT-FIX');
    expect(target).toBeDefined();
    expect(target?.constraints).toContain('FIX');
  });

});
