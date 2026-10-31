/**
 * SECP CAD Kernel — WP-02 Advanced Surface Modeling Qualification Test Suite
 * SECP-CAD-KERNEL-PHASE-2-001
 */

import { describe, it, expect } from 'vitest';
import { SurfaceModelingEngine } from '../modeling/SurfaceModelingEngine';
import { BRepNURBSSurface } from '../geometry/BRepGeometry';
import { BRepValidator } from '../brep/BRepValidator';
import { Point } from '../geometry/GeometryContracts';

describe('SECP-CAD-KERNEL-PHASE-2-001 — WP-02 Advanced Surface Modeling Qualification', () => {
  const validator = new BRepValidator();

  it('QUAL-01: Multi-Section NURBS Loft Evaluation', () => {
    const p1: Point[] = [
      { x: 0 as any, y: 0 as any, z: 0 as any },
      { x: 10 as any, y: 0 as any, z: 2 as any },
      { x: 20 as any, y: 0 as any, z: 0 as any }
    ];
    const p2: Point[] = [
      { x: 0 as any, y: 10 as any, z: 5 as any },
      { x: 10 as any, y: 10 as any, z: 12 as any },
      { x: 20 as any, y: 10 as any, z: 5 as any }
    ];
    const p3: Point[] = [
      { x: 0 as any, y: 20 as any, z: 0 as any },
      { x: 10 as any, y: 20 as any, z: 4 as any },
      { x: 20 as any, y: 20 as any, z: 0 as any }
    ];

    const surface = SurfaceModelingEngine.loftNURBS([p1, p2, p3]);
    expect(surface).toBeInstanceOf(BRepNURBSSurface);
    expect(surface.degreeU).toBe(2);
    expect(surface.degreeV).toBe(2);

    const midPt = surface.evaluate(0.5, 0.5);
    expect(midPt.x).toBeCloseTo(10, 1);
    expect(midPt.y).toBeCloseTo(10, 1);
  });

  it('QUAL-02: NURBS Sweep Surface along 3D Trajectory', () => {
    const profile: Point[] = [
      { x: 0 as any, y: 0 as any, z: 0 as any },
      { x: 5 as any, y: 0 as any, z: 2 as any },
      { x: 10 as any, y: 0 as any, z: 0 as any }
    ];
    const trajectory: Point[] = [
      { x: 0 as any, y: 0 as any, z: 0 as any },
      { x: 0 as any, y: 10 as any, z: 5 as any },
      { x: 0 as any, y: 25 as any, z: 15 as any }
    ];

    const surface = SurfaceModelingEngine.sweepNURBS(profile, trajectory);
    expect(surface).toBeInstanceOf(BRepNURBSSurface);

    const endPt = surface.evaluate(1, 1);
    expect(endPt.x).toBeCloseTo(10, 1);
    expect(endPt.y).toBeCloseTo(25, 1);
    expect(endPt.z).toBeCloseTo(15, 1);
  });

  it('QUAL-03: Ruled NURBS Surface between two boundary curves', () => {
    const c1: Point[] = [
      { x: 0 as any, y: 0 as any, z: 0 as any },
      { x: 10 as any, y: 0 as any, z: 5 as any }
    ];
    const c2: Point[] = [
      { x: 0 as any, y: 20 as any, z: 10 as any },
      { x: 10 as any, y: 20 as any, z: 0 as any }
    ];

    const ruled = SurfaceModelingEngine.ruledNURBS(c1, c2);
    expect(ruled.degreeV).toBe(1); // Linear ruling

    const midPt = ruled.evaluate(0.5, 0.5);
    expect(midPt.x).toBeCloseTo(5, 1);
    expect(midPt.y).toBeCloseTo(10, 1);
    expect(midPt.z).toBeCloseTo(3.75, 1);
  });

  it('QUAL-04: Surface of Revolution around 3D Axis', () => {
    // Semi-circle profile in XZ plane
    const profile: Point[] = [
      { x: 10 as any, y: 0 as any, z: 0 as any },
      { x: 10 as any, y: 0 as any, z: 10 as any }
    ];
    // Revolve around Z-axis passing through (0, 0, 0) by 360 degrees (cylinder)
    const revSurf = SurfaceModelingEngine.revolveNURBS(
      profile,
      { x: 0 as any, y: 0 as any, z: 0 as any },
      { x: 0 as any, y: 0 as any, z: 1 as any },
      2 * Math.PI
    );

    expect(revSurf).toBeInstanceOf(BRepNURBSSurface);

    // Evaluate points along revolution: radius should always be 10
    for (let u = 0; u <= 1; u += 0.25) {
      const pt = revSurf.evaluate(0, u);
      const radius = Math.hypot(pt.x, pt.y);
      expect(radius).toBeCloseTo(10, 1);
    }
  });

  it('QUAL-05: Coons Boundary Surface Patch from 4 Boundary Curves', () => {
    const cBottom: Point[] = [
      { x: 0 as any, y: 0 as any, z: 0 as any },
      { x: 10 as any, y: 0 as any, z: 2 as any }
    ];
    const cTop: Point[] = [
      { x: 0 as any, y: 10 as any, z: 1 as any },
      { x: 10 as any, y: 10 as any, z: 3 as any }
    ];
    const cLeft: Point[] = [
      { x: 0 as any, y: 0 as any, z: 0 as any },
      { x: 0 as any, y: 10 as any, z: 1 as any }
    ];
    const cRight: Point[] = [
      { x: 10 as any, y: 0 as any, z: 2 as any },
      { x: 10 as any, y: 10 as any, z: 3 as any }
    ];

    const patch = SurfaceModelingEngine.boundaryCoonsPatch(cBottom, cTop, cLeft, cRight);
    expect(patch).toBeInstanceOf(BRepNURBSSurface);

    // Check corners
    const p00 = patch.evaluate(0, 0);
    const p11 = patch.evaluate(1, 1);
    expect(p00.x).toBeCloseTo(0, 3);
    expect(p00.y).toBeCloseTo(0, 3);
    expect(p11.x).toBeCloseTo(10, 3);
    expect(p11.y).toBeCloseTo(10, 3);
    expect(p11.z).toBeCloseTo(3, 3);
  });

  it('QUAL-06: Valid Topological B-Rep Face Construction with Continuous Boundary Curves', () => {
    const p1: Point[] = [
      { x: 0 as any, y: 0 as any, z: 0 as any },
      { x: 10 as any, y: 0 as any, z: 0 as any }
    ];
    const p2: Point[] = [
      { x: 0 as any, y: 10 as any, z: 5 as any },
      { x: 10 as any, y: 10 as any, z: 5 as any }
    ];

    const surface = SurfaceModelingEngine.loftNURBS([p1, p2]);
    const face = SurfaceModelingEngine.createNURBSFace(surface, 'NURBS_FACE_01');

    // Validate face through BRepValidator
    const valRes = validator.validate(face);
    expect(valRes.status).toBe('VALID');
    expect(face.outerLoop.orientedEdges.length).toBe(4);
    for (const oe of face.outerLoop.orientedEdges) {
      expect(oe.edge.geometry).toBeDefined();
      expect(typeof oe.edge.geometry.evaluate).toBe('function');
    }
  });

  it('QUAL-07: Differential Continuity (G0/G1/G2) Analysis across Adjacent Patches', () => {
    // Create two planar adjacent patches sharing the boundary at x = 10
    const pA1: Point[] = [{ x: 0 as any, y: 0 as any, z: 0 as any }, { x: 10 as any, y: 0 as any, z: 0 as any }];
    const pA2: Point[] = [{ x: 0 as any, y: 10 as any, z: 0 as any }, { x: 10 as any, y: 10 as any, z: 0 as any }];
    const surfA = SurfaceModelingEngine.loftNURBS([pA1, pA2]);

    const pB1: Point[] = [{ x: 10 as any, y: 0 as any, z: 0 as any }, { x: 20 as any, y: 0 as any, z: 0 as any }];
    const pB2: Point[] = [{ x: 10 as any, y: 10 as any, z: 0 as any }, { x: 20 as any, y: 10 as any, z: 0 as any }];
    const surfB = SurfaceModelingEngine.loftNURBS([pB1, pB2]);

    const report = SurfaceModelingEngine.checkContinuity(surfA, surfB, {
      boundaryType: 'U_MAX_TO_U_MIN',
      toleranceG0: 1e-4,
      toleranceG1AngleDeg: 1.0,
      toleranceG2: 0.1
    });

    expect(report.G0).toBe(true);
    expect(report.maxG0Gap).toBeLessThan(1e-5);
    expect(report.G1).toBe(true);
    expect(report.minG1NormalDot).toBeGreaterThan(0.99);
    expect(report.G2).toBe(true);
  });

  it('QUAL-08: Adversarial Rejection of Inconsistent Curve Inputs', () => {
    const p1: Point[] = [{ x: 0 as any, y: 0 as any, z: 0 as any }, { x: 10 as any, y: 0 as any, z: 0 as any }];
    const p2: Point[] = [{ x: 0 as any, y: 10 as any, z: 0 as any }]; // Mismatched point count

    expect(() => SurfaceModelingEngine.loftNURBS([p1, p2])).toThrow('same number of control points');
  });
});
