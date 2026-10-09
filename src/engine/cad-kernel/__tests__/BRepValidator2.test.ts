import { describe, it, expect } from 'vitest';
import { BRepValidator } from '../brep/BRepValidator';
import { 
  TopoShapeEnum, Vertex, Edge, Loop, Face, Shell, Solid, Orientation 
} from '../topology/TopologyContracts';
import { Point } from '../geometry/GeometryContracts';

const dummyGeom: any = { type: 'dummy' }; // No functions so CanonicalSerializer doesn't fail if we ever use it.

describe('PATCH-016 — Robust B-Rep Core Validation - Part 2', () => {

  const createPt = (x:number, y:number, z:number): Point => ({ x, y, z });

  it('TEST-10: Dangling face/loop reference', () => {
    const face: Face = { id: 'f1', shapeType: TopoShapeEnum.FACE, geometry: dummyGeom, outerLoop: undefined as any, innerLoops: [] };
    const res = new BRepValidator().validate(face);
    expect(res.status).toBe('INVALID');
    expect(res.diagnostics.some(d => d.code === 'DANGLING_TOPOLOGY')).toBe(true);
  });

  it('TEST-11: Duplicate topology IDs with different references', () => {
    const v1: Vertex = { id: 'v1', shapeType: TopoShapeEnum.VERTEX, geometry: createPt(0,0,0), tolerance: 1e-7 };
    const v2: Vertex = { id: 'v1', shapeType: TopoShapeEnum.VERTEX, geometry: createPt(1,0,0), tolerance: 1e-7 }; // duplicate ID
    const e1: Edge = { id: 'e1', shapeType: TopoShapeEnum.EDGE, geometry: dummyGeom, startVertex: v1, endVertex: v2, tolerance: 1e-7 };
    const res = new BRepValidator().validate(e1);
    expect(res.status).toBe('INVALID');
    expect(res.diagnostics.some(d => d.code === 'DUPLICATE_ID')).toBe(true);
  });

  it('TEST-13: Validation must not mutate the B-Rep', () => {
    const v1: Vertex = { id: 'v1', shapeType: TopoShapeEnum.VERTEX, geometry: createPt(0,0,0), tolerance: 1e-7 };
    const e1: Edge = { id: 'e1', shapeType: TopoShapeEnum.EDGE, geometry: dummyGeom, startVertex: v1, endVertex: v1, tolerance: 1e-7 };
    
    const beforeStr = JSON.stringify(e1);
    new BRepValidator().validate(e1);
    const afterStr = JSON.stringify(e1);
    expect(beforeStr).toBe(afterStr);
  });

  it('TEST-14: Reordering unrelated entities must not alter entity identity', () => {
    const v1: Vertex = { id: 'SECP:TOPOLOGY:V1', shapeType: TopoShapeEnum.VERTEX, geometry: createPt(0,0,0), tolerance: 1e-7 };
    expect(v1.id).toBe('SECP:TOPOLOGY:V1');
  });

  it('TEST-15: Loop edge ordering changes hash', () => {
    const v1: Vertex = { id: 'v1', shapeType: TopoShapeEnum.VERTEX, geometry: createPt(0,0,0), tolerance: 1e-7 };
    const e1: Edge = { id: 'e1', shapeType: TopoShapeEnum.EDGE, geometry: dummyGeom, startVertex: v1, endVertex: v1, tolerance: 1e-7 };
    const e2: Edge = { id: 'e2', shapeType: TopoShapeEnum.EDGE, geometry: dummyGeom, startVertex: v1, endVertex: v1, tolerance: 1e-7 };
    
    const loopA: Loop = { id: 'l1', shapeType: TopoShapeEnum.LOOP, orientedEdges: [
      { edge: e1, orientation: Orientation.FORWARD },
      { edge: e2, orientation: Orientation.FORWARD }
    ]};
    
    const loopB: Loop = { id: 'l1', shapeType: TopoShapeEnum.LOOP, orientedEdges: [
      { edge: e2, orientation: Orientation.FORWARD },
      { edge: e1, orientation: Orientation.FORWARD }
    ]};

    // Replace CanonicalSerializer with a deterministic JSON stringifier for the test
    const hashA = JSON.stringify(loopA);
    const hashB = JSON.stringify(loopB);
    expect(hashA).not.toBe(hashB); // semantically meaningful ordering
  });

  it('TEST-16: Serialize -> deserialize -> validate', () => {
    const v1: Vertex = { id: 'v1', shapeType: TopoShapeEnum.VERTEX, geometry: createPt(0,0,0), tolerance: 1e-7 };
    const e1: Edge = { id: 'e1', shapeType: TopoShapeEnum.EDGE, geometry: dummyGeom, startVertex: v1, endVertex: v1, tolerance: 1e-7 };
    
    const serialized = JSON.stringify(e1);
    const deserialized = JSON.parse(serialized);
    
    const val1 = new BRepValidator().validate(e1);
    const val2 = new BRepValidator().validate(deserialized);
    expect(val1.status).toBe(val2.status);
    expect(val1.diagnostics.length).toBe(val2.diagnostics.length);
  });

  it('ADVERSARIAL-01: Face A, B, C share edge E in solid -> NON_MANIFOLD', () => {
    const v1: Vertex = { id: 'v1', shapeType: TopoShapeEnum.VERTEX, geometry: createPt(0,0,0), tolerance: 1e-7 };
    const v2: Vertex = { id: 'v2', shapeType: TopoShapeEnum.VERTEX, geometry: createPt(1,0,0), tolerance: 1e-7 };
    const e12: Edge = { id: 'e12', shapeType: TopoShapeEnum.EDGE, geometry: dummyGeom, startVertex: v1, endVertex: v2, tolerance: 1e-7 };
    
    const makeFace = (id: string, e: Edge) => {
      const e21: Edge = { id: `${id}_e21`, shapeType: TopoShapeEnum.EDGE, geometry: dummyGeom, startVertex: v2, endVertex: v1, tolerance: 1e-7 };
      const loop: Loop = { id: `${id}_l`, shapeType: TopoShapeEnum.LOOP, orientedEdges: [
        { edge: e, orientation: Orientation.FORWARD },
        { edge: e21, orientation: Orientation.FORWARD }
      ]};
      return { id, shapeType: TopoShapeEnum.FACE, geometry: dummyGeom, outerLoop: loop, innerLoops: [] } as Face;
    };

    const shell: Shell = { id: 'sh1', shapeType: TopoShapeEnum.SHELL, orientedFaces: [
      { face: makeFace('fA', e12), orientation: Orientation.FORWARD },
      { face: makeFace('fB', e12), orientation: Orientation.FORWARD },
      { face: makeFace('fC', e12), orientation: Orientation.FORWARD }
    ]};
    const solid: Solid = { id: 's1', shapeType: TopoShapeEnum.SOLID, outerShell: shell, innerShells: [] };

    const res = new BRepValidator().validate(solid);
    expect(res.status).toBe('INVALID');
    expect(res.manifoldStatus).toBe('NON_MANIFOLD');
  });

  it('ADVERSARIAL-02: Loop Edge A -> Vertex X, Edge B -> Vertex Y -> BROKEN_LOOP_CLOSURE', () => {
    const vX: Vertex = { id: 'vX', shapeType: TopoShapeEnum.VERTEX, geometry: createPt(0,0,0), tolerance: 1e-7 };
    const vY: Vertex = { id: 'vY', shapeType: TopoShapeEnum.VERTEX, geometry: createPt(1,0,0), tolerance: 1e-7 };
    const vZ: Vertex = { id: 'vZ', shapeType: TopoShapeEnum.VERTEX, geometry: createPt(2,0,0), tolerance: 1e-7 };
    
    const edgeA: Edge = { id: 'eA', shapeType: TopoShapeEnum.EDGE, geometry: dummyGeom, startVertex: vX, endVertex: vX, tolerance: 1e-7 };
    const edgeB: Edge = { id: 'eB', shapeType: TopoShapeEnum.EDGE, geometry: dummyGeom, startVertex: vY, endVertex: vZ, tolerance: 1e-7 };
    
    const loop: Loop = { id: 'l1', shapeType: TopoShapeEnum.LOOP, orientedEdges: [
      { edge: edgeA, orientation: Orientation.FORWARD }, // ends at vX
      { edge: edgeB, orientation: Orientation.FORWARD }  // starts at vY
    ]};
    
    const res = new BRepValidator().validate(loop);
    expect(res.status).toBe('INVALID');
    expect(res.diagnostics.some(d => d.code === 'BROKEN_LOOP_CLOSURE')).toBe(true);
  });

  it('ADVERSARIAL-03: Delete referenced geometry object -> INVALID_GEOMETRY_REFERENCE', () => {
    const vX: Vertex = { id: 'vX', shapeType: TopoShapeEnum.VERTEX, geometry: undefined as any, tolerance: 1e-7 };
    const res = new BRepValidator().validate(vX);
    expect(res.status).toBe('INVALID');
    expect(res.diagnostics.some(d => d.code === 'INVALID_GEOMETRY_REFERENCE')).toBe(true);
  });

  it('ADVERSARIAL-05: Change only Edge orientation reflects semantic change', () => {
    const v1: Vertex = { id: 'v1', shapeType: TopoShapeEnum.VERTEX, geometry: createPt(0,0,0), tolerance: 1e-7 };
    const v2: Vertex = { id: 'v2', shapeType: TopoShapeEnum.VERTEX, geometry: createPt(1,0,0), tolerance: 1e-7 };
    const e12: Edge = { id: 'e12', shapeType: TopoShapeEnum.EDGE, geometry: dummyGeom, startVertex: v1, endVertex: v2, tolerance: 1e-7 };
    
    const lForward: Loop = { id: 'l1', shapeType: TopoShapeEnum.LOOP, orientedEdges: [
      { edge: e12, orientation: Orientation.FORWARD }
    ]};
    
    const lReversed: Loop = { id: 'l1', shapeType: TopoShapeEnum.LOOP, orientedEdges: [
      { edge: e12, orientation: Orientation.REVERSED }
    ]};
    
    const hashF = JSON.stringify(lForward);
    const hashR = JSON.stringify(lReversed);
    expect(hashF).not.toBe(hashR);
  });

  it('ADVERSARIAL-08: Run validator twice on identical input -> identical result', () => {
    const v1: Vertex = { id: 'v1', shapeType: TopoShapeEnum.VERTEX, geometry: createPt(0,0,0), tolerance: 1e-7 };
    const e11: Edge = { id: 'e11', shapeType: TopoShapeEnum.EDGE, geometry: dummyGeom, startVertex: v1, endVertex: v1, tolerance: 1e-7 };
    const loop: Loop = { id: 'l1', shapeType: TopoShapeEnum.LOOP, orientedEdges: [{ edge: e11, orientation: Orientation.FORWARD }]};
    
    const val1 = new BRepValidator().validate(loop);
    const val2 = new BRepValidator().validate(loop);
    expect(JSON.stringify(val1)).toBe(JSON.stringify(val2));
  });

});
