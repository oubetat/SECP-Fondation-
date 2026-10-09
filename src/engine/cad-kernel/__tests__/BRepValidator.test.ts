import { describe, it, expect } from 'vitest';
import { BRepValidator } from '../brep/BRepValidator';
import { 
  TopoShapeEnum, Vertex, Edge, Loop, Face, Shell, Solid, Orientation, OrientedEdge, OrientedFace
} from '../topology/TopologyContracts';
import { Point, Curve, Surface } from '../geometry/GeometryContracts';

const dummyGeom: any = { evaluate: () => ({x:0, y:0, z:0}), domain: () => ({uMin:0, uMax:1}) };

describe('PATCH-016 — Robust B-Rep Core Validation', () => {

  const createPt = (x:number, y:number, z:number): Point => ({ x, y, z });

  it('TEST-01: Valid tetrahedral topology', () => {
    // 4 vertices
    const v1: Vertex = { id: 'v1', shapeType: TopoShapeEnum.VERTEX, geometry: createPt(0,0,0), tolerance: 1e-7 };
    const v2: Vertex = { id: 'v2', shapeType: TopoShapeEnum.VERTEX, geometry: createPt(1,0,0), tolerance: 1e-7 };
    const v3: Vertex = { id: 'v3', shapeType: TopoShapeEnum.VERTEX, geometry: createPt(0,1,0), tolerance: 1e-7 };
    const v4: Vertex = { id: 'v4', shapeType: TopoShapeEnum.VERTEX, geometry: createPt(0,0,1), tolerance: 1e-7 };

    // 6 edges
    const e12: Edge = { id: 'e12', shapeType: TopoShapeEnum.EDGE, geometry: dummyGeom, startVertex: v1, endVertex: v2, tolerance: 1e-7 };
    const e23: Edge = { id: 'e23', shapeType: TopoShapeEnum.EDGE, geometry: dummyGeom, startVertex: v2, endVertex: v3, tolerance: 1e-7 };
    const e31: Edge = { id: 'e31', shapeType: TopoShapeEnum.EDGE, geometry: dummyGeom, startVertex: v3, endVertex: v1, tolerance: 1e-7 };
    
    const e14: Edge = { id: 'e14', shapeType: TopoShapeEnum.EDGE, geometry: dummyGeom, startVertex: v1, endVertex: v4, tolerance: 1e-7 };
    const e24: Edge = { id: 'e24', shapeType: TopoShapeEnum.EDGE, geometry: dummyGeom, startVertex: v2, endVertex: v4, tolerance: 1e-7 };
    const e34: Edge = { id: 'e34', shapeType: TopoShapeEnum.EDGE, geometry: dummyGeom, startVertex: v3, endVertex: v4, tolerance: 1e-7 };

    // Faces: (1,2,3), (1,4,2), (2,4,3), (3,4,1)
    const l123: Loop = { id: 'l1', shapeType: TopoShapeEnum.LOOP, orientedEdges: [
      { edge: e12, orientation: Orientation.FORWARD },
      { edge: e23, orientation: Orientation.FORWARD },
      { edge: e31, orientation: Orientation.FORWARD }
    ]};
    const f123: Face = { id: 'f1', shapeType: TopoShapeEnum.FACE, geometry: dummyGeom, outerLoop: l123, innerLoops: [] };

    const l142: Loop = { id: 'l2', shapeType: TopoShapeEnum.LOOP, orientedEdges: [
      { edge: e14, orientation: Orientation.FORWARD },
      { edge: e24, orientation: Orientation.REVERSED },
      { edge: e12, orientation: Orientation.REVERSED }
    ]};
    const f142: Face = { id: 'f2', shapeType: TopoShapeEnum.FACE, geometry: dummyGeom, outerLoop: l142, innerLoops: [] };

    const l243: Loop = { id: 'l3', shapeType: TopoShapeEnum.LOOP, orientedEdges: [
      { edge: e24, orientation: Orientation.FORWARD },
      { edge: e34, orientation: Orientation.REVERSED },
      { edge: e23, orientation: Orientation.REVERSED }
    ]};
    const f243: Face = { id: 'f3', shapeType: TopoShapeEnum.FACE, geometry: dummyGeom, outerLoop: l243, innerLoops: [] };

    const l341: Loop = { id: 'l4', shapeType: TopoShapeEnum.LOOP, orientedEdges: [
      { edge: e34, orientation: Orientation.FORWARD },
      { edge: e14, orientation: Orientation.REVERSED },
      { edge: e31, orientation: Orientation.REVERSED }
    ]};
    const f341: Face = { id: 'f4', shapeType: TopoShapeEnum.FACE, geometry: dummyGeom, outerLoop: l341, innerLoops: [] };

    const shell: Shell = { id: 'sh1', shapeType: TopoShapeEnum.SHELL, orientedFaces: [
      { face: f123, orientation: Orientation.FORWARD },
      { face: f142, orientation: Orientation.FORWARD },
      { face: f243, orientation: Orientation.FORWARD },
      { face: f341, orientation: Orientation.FORWARD }
    ]};

    const solid: Solid = { id: 'solid1', shapeType: TopoShapeEnum.SOLID, outerShell: shell, innerShells: [] };

    const validator = new BRepValidator();
    const res = validator.validate(solid);

    expect(res.topologyValid).toBe(true);
    expect(res.status).toBe('VALID');
    expect(res.manifoldStatus).toBe('MANIFOLD');
  });

  it('TEST-02: Missing vertex reference', () => {
    const edge: Edge = { id: 'e1', shapeType: TopoShapeEnum.EDGE, geometry: dummyGeom, startVertex: undefined as any, endVertex: undefined as any, tolerance: 1e-7 };
    const res = new BRepValidator().validate(edge);
    expect(res.status).toBe('INVALID');
    expect(res.diagnostics.some(d => d.code === 'DANGLING_TOPOLOGY')).toBe(true);
  });

  it('TEST-03: Missing curve reference', () => {
    const v1: Vertex = { id: 'v1', shapeType: TopoShapeEnum.VERTEX, geometry: createPt(0,0,0), tolerance: 1e-7 };
    const edge: Edge = { id: 'e1', shapeType: TopoShapeEnum.EDGE, geometry: undefined as any, startVertex: v1, endVertex: v1, tolerance: 1e-7 };
    const res = new BRepValidator().validate(edge);
    expect(res.status).toBe('INVALID');
    expect(res.diagnostics.some(d => d.code === 'INVALID_GEOMETRY_REFERENCE')).toBe(true);
  });

  it('TEST-04: Broken loop connectivity', () => {
    const v1: Vertex = { id: 'v1', shapeType: TopoShapeEnum.VERTEX, geometry: createPt(0,0,0), tolerance: 1e-7 };
    const v2: Vertex = { id: 'v2', shapeType: TopoShapeEnum.VERTEX, geometry: createPt(1,0,0), tolerance: 1e-7 };
    const v3: Vertex = { id: 'v3', shapeType: TopoShapeEnum.VERTEX, geometry: createPt(0,1,0), tolerance: 1e-7 };
    const v4: Vertex = { id: 'v4', shapeType: TopoShapeEnum.VERTEX, geometry: createPt(0,0,1), tolerance: 1e-7 };

    const e12: Edge = { id: 'e12', shapeType: TopoShapeEnum.EDGE, geometry: dummyGeom, startVertex: v1, endVertex: v2, tolerance: 1e-7 };
    const e34: Edge = { id: 'e34', shapeType: TopoShapeEnum.EDGE, geometry: dummyGeom, startVertex: v3, endVertex: v4, tolerance: 1e-7 };

    const loop: Loop = { id: 'l1', shapeType: TopoShapeEnum.LOOP, orientedEdges: [
      { edge: e12, orientation: Orientation.FORWARD },
      { edge: e34, orientation: Orientation.FORWARD } // broken, v2 != v3
    ]};
    const res = new BRepValidator().validate(loop);
    expect(res.status).toBe('INVALID');
    expect(res.diagnostics.some(d => d.code === 'BROKEN_LOOP_CLOSURE')).toBe(true);
  });

  it('TEST-05: Closed loop with correct edge orientation', () => {
    const v1: Vertex = { id: 'v1', shapeType: TopoShapeEnum.VERTEX, geometry: createPt(0,0,0), tolerance: 1e-7 };
    const e11: Edge = { id: 'e11', shapeType: TopoShapeEnum.EDGE, geometry: dummyGeom, startVertex: v1, endVertex: v1, tolerance: 1e-7 };
    const loop: Loop = { id: 'l1', shapeType: TopoShapeEnum.LOOP, orientedEdges: [
      { edge: e11, orientation: Orientation.FORWARD }
    ]};
    const res = new BRepValidator().validate(loop);
    expect(res.status).toBe('VALID');
  });

  it('TEST-06: Same loop with one reversed edge incorrectly', () => {
    const v1: Vertex = { id: 'v1', shapeType: TopoShapeEnum.VERTEX, geometry: createPt(0,0,0), tolerance: 1e-7 };
    const v2: Vertex = { id: 'v2', shapeType: TopoShapeEnum.VERTEX, geometry: createPt(1,0,0), tolerance: 1e-7 };
    const v3: Vertex = { id: 'v3', shapeType: TopoShapeEnum.VERTEX, geometry: createPt(0,1,0), tolerance: 1e-7 };

    const e12: Edge = { id: 'e12', shapeType: TopoShapeEnum.EDGE, geometry: dummyGeom, startVertex: v1, endVertex: v2, tolerance: 1e-7 };
    const e23: Edge = { id: 'e23', shapeType: TopoShapeEnum.EDGE, geometry: dummyGeom, startVertex: v2, endVertex: v3, tolerance: 1e-7 };
    const e31: Edge = { id: 'e31', shapeType: TopoShapeEnum.EDGE, geometry: dummyGeom, startVertex: v3, endVertex: v1, tolerance: 1e-7 };
    
    // Reverse e23 incorrectly
    const loop: Loop = { id: 'l1', shapeType: TopoShapeEnum.LOOP, orientedEdges: [
      { edge: e12, orientation: Orientation.FORWARD },
      { edge: e23, orientation: Orientation.REVERSED }, // end is v2, start is v3 -> doesn't match e12's v2
      { edge: e31, orientation: Orientation.FORWARD }
    ]};
    const res = new BRepValidator().validate(loop);
    expect(res.status).toBe('INVALID');
    expect(res.diagnostics.some(d => d.code === 'BROKEN_LOOP_CLOSURE')).toBe(true);
  });

  it('TEST-07: Open shell', () => {
    const v1: Vertex = { id: 'v1', shapeType: TopoShapeEnum.VERTEX, geometry: createPt(0,0,0), tolerance: 1e-7 };
    const v2: Vertex = { id: 'v2', shapeType: TopoShapeEnum.VERTEX, geometry: createPt(1,0,0), tolerance: 1e-7 };
    const v3: Vertex = { id: 'v3', shapeType: TopoShapeEnum.VERTEX, geometry: createPt(0,1,0), tolerance: 1e-7 };

    const e12: Edge = { id: 'e12', shapeType: TopoShapeEnum.EDGE, geometry: dummyGeom, startVertex: v1, endVertex: v2, tolerance: 1e-7 };
    const e23: Edge = { id: 'e23', shapeType: TopoShapeEnum.EDGE, geometry: dummyGeom, startVertex: v2, endVertex: v3, tolerance: 1e-7 };
    const e31: Edge = { id: 'e31', shapeType: TopoShapeEnum.EDGE, geometry: dummyGeom, startVertex: v3, endVertex: v1, tolerance: 1e-7 };
    
    const loop: Loop = { id: 'l1', shapeType: TopoShapeEnum.LOOP, orientedEdges: [
      { edge: e12, orientation: Orientation.FORWARD },
      { edge: e23, orientation: Orientation.FORWARD },
      { edge: e31, orientation: Orientation.FORWARD }
    ]};
    const face: Face = { id: 'f1', shapeType: TopoShapeEnum.FACE, geometry: dummyGeom, outerLoop: loop, innerLoops: [] };
    const shell: Shell = { id: 'sh1', shapeType: TopoShapeEnum.SHELL, orientedFaces: [ { face, orientation: Orientation.FORWARD } ] };

    const res = new BRepValidator().validate(shell);
    expect(res.status).toBe('VALID');
    expect(res.manifoldStatus).toBe('OPEN');
  });

  it('TEST-08: Closed manifold shell', () => {
    // Handled inherently by TEST-01 which yields MANIFOLD status.
    expect(true).toBe(true);
  });

  it('TEST-09: Edge shared by three faces', () => {
    const v1: Vertex = { id: 'v1', shapeType: TopoShapeEnum.VERTEX, geometry: createPt(0,0,0), tolerance: 1e-7 };
    const v2: Vertex = { id: 'v2', shapeType: TopoShapeEnum.VERTEX, geometry: createPt(1,0,0), tolerance: 1e-7 };
    const e12: Edge = { id: 'e12', shapeType: TopoShapeEnum.EDGE, geometry: dummyGeom, startVertex: v1, endVertex: v2, tolerance: 1e-7 };
    
    // We create a shell with 3 faces that all use e12
    const makeFace = (id: string, e: Edge) => {
      // Just a dummy loop containing e12 to v1 (closed loop with 2 edges)
      const e21: Edge = { id: `${id}_e21`, shapeType: TopoShapeEnum.EDGE, geometry: dummyGeom, startVertex: v2, endVertex: v1, tolerance: 1e-7 };
      const loop: Loop = { id: `${id}_l`, shapeType: TopoShapeEnum.LOOP, orientedEdges: [
        { edge: e, orientation: Orientation.FORWARD },
        { edge: e21, orientation: Orientation.FORWARD }
      ]};
      return { id, shapeType: TopoShapeEnum.FACE, geometry: dummyGeom, outerLoop: loop, innerLoops: [] } as Face;
    };

    const shell: Shell = { id: 'sh1', shapeType: TopoShapeEnum.SHELL, orientedFaces: [
      { face: makeFace('f1', e12), orientation: Orientation.FORWARD },
      { face: makeFace('f2', e12), orientation: Orientation.FORWARD },
      { face: makeFace('f3', e12), orientation: Orientation.FORWARD }
    ]};

    const res = new BRepValidator().validate(shell);
    expect(res.status).toBe('INVALID');
    expect(res.manifoldStatus).toBe('NON_MANIFOLD');
    expect(res.diagnostics.some(d => d.code === 'NON_MANIFOLD')).toBe(true);
  });

  it('TEST-12: Vertex with NaN coordinate', () => {
    const v1: Vertex = { id: 'v1', shapeType: TopoShapeEnum.VERTEX, geometry: createPt(NaN,0,0), tolerance: 1e-7 };
    const res = new BRepValidator().validate(v1);
    expect(res.status).toBe('INVALID');
    expect(res.diagnostics.some(d => d.code === 'INVALID_GEOMETRY')).toBe(true);
  });

  it('ADVERSARIAL-06: Reject rendering mesh', () => {
    const mesh = { vertices: [0,0,0], indices: [0] };
    const res = new BRepValidator().validate(mesh as any);
    expect(res.status).toBe('INVALID');
    expect(res.diagnostics.some(d => d.code === 'INVALID_TOPOLOGY' || d.code === 'UNSUPPORTED_TOPOLOGY')).toBe(true);
  });

  it('ADVERSARIAL-07: Open shell rejected as Solid', () => {
    const v1: Vertex = { id: 'v1', shapeType: TopoShapeEnum.VERTEX, geometry: createPt(0,0,0), tolerance: 1e-7 };
    const e11: Edge = { id: 'e11', shapeType: TopoShapeEnum.EDGE, geometry: dummyGeom, startVertex: v1, endVertex: v1, tolerance: 1e-7 };
    const loop: Loop = { id: 'l1', shapeType: TopoShapeEnum.LOOP, orientedEdges: [{ edge: e11, orientation: Orientation.FORWARD }]};
    const face: Face = { id: 'f1', shapeType: TopoShapeEnum.FACE, geometry: dummyGeom, outerLoop: loop, innerLoops: [] };
    const shell: Shell = { id: 'sh1', shapeType: TopoShapeEnum.SHELL, orientedFaces: [ { face, orientation: Orientation.FORWARD } ] };
    const solid: Solid = { id: 'sol1', shapeType: TopoShapeEnum.SOLID, outerShell: shell, innerShells: [] };

    const res = new BRepValidator().validate(solid);
    expect(res.status).toBe('INVALID');
    expect(res.manifoldStatus).toBe('OPEN');
    expect(res.diagnostics.some(d => d.code === 'INVALID_SOLID')).toBe(true);
  });

});
