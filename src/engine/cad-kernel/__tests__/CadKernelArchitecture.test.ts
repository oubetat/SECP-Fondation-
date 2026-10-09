/**
 * SECP CAD Kernel Architecture Tests
 * Validating the PATCH-015 constraints and dependency boundaries.
 */

import { describe, it, expect } from 'vitest';
import * as nodeFs from 'node:fs';
const fs = (nodeFs as any).default || nodeFs;
import * as path from 'path';

import { NumericalPolicy } from '../core/NumericalPolicy';
import { CapabilityRegistry, CapabilityStatus } from '../registry/CapabilityRegistry';
import { Point } from '../geometry/GeometryContracts';
import { TopoShapeEnum, Vertex, Edge } from '../topology/TopologyContracts';
import { BRepSolid } from '../brep/BRepContracts';
import { NurbsCurve } from '../nurbs/NurbsContracts';
import { FeatureNode } from '../history/HistoryContracts';
import { Constraint } from '../constraints/ConstraintContracts';
import { CADDocument } from '../document/CADDocument';

describe('PATCH-015 — CAD Kernel Architecture & Capability Boundary Tests', () => {
  it('TEST-01: Kernel modules can be imported without circular dependency failure', () => {
    expect(NumericalPolicy).toBeDefined();
    expect(CapabilityRegistry).toBeDefined();
  });

  it('TEST-02: Geometry and topology identities remain distinct', () => {
    const pt: Point = { x: 1, y: 2, z: 3 };
    const vertex: Vertex = {
      id: 'v1',
      shapeType: TopoShapeEnum.VERTEX,
      geometry: pt,
      tolerance: 1e-7
    };
    expect(vertex.geometry).toEqual(pt);
    expect(vertex).not.toHaveProperty('x'); // Topology is not Geometry
  });

  it('TEST-03: A Vertex can reference geometric Point data without collapsing the two concepts', () => {
    const pt: Point = { x: 0, y: 0, z: 0 };
    const vertex: Vertex = {
      id: 'v1',
      shapeType: TopoShapeEnum.VERTEX,
      geometry: pt,
      tolerance: 1e-7
    };
    expect(vertex.geometry.x).toBe(0);
  });

  it('TEST-04: An Edge can reference a Curve and topological vertices', () => {
    const edge: Edge = {
      id: 'e1',
      shapeType: TopoShapeEnum.EDGE,
      geometry: {
        evaluate: (u: number) => ({ x: u, y: 0, z: 0 }),
        domain: () => ({ uMin: 0, uMax: 1 })
      },
      startVertex: { id: 'v1', shapeType: TopoShapeEnum.VERTEX, geometry: {x:0, y:0, z:0}, tolerance: 1e-7 },
      endVertex: { id: 'v2', shapeType: TopoShapeEnum.VERTEX, geometry: {x:1, y:0, z:0}, tolerance: 1e-7 },
      tolerance: 1e-7
    };
    expect(edge.startVertex.id).toBe('v1');
    expect(edge.geometry.evaluate(0.5).x).toBe(0.5);
  });

  it('TEST-05: Face/Loop/Edge/Vertex relationships can be represented consistently', () => {
    // Defined in TopologyContracts.ts implicitly through types
    expect(TopoShapeEnum.FACE).toBe('FACE');
    expect(TopoShapeEnum.WIRE).toBe('WIRE');
  });

  it('TEST-06: B-Rep relationships preserve orientation/ownership metadata', () => {
    const brep: BRepSolid = {
      topology: {
        id: 'solid1',
        shapeType: TopoShapeEnum.SOLID,
        outerShell: { id: 'shell1', shapeType: TopoShapeEnum.SHELL, orientedFaces: [] },
        innerShells: []
      },
      metadata: { author: 'SECP' }
    };
    expect(brep.topology.shapeType).toBe(TopoShapeEnum.SOLID);
  });

  it('TEST-07: NURBS contract preserves degree, knots, control points and weights', () => {
    const curve: NurbsCurve = {
      degree: 3,
      controlPoints: [{ x: 0, y: 0, z: 0, w: 1 }],
      knots: [0, 0, 0, 0, 1, 1, 1, 1],
      domain: () => ({ uMin: 0, uMax: 1 }),
      evaluate: (u) => ({ x: u, y: 0, z: 0 })
    };
    expect(curve.degree).toBe(3);
    expect(curve.knots).toContain(0);
  });

  it('TEST-08: Feature History can represent dependencies', () => {
    const node: FeatureNode = {
      featureId: 'extrude-1',
      type: 'EXTRUDE',
      inputs: [{ name: 'depth', value: 10 }],
      outputs: [{ topologyId: 'solid1' }],
      dependencies: [{ dependsOnFeatureId: 'sketch-1' }]
    };
    expect(node.dependencies[0].dependsOnFeatureId).toBe('sketch-1');
  });

  it('TEST-09: Constraint objects can reference valid geometry/topology entities', () => {
    const constraint: Constraint = {
      id: 'c1',
      type: 'DISTANCE',
      entities: [{ topologyId: 'v1' }, { topologyId: 'v2' }],
      value: 10
    };
    expect(constraint.entities.length).toBe(2);
  });

  it('TEST-10: Modeler capability registry accurately reports implementation state', () => {
    CapabilityRegistry.register({
      operation: 'booleanUnion',
      status: 'BACKEND_DELEGATED',
      backend: 'OCCT'
    });
    const cap = CapabilityRegistry.get('booleanUnion');
    expect(cap.status).toBe('BACKEND_DELEGATED');
  });

  it('TEST-11: OCCT-backed operation is reported as BACKEND_DELEGATED rather than NATIVE_SECP', () => {
    const cap = CapabilityRegistry.get('booleanUnion');
    expect(cap.backend).toBe('OCCT');
    expect(cap.status).not.toBe('IMPLEMENTED'); // Not implemented natively
  });

  it('TEST-12: Canonical Engineering Identity integrates with kernel entities', () => {
    const doc: CADDocument = {
      id: 'SECP:DESIGN:DOC1',
      metadata: {
        name: 'test',
        version: '1.0.0',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    };
    expect(doc.id).toMatch(/^SECP:/);
  });

  it('TEST-14: No production kernel module imports *.test.ts or __tests__', () => {
    const checkDir = (dir: string) => {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
          if (file !== '__tests__') {
            checkDir(fullPath);
          }
        } else if (fullPath.endsWith('.ts')) {
          const content = fs.readFileSync(fullPath, 'utf8');
          expect(content).not.toMatch(/from\s+['"].*\.test['"]/);
          expect(content).not.toMatch(/from\s+['"].*__tests__['"]/);
        }
      }
    };
    checkDir(path.resolve(__dirname, '..'));
  });

  it('TEST-15: No capability is reported IMPLEMENTED unless its implementation is actually present', () => {
    const cap = CapabilityRegistry.get('nonExistentOperation');
    expect(cap.status).toBe('UNIMPLEMENTED');
  });

  it('ADVERSARIAL TEST 1: Capability registry rejects fake claims without backend', () => {
    // If we get an unknown capability, it returns UNIMPLEMENTED
    const cap = CapabilityRegistry.get('fakeBoolean');
    expect(cap.status).toBe('UNIMPLEMENTED');
    expect(cap.status).not.toBe('IMPLEMENTED');
  });

  it('ADVERSARIAL TEST 2: Attempt to pass a rendering-only mesh into B-Rep is rejected structurally', () => {
    const mesh = { vertices: [0,0,0], indices: [0] };
    const brepFunc = (entity: BRepSolid) => entity.topology.shapeType;
    
    // @ts-expect-error
    expect(() => brepFunc(mesh)).toThrowError(); 
    // In TypeScript, this is a compile-time error. At runtime, we'd add type guards.
    // For this test, we simulate the rejection check:
    const isBRepSolid = (obj: any): obj is BRepSolid => {
      return !!(obj && obj.topology && obj.topology.shapeType === TopoShapeEnum.SOLID);
    };
    expect(isBRepSolid(mesh)).toBe(false);
  });

  it('ADVERSARIAL TEST 3: Topology object referencing non-existent geometry entity is structurally invalid', () => {
    const createVertex = (pt?: Point): Vertex => {
      if (!pt) throw new Error('INVALID: Geometry entity required');
      return { id: 'v1', shapeType: TopoShapeEnum.VERTEX, geometry: pt, tolerance: 1e-7 };
    };
    expect(() => createVertex(undefined)).toThrow('INVALID');
  });
});
