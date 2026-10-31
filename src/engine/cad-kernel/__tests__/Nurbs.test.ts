import { TopoShapeEnum, Edge, Vertex } from '../topology/TopologyContracts';
import { Point, Curve } from '../geometry/GeometryContracts';
import { describe, it, expect } from 'vitest';
import { NurbsCurve, NurbsSurface, NurbsTolerance } from '../nurbs/NurbsContracts';
import { NurbsValidator } from '../nurbs/NurbsValidator';
import { NurbsEvaluator } from '../nurbs/NurbsEvaluator';
import { NurbsKnotInsertion } from '../nurbs/NurbsKnotInsertion';
import { NurbsBasis } from '../nurbs/NurbsBasis';
import { NurbsDerivatives } from '../nurbs/NurbsDerivatives';
import { HardAcceptanceGate017 } from '../nurbs/HardAcceptanceGate017';

describe('PATCH-017 — NURBS CORE', () => {
  const tol: NurbsTolerance = { absolute: 1e-10, relative: 1e-10 };

  const validLine: NurbsCurve = {
    degree: 1,
    knots: [0, 0, 1, 1],
    controlPoints: [
      { x: 0, y: 0, z: 0, w: 1 },
      { x: 10, y: 0, z: 0, w: 1 }
    ],
    evaluate: (u) => ({x:0, y:0, z:0}),
    domain: () => ({uMin:0, uMax:1})
  };

  it('A. Knot vector validation & B. Degree validation & C. Control-point count', () => {
    const res = NurbsValidator.validateCurve(validLine);
    expect(res.isValid).toBe(true);

    const invalidDegree = { ...validLine, degree: -1 };
    expect(NurbsValidator.validateCurve(invalidDegree).isValid).toBe(false);

    const invalidCP = { ...validLine, controlPoints: [] };
    expect(NurbsValidator.validateCurve(invalidCP).isValid).toBe(false);

    const descendingKnots = { ...validLine, knots: [0, 1, 0, 1] };
    expect(NurbsValidator.validateCurve(descendingKnots).isValid).toBe(false);
  });

  it('D. Weight validation & O. Degenerate denominator detection', () => {
    const zeroWeight = {
      ...validLine,
      controlPoints: [
        { x: 0, y: 0, z: 0, w: 0 },
        { x: 10, y: 0, z: 0, w: 1 }
      ]
    };
    const res = NurbsValidator.validateCurve(zeroWeight);
    expect(res.isValid).toBe(false);
    expect(res.errors.some(e => e.code === 'INVALID_CP_WEIGHT')).toBe(true);
  });

  it('E. Basis function partition of unity & F. Basis local support', () => {
    const span = NurbsBasis.findKnotSpan(0.5, 1, validLine.knots, tol);
    expect(span).toBe(1);
    const N = NurbsBasis.evaluateBasisFunctions(span, 0.5, 1, validLine.knots);
    expect(N.length).toBe(2);
    expect(N[0] + N[1]).toBeCloseTo(1.0, 10);
    expect(N[0]).toBeCloseTo(0.5, 10);
    expect(N[1]).toBeCloseTo(0.5, 10);
  });

  it('G. Curve endpoint evaluation & H. Curve interior evaluation', () => {
    const start = NurbsEvaluator.evaluateCurve(validLine, 0, tol);
    expect(start.status).toBe('OK');
    expect(start.point.x).toBeCloseTo(0, 10);

    const mid = NurbsEvaluator.evaluateCurve(validLine, 0.5, tol);
    expect(mid.status).toBe('OK');
    expect(mid.point.x).toBeCloseTo(5, 10);

    const end = NurbsEvaluator.evaluateCurve(validLine, 1, tol);
    expect(end.status).toBe('OK');
    expect(end.point.x).toBeCloseTo(10, 10);
  });

  it('I. Rational curve evaluation (Rational quadratic circle arc)', () => {
    const weight = Math.sqrt(2) / 2;
    const arc: NurbsCurve = {
      degree: 2,
      knots: [0, 0, 0, 1, 1, 1],
      controlPoints: [
        { x: 1, y: 0, z: 0, w: 1 },
        { x: 1, y: 1, z: 0, w: weight },
        { x: 0, y: 1, z: 0, w: 1 }
      ],
      evaluate: (u) => ({x:0, y:0, z:0}),
      domain: () => ({uMin:0, uMax:1})
    };

    const mid = NurbsEvaluator.evaluateCurve(arc, 0.5, tol);
    expect(mid.status).toBe('OK');
    // For u=0.5, point should be (sqrt(2)/2, sqrt(2)/2)
    expect(mid.point.x).toBeCloseTo(Math.sqrt(2)/2, 10);
    expect(mid.point.y).toBeCloseTo(Math.sqrt(2)/2, 10);
  });

  const planarSurface: NurbsSurface = {
    degreeU: 1,
    degreeV: 1,
    knotsU: [0, 0, 1, 1],
    knotsV: [0, 0, 1, 1],
    controlPoints: [
      [ { x: 0, y: 0, z: 0, w: 1 }, { x: 0, y: 10, z: 0, w: 1 } ],
      [ { x: 10, y: 0, z: 0, w: 1 }, { x: 10, y: 10, z: 0, w: 1 } ]
    ],
    evaluate: (u, v) => ({x:0, y:0, z:0}),
    domain: () => ({uMin:0, uMax:1, vMin:0, vMax:1})
  };

  it('J. Surface evaluation & K. Surface endpoint evaluation', () => {
    expect(NurbsValidator.validateSurface(planarSurface).isValid).toBe(true);

    const start = NurbsEvaluator.evaluateSurface(planarSurface, 0, 0, tol);
    expect(start.status).toBe('OK');
    expect(start.point.x).toBeCloseTo(0, 10);
    expect(start.point.y).toBeCloseTo(0, 10);

    const mid = NurbsEvaluator.evaluateSurface(planarSurface, 0.5, 0.5, tol);
    expect(mid.status).toBe('OK');
    expect(mid.point.x).toBeCloseTo(5, 10);
    expect(mid.point.y).toBeCloseTo(5, 10);
  });

  it('L. Surface normal & M. First derivatives (Calculated differential behavior)', () => {
    const n = NurbsDerivatives.evaluateSurfaceNormal(planarSurface, 0.5, 0.5, tol);
    expect(n.status).toBe('OK');
    expect(n.normal).toBeDefined();
    expect(n.normal!.z).toBeCloseTo(1, 5);

    const cDeriv = NurbsDerivatives.evaluateCurveDerivative(validLine, 0.5, tol);
    expect(cDeriv.status).toBe('OK');
    expect(cDeriv.derivative).toBeDefined();
    expect(cDeriv.derivative!.x).toBeCloseTo(10, 3);
  });

  it('P. Invalid parameter detection', () => {
    const invalid = NurbsEvaluator.evaluateCurve(validLine, 1.5, tol);
    expect(invalid.status).toBe('INVALID');
  });

  it('Q. Knot insertion geometry preservation', () => {
    const inserted = NurbsKnotInsertion.insertKnotCurve(validLine, 0.5, 1, tol);
    expect(inserted).not.toBeNull();
    if (inserted) {
      expect(inserted.controlPoints.length).toBe(3); // n+1 + r = 2 + 1 = 3
      expect(inserted.knots.length).toBe(5);
      
      const evalOrig = NurbsEvaluator.evaluateCurve(validLine, 0.5, tol);
      const evalNew = NurbsEvaluator.evaluateCurve(inserted, 0.5, tol);
      expect(evalNew.status).toBe('OK');
      expect(evalNew.point.x).toBeCloseTo(evalOrig.point.x, 10);
    }
  });

  it('R. Deterministic repeated evaluation', () => {
    const e1 = NurbsEvaluator.evaluateCurve(validLine, 0.333, tol);
    const e2 = NurbsEvaluator.evaluateCurve(validLine, 0.333, tol);
    expect(e1.point.x).toBe(e2.point.x);
    expect(e1.point.y).toBe(e2.point.y);
  });
  
  it('HardAcceptanceGate017 runs and passes', () => {
    const gateRes = HardAcceptanceGate017.evaluate();
    expect(gateRes.verdict).toBe('PASS');
    expect(gateRes.checks.curveValidation).toBe(true);
    expect(gateRes.checks.descendingKnotRejection).toBe(true);
    expect(gateRes.checks.knotInsertionGeometryPreserved).toBe(true);
  });
});



describe('B-Rep Integration', () => {
  it('U. B-Rep/NURBS integration: A B-Rep edge can legally contain a canonical NurbsCurve as its geometry', () => {
    const validLine: NurbsCurve = {
      degree: 1,
      knots: [0, 0, 1, 1],
      controlPoints: [
        { x: 0, y: 0, z: 0, w: 1 },
        { x: 10, y: 0, z: 0, w: 1 }
      ],
      evaluate: (u) => ({x:0, y:0, z:0}),
      domain: () => ({uMin:0, uMax:1})
    };

    const v1: Vertex = { id: 'v1', shapeType: TopoShapeEnum.VERTEX, geometry: {x:0, y:0, z:0}, tolerance: 1e-7 };
    const v2: Vertex = { id: 'v2', shapeType: TopoShapeEnum.VERTEX, geometry: {x:10, y:0, z:0}, tolerance: 1e-7 };

    // The core of the integration test: Edge geometry accepts the NurbsCurve
    const edge: Edge = {
      id: 'e1',
      shapeType: TopoShapeEnum.EDGE,
      geometry: validLine as Curve,
      startVertex: v1,
      endVertex: v2,
      tolerance: 1e-7
    };

    expect(edge.geometry).toBe(validLine);
    expect((edge.geometry as NurbsCurve).degree).toBe(1);
  });
});
