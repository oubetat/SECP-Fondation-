/**
 * SECP Industrial OS v3 — Collision Authority Core
 * ExactNarrowPhaseP1.test.ts — Verification Suite for P1 Exact Narrow-Phase Mathematics
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  CollisionAuthority,
  CollisionExactness,
  CollisionSeverity,
  CollisionStatus,
  CanonicalCollisionInput,
  ExactNarrowPhaseMath,
  ExactNarrowPhaseProvider,
  Triangle3DExact
} from '../index';
import { HardAcceptanceGateP1 } from '../narrow-phase/HardAcceptanceGateP1';

describe('COLLISION-ENGINE-P1-EXACT-NARROW-PHASE-001 Verification Suite', () => {
  beforeEach(() => {
    CollisionAuthority.clearProviders();
    CollisionAuthority.registerProvider(new ExactNarrowPhaseProvider());
  });

  const standardTri: Triangle3DExact = {
    v0: { x: 0, y: 0, z: 0 },
    v1: { x: 100, y: 0, z: 0 },
    v2: { x: 0, y: 100, z: 0 },
    id: 'TRI_1'
  };

  it('P1.1 / T01: Segment crossing triangle interior returns distance 0 and isInterpenetrating = true', () => {
    const res = ExactNarrowPhaseMath.closestPointSegmentToTriangle(
      { x: 30, y: 30, z: 20 },
      { x: 30, y: 30, z: -20 },
      standardTri
    );
    expect(res.distance).toBe(0);
    expect(res.isInterpenetrating).toBe(true);
    expect(res.contactFeature).toBe('FACE_INTERIOR');
    expect(res.closestPointTriangle.x).toBeCloseTo(30, 6);
    expect(res.closestPointTriangle.y).toBeCloseTo(30, 6);
    expect(res.closestPointTriangle.z).toBeCloseTo(0, 6);
  });

  it('P1.1 / T02: Segment separated above triangle returns exact perpendicular distance', () => {
    const res = ExactNarrowPhaseMath.closestPointSegmentToTriangle(
      { x: 30, y: 30, z: 50 },
      { x: 30, y: 30, z: 15 },
      standardTri
    );
    expect(res.distance).toBeCloseTo(15, 6);
    expect(res.isInterpenetrating).toBe(false);
    expect(res.contactFeature).toBe('FACE_INTERIOR');
    expect(res.closestPointSegment.z).toBeCloseTo(15, 6);
  });

  it('P1.1 / T03: Segment crossing triangle edge returns EDGE contact feature', () => {
    const res = ExactNarrowPhaseMath.closestPointSegmentToTriangle(
      { x: 50, y: 0, z: 10 },
      { x: 50, y: 0, z: -10 },
      standardTri
    );
    expect(res.distance).toBe(0);
    expect(res.contactFeature).toBe('EDGE_01');
  });

  it('P1.1 / T04: Segment touching triangle vertex returns VERTEX contact feature', () => {
    const res = ExactNarrowPhaseMath.closestPointSegmentToTriangle(
      { x: 0, y: 0, z: 10 },
      { x: 0, y: 0, z: -10 },
      standardTri
    );
    expect(res.distance).toBe(0);
    expect(res.contactFeature).toBe('VERTEX_0');
  });

  it('P1.2 / T05: Triangle-triangle intersection correctly detects overlapping 3D triangles', () => {
    const triB: Triangle3DExact = {
      v0: { x: 30, y: 30, z: -10 },
      v1: { x: 30, y: 30, z: 10 },
      v2: { x: 60, y: 60, z: 0 }
    };
    const res = ExactNarrowPhaseMath.intersectTriangleTriangle(standardTri, triB);
    expect(res.intersects).toBe(true);
    expect(res.isCoplanar).toBe(false);
    expect(res.contactType).toBe('EDGE_FACE');
  });

  it('P1.2 / T06: Triangle-triangle correctly returns false for disjoint separated triangles', () => {
    const triDisjoint: Triangle3DExact = {
      v0: { x: 200, y: 200, z: 0 },
      v1: { x: 300, y: 200, z: 0 },
      v2: { x: 200, y: 300, z: 0 }
    };
    const res = ExactNarrowPhaseMath.intersectTriangleTriangle(standardTri, triDisjoint);
    expect(res.intersects).toBe(false);
    expect(res.contactType).toBe('NONE');
  });

  it('P1.3 / T07: Capsule-triangle distance calculates exact clearance and penetration depth', () => {
    const capRes = ExactNarrowPhaseMath.capsuleToTriangleDistance(
      { x: 25, y: 25, z: 20 },
      { x: 25, y: 25, z: 5 },
      10.0,
      standardTri
    );
    expect(capRes.isColliding).toBe(true);
    expect(capRes.penetrationDepthMm).toBeCloseTo(5.0, 6);
    expect(capRes.clearanceMm).toBeCloseTo(-5.0, 6);
  });

  it('Counterexample A Regression / T08: Tool plunging through large plate face without touching vertices is detected as PENETRATION', () => {
    const largePlate: Triangle3DExact[] = [
      { v0: { x: 0, y: 0, z: 0 }, v1: { x: 100, y: 0, z: 0 }, v2: { x: 100, y: 100, z: 0 } },
      { v0: { x: 0, y: 0, z: 0 }, v1: { x: 100, y: 100, z: 0 }, v2: { x: 0, y: 100, z: 0 } }
    ];

    const input: CanonicalCollisionInput = {
      domain: 'CAM_MULTI_AXIS',
      coordinateFrame: 'WCS',
      units: 'MILLIMETERS',
      toleranceProfile: { linearToleranceMm: 0.005, angularToleranceDeg: 0.5, clearanceWarningMarginMm: 2.0, safeClearanceMarginMm: 0.5 },
      cadRevisionId: 'CAD_PLATE',
      toolAssembly: { cutterDiameterMm: 10.0, fluteLengthMm: 30.0, stickoutMm: 50.0, shankDiameterMm: 10.0 },
      motionSegment: {
        startTcp: { x: 50, y: 50, z: 20 }, startOrientation: { x: 0, y: 0, z: 1 },
        endTcp: { x: 50, y: 50, z: -10 }, endOrientation: { x: 0, y: 0, z: 1 },
        motionType: 'FEED'
      },
      geometry: { tessellatedTriangles: largePlate }
    };

    const res = CollisionAuthority.evaluateSync(input, ExactNarrowPhaseProvider.PROVIDER_ID);
    expect(res.status).toBe(CollisionStatus.PENETRATION);
    expect(res.provenSafe).toBe(false);
    expect(res.metrics.maxPenetrationDepthMm).toBeGreaterThan(0);
  });

  it('Counterexample B Regression / T09: Tool intersecting triangle edge while vertices are outside is detected as PENETRATION', () => {
    const input: CanonicalCollisionInput = {
      domain: 'CAM_MULTI_AXIS',
      coordinateFrame: 'WCS',
      units: 'MILLIMETERS',
      toleranceProfile: { linearToleranceMm: 0.005, angularToleranceDeg: 0.5, clearanceWarningMarginMm: 2.0, safeClearanceMarginMm: 0.5 },
      cadRevisionId: 'CAD_EDGE',
      toolAssembly: { cutterDiameterMm: 10.0, fluteLengthMm: 30.0, stickoutMm: 50.0, shankDiameterMm: 10.0 },
      motionSegment: {
        startTcp: { x: 50, y: 0, z: 0 }, startOrientation: { x: 0, y: 0, z: 1 },
        endTcp: { x: 50, y: 0, z: 0 }, endOrientation: { x: 0, y: 0, z: 1 },
        motionType: 'FEED'
      },
      geometry: { tessellatedTriangles: [standardTri] }
    };

    const res = CollisionAuthority.evaluateSync(input, ExactNarrowPhaseProvider.PROVIDER_ID);
    expect(res.status).toBe(CollisionStatus.PENETRATION);
    expect(res.provenSafe).toBe(false);
  });

  it('Counterexample D Regression / T10: Thin 0.1mm obstacle is detected by continuous primitive test', () => {
    const thinTri: Triangle3DExact = {
      v0: { x: 49.95, y: 0, z: 5 }, v1: { x: 50.05, y: 0, z: 5 }, v2: { x: 50.0, y: 100, z: 5 }
    };

    const input: CanonicalCollisionInput = {
      domain: 'CAM_MULTI_AXIS',
      coordinateFrame: 'WCS',
      units: 'MILLIMETERS',
      toleranceProfile: { linearToleranceMm: 0.005, angularToleranceDeg: 0.5, clearanceWarningMarginMm: 2.0, safeClearanceMarginMm: 0.5 },
      cadRevisionId: 'CAD_THIN',
      toolAssembly: { cutterDiameterMm: 10.0, fluteLengthMm: 30.0, stickoutMm: 50.0, shankDiameterMm: 10.0 },
      motionSegment: {
        startTcp: { x: 50, y: 50, z: 0 }, startOrientation: { x: 0, y: 0, z: 1 },
        endTcp: { x: 50, y: 50, z: 0 }, endOrientation: { x: 0, y: 0, z: 1 },
        motionType: 'FEED'
      },
      geometry: { tessellatedTriangles: [thinTri] }
    };

    const res = CollisionAuthority.evaluateSync(input, ExactNarrowPhaseProvider.PROVIDER_ID);
    expect(res.status).toBe(CollisionStatus.PENETRATION);
    expect(res.provenSafe).toBe(false);
  });

  it('Numerical Robustness / T11: Zero-area degenerate triangles are handled safely without crashing', () => {
    const degenTri: Triangle3DExact = { v0: { x: 0, y: 0, z: 0 }, v1: { x: 0, y: 0, z: 0 }, v2: { x: 0, y: 0, z: 0 } };
    const res = ExactNarrowPhaseMath.closestPointSegmentToTriangle({ x: 0, y: 0, z: 10 }, { x: 0, y: 0, z: 20 }, degenTri);
    expect(res.isDegenerate).toBe(true);
    expect(res.distance).toBe(10);
    expect(Number.isFinite(res.distance)).toBe(true);
  });

  it('Numerical Robustness / T12: Epsilon-scale contact is accurately detected as touching contact', () => {
    const nearTouch = ExactNarrowPhaseMath.capsuleToTriangleDistance(
      { x: 20, y: 20, z: 10.000000001 },
      { x: 20, y: 20, z: 5.000000001 },
      5.0,
      standardTri
    );
    expect(nearTouch.isTouching).toBe(true);
    expect(Math.abs(nearTouch.clearanceMm)).toBeLessThan(1e-6);
  });

  it('P1 Hard Acceptance Gate / T13: HardAcceptanceGateP1 executes and passes all 15 gates', () => {
    const gateSummary = HardAcceptanceGateP1.runAllGates();
    expect(gateSummary.allPassed).toBe(true);
    expect(gateSummary.passedGates).toBe(15);
    expect(gateSummary.failedGates).toBe(0);
  });
});
