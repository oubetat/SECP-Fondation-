import { describe, it, expect } from 'vitest';
import { SketchCreationTools } from '../SketchCreationTools';
import { IndustrialSketchDefinition } from '../IndustrialConstraintTypes';
import { IndustrialVariationalSolver } from '../IndustrialVariationalSolver';

describe('PATCH-325 — Sketch Creation Tools Engine', () => {
  const createEmptySketch = (): IndustrialSketchDefinition => ({
    id: 'test-sketch-325',
    name: 'Creation_Tools_Sketch',
    plane: 'XY',
    revision: 1,
    entities: {},
    constraints: {}
  });

  // --------------------------------------------------------------------------
  // 1. LINE
  // --------------------------------------------------------------------------
  it('TOOL 1: Line creates valid 2D line segment with endpoints and length', () => {
    const res = SketchCreationTools.createLine({ x: 0, y: 0 }, { x: 100, y: 0 });
    expect(res.tool).toBe('LINE');
    expect(res.pointIds.length).toBe(2);
    expect(res.entityIds.length).toBe(1);

    const line = res.entities[res.primaryEntityId] as any;
    expect(line.type).toBe('LINE');
    expect(line.isConstruction).toBe(false);
    expect(line.isCenterline).toBe(false);
    expect(res.metadata.length).toBeCloseTo(100, 4);

    // Auto-horizontal constraint detected
    const constraints = Object.values(res.constraints);
    expect(constraints.some(c => c.type === 'HORIZONTAL')).toBe(true);
  });

  // --------------------------------------------------------------------------
  // 2. CONSTRUCTION LINE
  // --------------------------------------------------------------------------
  it('TOOL 2: Construction Line sets isConstruction to true and isCenterline to false', () => {
    const res = SketchCreationTools.createConstructionLine({ x: 10, y: 20 }, { x: 10, y: 150 });
    expect(res.tool).toBe('CONSTRUCTION_LINE');
    const line = res.entities[res.primaryEntityId] as any;
    expect(line.type).toBe('LINE');
    expect(line.isConstruction).toBe(true);
    expect(line.isCenterline).toBe(false);

    // Auto-vertical constraint detected
    const constraints = Object.values(res.constraints);
    expect(constraints.some(c => c.type === 'VERTICAL')).toBe(true);
  });

  // --------------------------------------------------------------------------
  // 3. CENTERLINE
  // --------------------------------------------------------------------------
  it('TOOL 3: Centerline sets isConstruction and isCenterline flags for symmetry/axis references', () => {
    const res = SketchCreationTools.createCenterline({ x: 0, y: 0 }, { x: 0, y: 200 });
    expect(res.tool).toBe('CENTERLINE');
    const line = res.entities[res.primaryEntityId] as any;
    expect(line.type).toBe('LINE');
    expect(line.isConstruction).toBe(true);
    expect(line.isCenterline).toBe(true);
    expect(line.tag).toBe('CENTERLINE');
  });

  // --------------------------------------------------------------------------
  // 4. POINT
  // --------------------------------------------------------------------------
  it('TOOL 4: Point creates standalone point entity with optional fixed constraint datum', () => {
    const res = SketchCreationTools.createPoint({ x: 45.5, y: -80.2 }, { isFixed: true });
    expect(res.tool).toBe('POINT');
    const pt = res.entities[res.primaryEntityId] as any;
    expect(pt.type).toBe('POINT');
    expect(pt.x).toBeCloseTo(45.5, 4);
    expect(pt.y).toBeCloseTo(-80.2, 4);
    expect(pt.isFixed).toBe(true);
  });

  // --------------------------------------------------------------------------
  // 5. CIRCLE (Center-Radius & 3-Point)
  // --------------------------------------------------------------------------
  it('TOOL 5: Circle creates center point and circle with radius and perimeter metrics', () => {
    const res = SketchCreationTools.createCircle({ x: 50, y: 50 }, 25);
    expect(res.tool).toBe('CIRCLE');
    const circ = res.entities[res.primaryEntityId] as any;
    expect(circ.type).toBe('CIRCLE');
    expect(circ.radius).toBe(25);
    expect(res.metadata.diameter).toBe(50);
    expect(res.metadata.area).toBeCloseTo(Math.PI * 625, 4);

    // 3-Point Circle calculation
    const p1 = { x: 0, y: 0 };
    const p2 = { x: 40, y: 0 };
    const p3 = { x: 20, y: 20 };
    const circ3P = SketchCreationTools.createCircle3Point(p1, p2, p3);
    const cEnt = circ3P.entities[circ3P.primaryEntityId] as any;
    const centerPt = circ3P.entities[cEnt.centerPointId] as any;
    expect(centerPt.x).toBeCloseTo(20, 4);
    expect(centerPt.y).toBeCloseTo(0, 4);
    expect(cEnt.radius).toBeCloseTo(20, 4);
  });

  // --------------------------------------------------------------------------
  // 6. ARC (Center-Start-End)
  // --------------------------------------------------------------------------
  it('TOOL 6: Arc creates center, start, end points with exact radius and sweep', () => {
    const res = SketchCreationTools.createArc({ x: 0, y: 0 }, 50, 0, Math.PI / 2, { direction: 'CCW' });
    expect(res.tool).toBe('ARC');
    const arc = res.entities[res.primaryEntityId] as any;
    expect(arc.type).toBe('ARC');
    expect(arc.radius).toBe(50);
    expect(arc.direction).toBe('CCW');
    expect(res.metadata.sweepRad).toBeCloseTo(Math.PI / 2, 4);
    expect(res.metadata.arcLength).toBeCloseTo(25 * Math.PI, 4);
  });

  // --------------------------------------------------------------------------
  // 7. 3-POINT ARC
  // --------------------------------------------------------------------------
  it('TOOL 7: 3-Point Arc computes exact circumcenter passing through all 3 specified points', () => {
    const p1 = { x: -30, y: 0 };
    const p2 = { x: 30, y: 0 };
    const p3 = { x: 0, y: 30 }; // Peak apex point

    const res = SketchCreationTools.create3PointArc(p1, p2, p3);
    expect(res.tool).toBe('3POINT_ARC');
    const arc = res.entities[res.primaryEntityId] as any;
    const centerPt = res.entities[arc.centerPointId] as any;

    expect(centerPt.x).toBeCloseTo(0, 4);
    expect(centerPt.y).toBeCloseTo(0, 4);
    expect(arc.radius).toBeCloseTo(30, 4);

    // Verify distance from center to all 3 points equals radius
    const d1 = Math.hypot(p1.x - centerPt.x, p1.y - centerPt.y);
    const d2 = Math.hypot(p2.x - centerPt.x, p2.y - centerPt.y);
    const d3 = Math.hypot(p3.x - centerPt.x, p3.y - centerPt.y);
    expect(d1).toBeCloseTo(arc.radius, 4);
    expect(d2).toBeCloseTo(arc.radius, 4);
    expect(d3).toBeCloseTo(arc.radius, 4);
  });

  // --------------------------------------------------------------------------
  // 8. RECTANGLE (Corner & Center)
  // --------------------------------------------------------------------------
  it('TOOL 8: Rectangle creates 4 points, 4 lines, and orthogonal constraints', () => {
    // A. Corner Rectangle
    const cornerRes = SketchCreationTools.createRectangle({ x: 10, y: 20 }, { x: 110, y: 80 }, { type: 'CORNER' });
    expect(cornerRes.tool).toBe('RECTANGLE');
    expect(cornerRes.pointIds.length).toBe(4);
    expect(cornerRes.entityIds.length).toBe(4);
    expect(cornerRes.metadata.width).toBe(100);
    expect(cornerRes.metadata.height).toBe(60);
    expect(cornerRes.metadata.area).toBe(6000);

    const cornerCons = Object.values(cornerRes.constraints);
    expect(cornerCons.filter(c => c.type === 'HORIZONTAL').length).toBe(2);
    expect(cornerCons.filter(c => c.type === 'VERTICAL').length).toBe(2);

    // B. Center Rectangle
    const centerRes = SketchCreationTools.createRectangle({ x: 50, y: 50 }, { x: 80, y: 70 }, { type: 'CENTER' });
    expect(centerRes.metadata.mode).toBe('CENTER');
    // In center mode: 4 corner points + 1 center point = 5 points
    expect(centerRes.pointIds.length).toBe(5);
    // 4 perimeter lines + 2 diagonal construction lines = 6 entities
    expect(centerRes.entityIds.length).toBe(6);
  });

  // --------------------------------------------------------------------------
  // 9. POLYGON
  // --------------------------------------------------------------------------
  it('TOOL 9: Polygon creates regular N-gon with N vertices, N edges, equal constraints, and ref circle', () => {
    const res = SketchCreationTools.createPolygon({ x: 100, y: 100 }, 50, 6); // Hexagon
    expect(res.tool).toBe('POLYGON');
    expect(res.metadata.sides).toBe(6);

    // 1 center + 6 vertices = 7 points
    expect(res.pointIds.length).toBe(7);
    // 1 reference circle + 6 perimeter lines = 7 entities
    expect(res.entityIds.length).toBe(7);

    // Equal edge length constraints
    const eqConstraints = Object.values(res.constraints).filter(c => c.type === 'EQUAL');
    expect(eqConstraints.length).toBe(5);
    expect(res.metadata.sideLength).toBeCloseTo(50, 4); // For hexagon, edge length = radius
  });

  // --------------------------------------------------------------------------
  // 10. POLYLINE
  // --------------------------------------------------------------------------
  it('TOOL 10: Polyline creates connected chain of line segments sharing endpoints', () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 50, y: 20 },
      { x: 80, y: -10 },
      { x: 120, y: 40 }
    ];

    const res = SketchCreationTools.createPolyline(pts, { closed: true });
    expect(res.tool).toBe('POLYLINE');
    expect(res.pointIds.length).toBe(4);
    // 3 segments + 1 closing segment = 4 lines
    expect(res.entityIds.length).toBe(4);
    expect(res.metadata.closed).toBe(true);
    expect(res.metadata.totalLength).toBeGreaterThan(150);
  });

  // --------------------------------------------------------------------------
  // 11. SLOT
  // --------------------------------------------------------------------------
  it('TOOL 11: Slot creates straight slot with 2 semicircular arcs, 2 tangent lines, and centerline', () => {
    const start = { x: 0, y: 0 };
    const end = { x: 100, y: 0 };
    const width = 30; // Radius = 15

    const res = SketchCreationTools.createSlot(start, end, width);
    expect(res.tool).toBe('SLOT');
    expect(res.metadata.width).toBe(30);
    expect(res.metadata.radius).toBe(15);
    expect(res.metadata.centerDistance).toBe(100);
    expect(res.metadata.totalLength).toBe(130);

    // 2 centers + 4 corner points = 6 points
    expect(res.pointIds.length).toBe(6);
    // 1 centerline + 2 lines + 2 arcs = 5 entities
    expect(res.entityIds.length).toBe(5);

    // Verify constraints: Parallel, Equal radius, Tangents
    const cons = Object.values(res.constraints);
    expect(cons.some(c => c.type === 'PARALLEL')).toBe(true);
    expect(cons.some(c => c.type === 'EQUAL')).toBe(true);
    expect(cons.some(c => c.type === 'TANGENT')).toBe(true);
  });

  // --------------------------------------------------------------------------
  // 12. ELLIPSE
  // --------------------------------------------------------------------------
  it('TOOL 12: Ellipse creates major and minor axes, perpendicular constraint, and ellipse entity', () => {
    const center = { x: 0, y: 0 };
    const majorPt = { x: 80, y: 0 };
    const minorRadius = 40;

    const res = SketchCreationTools.createEllipse(center, majorPt, minorRadius);
    expect(res.tool).toBe('ELLIPSE');
    const ellipse = res.entities[res.primaryEntityId] as any;
    expect(ellipse.type).toBe('ELLIPSE');
    expect(ellipse.majorRadius).toBe(80);
    expect(ellipse.minorRadius).toBe(40);
    expect(res.metadata.area).toBeCloseTo(Math.PI * 80 * 40, 4);

    // 1 center + 2 major endpoints + 2 minor endpoints = 5 points
    expect(res.pointIds.length).toBe(5);
    // 1 ellipse + 1 major axis centerline + 1 minor axis centerline = 3 entities
    expect(res.entityIds.length).toBe(3);

    // Perpendicular constraint between major and minor axes
    const cons = Object.values(res.constraints);
    expect(cons.some(c => c.type === 'PERPENDICULAR')).toBe(true);
  });

  // --------------------------------------------------------------------------
  // INTEGRATION & SOLVER STABILITY
  // --------------------------------------------------------------------------
  it('INTEGRATION: Applying created tools to sketch definition works with IndustrialVariationalSolver', () => {
    let sketch = createEmptySketch();
    const solver = new IndustrialVariationalSolver();

    // 1. Add Rectangle
    const rect = SketchCreationTools.createRectangle({ x: 0, y: 0 }, { x: 100, y: 80 });
    sketch = SketchCreationTools.applyToSketch(sketch, rect);

    // 2. Add Centerline
    const cLine = SketchCreationTools.createCenterline({ x: 50, y: 0 }, { x: 50, y: 80 });
    sketch = SketchCreationTools.applyToSketch(sketch, cLine);

    // 3. Add Slot
    const slot = SketchCreationTools.createSlot({ x: 20, y: 40 }, { x: 80, y: 40 }, 16);
    sketch = SketchCreationTools.applyToSketch(sketch, slot);

    // 4. Add 3-Point Arc
    const arc3P = SketchCreationTools.create3PointArc({ x: 100, y: 20 }, { x: 100, y: 60 }, { x: 120, y: 40 });
    sketch = SketchCreationTools.applyToSketch(sketch, arc3P);

    expect(Object.keys(sketch.entities).length).toBeGreaterThan(15);
    expect(Object.keys(sketch.constraints).length).toBeGreaterThan(5);

    // Solve should succeed without exceptions
    const solveReport = solver.solve(sketch);
    expect(solveReport.sketch).toBeDefined();
    expect(solveReport.solutionState).toBeDefined();
    expect(solveReport.dofReport).toBeDefined();
  });
});
