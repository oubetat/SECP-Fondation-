import { describe, it, expect } from 'vitest';
import { NurbsPredicates } from '../predicates/NurbsPredicates';
import { NurbsCurve, NurbsSurface } from '../nurbs/NurbsContracts';

describe('PATCH-018: NurbsPredicates Integration', () => {
  const lineCurve: NurbsCurve = {
    degree: 1,
    knots: [0, 0, 1, 1],
    controlPoints: [
      { x: 0, y: 0, z: 0, w: 1 },
      { x: 10, y: 0, z: 0, w: 1 }
    ],
    evaluate: (u) => ({ x: u * 10, y: 0, z: 0 }),
    domain: () => ({ uMin: 0, uMax: 1 })
  };

  const quadSurface: NurbsSurface = {
    degreeU: 1,
    degreeV: 1,
    knotsU: [0, 0, 1, 1],
    knotsV: [0, 0, 1, 1],
    controlPoints: [
      [{ x: 0, y: 0, z: 0, w: 1 }, { x: 0, y: 10, z: 0, w: 1 }],
      [{ x: 10, y: 0, z: 0, w: 1 }, { x: 10, y: 10, z: 0, w: 1 }]
    ],
    evaluate: (u, v) => ({ x: u * 10, y: v * 10, z: 0 }),
    domain: () => ({ uMin: 0, uMax: 1, vMin: 0, vMax: 1 })
  };

  it('should test point on NURBS curve at param', () => {
    const onRes = NurbsPredicates.pointOnNurbsCurveAtParam({ x: 5, y: 0, z: 0 }, lineCurve, 0.5);
    const offRes = NurbsPredicates.pointOnNurbsCurveAtParam({ x: 5, y: 1, z: 0 }, lineCurve, 0.5);

    expect(onRes.classification).toBe('EXACT_ON');
    expect(offRes.classification).toBe('OUTSIDE_TOLERANCE');
  });

  it('should test point near NURBS curve using sample discretization', () => {
    const nearRes = NurbsPredicates.pointNearNurbsCurve({ x: 5, y: 0, z: 0 }, lineCurve, 16);
    const farRes = NurbsPredicates.pointNearNurbsCurve({ x: 5, y: 5, z: 0 }, lineCurve, 16);

    expect(nearRes.classification).toBe('WITHIN_TOLERANCE');
    expect(farRes.classification).toBe('OUTSIDE_TOLERANCE');
  });

  it('should test point on NURBS surface at params', () => {
    const onSurf = NurbsPredicates.pointOnNurbsSurfaceAtParams({ x: 5, y: 5, z: 0 }, quadSurface, 0.5, 0.5);
    const offSurf = NurbsPredicates.pointOnNurbsSurfaceAtParams({ x: 5, y: 5, z: 2 }, quadSurface, 0.5, 0.5);

    expect(onSurf.classification).toBe('EXACT_ON');
    expect(offSurf.classification).toBe('OUTSIDE_TOLERANCE');
  });
});
