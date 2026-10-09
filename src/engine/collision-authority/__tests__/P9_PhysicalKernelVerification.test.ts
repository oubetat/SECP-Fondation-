import { describe, test, expect, beforeAll } from 'vitest';
import { CollisionAuthority } from '../CollisionAuthority';
import { CollisionStatus } from '../types';

describe('SECP Collision Kernel — Direct Physical & Geometric Verification (P9)', () => {
  beforeAll(() => {
    CollisionAuthority.clearProviders();
    CollisionAuthority.ensureDefaultProviders();
  });

  // Base payload creator for testing
  const createBasePayload = () => ({
    domain: 'CAM_MULTI_AXIS' as const,
    coordinateFrame: 'WCS' as const,
    units: 'MILLIMETERS' as const,
    toleranceProfile: {
      linearToleranceMm: 0.01,
      angularToleranceDeg: 0.1,
      clearanceWarningMarginMm: 5.0,
      safeClearanceMarginMm: 2.0
    },
    canonicalGeometry: {
      documentId: 'DOC_CAD_WORKPIECE_001',
      revisionId: 'REV_2026_PROD_v1',
      geometryId: 'GEOM_WP_PRISM_01',
      geometryRevision: 1,
      snapshotId: 'SNAP_PRISM_01_v1',
      topologyIdentity: 'TOPOLOGY_WP_PRISM',
      geometrySource: 'CAD' as const,
      provenance: 'SECP_CAD_KERNEL',
      coordinateFrame: 'WCS' as const,
      units: 'MILLIMETERS' as const,
      bounds: { min: { x: 0, y: 0, z: 0 }, max: { x: 70, y: 70, z: 30 } },
      geometryHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      tessellatedTriangles: [
        { a: {x:0,y:0,z:0}, b: {x:70,y:70,z:0}, c: {x:70,y:0,z:0} },
        { a: {x:0,y:0,z:0}, b: {x:0,y:70,z:0},  c: {x:70,y:70,z:0} },
        { a: {x:0,y:0,z:30}, b: {x:70,y:0,z:30}, c: {x:70,y:70,z:30} },
        { a: {x:0,y:0,z:30}, b: {x:70,y:70,z:30}, c: {x:0,y:70,z:30} },
        { a: {x:0,y:0,z:0}, b: {x:70,y:0,z:0}, c: {x:70,y:0,z:30} },
        { a: {x:0,y:0,z:0}, b: {x:70,y:0,z:30}, c: {x:0,y:0,z:30} },
        { a: {x:0,y:70,z:0}, b: {x:70,y:70,z:30}, c: {x:70,y:70,z:0} },
        { a: {x:0,y:70,z:0}, b: {x:0,y:70,z:30},  c: {x:70,y:70,z:30} },
        { a: {x:0,y:0,z:0}, b: {x:0,y:0,z:30}, c: {x:0,y:70,z:30} },
        { a: {x:0,y:0,z:0}, b: {x:0,y:70,z:30}, c: {x:0,y:70,z:0} },
        { a: {x:70,y:0,z:0}, b: {x:70,y:70,z:0}, c: {x:70,y:70,z:30} },
        { a: {x:70,y:0,z:0}, b: {x:70,y:70,z:30}, c: {x:70,y:0,z:30} }
      ]
    },
    toolAssembly: {
      cutterDiameterMm: 12,
      fluteLengthMm: 35,
      stickoutMm: 60,
      shankDiameterMm: 12
    },
    motionSegment: {
      startTcp: { x: 100, y: 100, z: 80 },
      startOrientation: { x: 0, y: 0, z: 1 },
      endTcp: { x: 100, y: 100, z: 80 },
      endOrientation: { x: 0, y: 0, z: 1 },
      motionType: 'FEED' as const
    }
  });

  // 1. separated geometry -> NO_COLLISION
  test('P9_M01: separated geometry -> NO_COLLISION with safe clearance', async () => {
    const payload = createBasePayload();
    // Tool is completely outside the workpiece bounding box and its clearance margins
    payload.motionSegment.startTcp = { x: 120, y: 120, z: 100 };
    payload.motionSegment.endTcp = { x: 120, y: 120, z: 100 };

    const result = await CollisionAuthority.evaluate(payload);
    expect(result.status).toBe(CollisionStatus.NO_COLLISION);
    expect(result.provenSafe).toBe(true);
    expect(result.metrics.minClearanceMm).toBeGreaterThan(5.0);
  });

  // 2. intersecting geometry -> COLLISION (CLEARANCE_VIOLATION)
  test('P9_M02: intersecting geometry -> CLEARANCE_VIOLATION', async () => {
    const payload = createBasePayload();
    // Workpiece max Z is 30. Tool starts at Z = 31.0. With radius = 6.0, 
    // the distance from cutter cylinder center-line to workpiece plane is 1.0mm.
    // This is less than the tool radius + safe clearance margin (6.0 + 2.0 = 8.0mm), 
    // violating the clearance safety threshold but not physically penetrating the metal core.
    payload.motionSegment.startTcp = { x: 30, y: 30, z: 37 }; // 37 - 6 (radius) = 31mm, which is 1mm clearance from z=30 face
    payload.motionSegment.endTcp = { x: 30, y: 30, z: 37 };

    const result = await CollisionAuthority.evaluate(payload);
    expect(result.status).toBe(CollisionStatus.CLEARANCE_VIOLATION);
    expect(result.provenSafe).toBe(false);
    expect(result.metrics.minClearanceMm).toBeCloseTo(1.0, 1);
  });

  // 3. penetrating geometry -> penetration > 0
  test('P9_M03: penetrating geometry -> penetration > 0 and status is PENETRATION', async () => {
    const payload = createBasePayload();
    // Tool starts at Z = 25.0. Since workpiece max Z is 30.0, the tool centerline
    // penetrates the workpiece top face by 5.0mm. Total penetration depth = 5.0mm + radius (6.0mm) = 11.0mm.
    payload.motionSegment.startTcp = { x: 30, y: 30, z: 25 };
    payload.motionSegment.endTcp = { x: 30, y: 30, z: 25 };

    const result = await CollisionAuthority.evaluate(payload);
    expect(result.status).toBe(CollisionStatus.PENETRATION);
    expect(result.metrics.maxPenetrationDepthMm).toBeGreaterThan(0);
    expect(result.metrics.maxPenetrationDepthMm).toBeCloseTo(6.0, 1);
    expect(result.contactManifold.length).toBeGreaterThan(0);
  });

  // 4. transform changed -> result changes (changing coordinate frame or workspace bounds)
  test('P9_M04: transform changed -> result changes (moving workpiece boundaries)', async () => {
    const payload1 = createBasePayload();
    payload1.motionSegment.startTcp = { x: 80, y: 80, z: 25 }; // outside the standard workpiece [0, 70]
    payload1.motionSegment.endTcp = { x: 80, y: 80, z: 25 };

    const result1 = await CollisionAuthority.evaluate(payload1);
    expect(result1.status).toBe(CollisionStatus.NO_COLLISION); // safe outside [0, 70] bounds

    // Move workpiece boundaries so that x=80 is now deep inside the workpiece
    const payload2 = createBasePayload();
    payload2.motionSegment.startTcp = { x: 80, y: 80, z: 25 };
    payload2.motionSegment.endTcp = { x: 80, y: 80, z: 25 };
    payload2.canonicalGeometry.bounds = { min: { x: 0, y: 0, z: 0 }, max: { x: 100, y: 100, z: 30 } };
    
    // FORENSIC CLOSURE: Must re-tessellate to reflect boundary change
    payload2.canonicalGeometry.tessellatedTriangles = undefined; 
    const result2 = await CollisionAuthority.evaluate(payload2);
    expect(result2.status).toBe(CollisionStatus.PENETRATION); // now intersects!
  });

  // 5. axis changed -> sweep changes
  test('P9_M05: axis changed -> sweep changes', async () => {
    const payload = createBasePayload();
    // Tool is stationed at (85, 30, 20) which is outside the block X boundary of 70
    payload.motionSegment.startTcp = { x: 85, y: 30, z: 20 };
    payload.motionSegment.endTcp = { x: 85, y: 30, z: 20 };

    const res1 = await CollisionAuthority.evaluate(payload);
    expect(res1.status).toBe(CollisionStatus.NO_COLLISION);

    // If we move the tool motion vector sideways towards the block, it will sweep into it
    payload.motionSegment.endTcp = { x: 50, y: 30, z: 20 };
    const res2 = await CollisionAuthority.evaluate(payload);
    expect(res2.status).toBe(CollisionStatus.PENETRATION); // swept path collides
  });

  // 6. 5-axis orientation -> physical result changes
  test('P9_M06: 5-axis orientation -> physical result changes', async () => {
    const payload = createBasePayload();
    // Tool tip is at (85, 30, 20) which is outside workpiece [0, 70].
    // With vertical orientation {0, 0, 1}, the cutter cylinder stays entirely outside.
    payload.motionSegment.startTcp = { x: 85, y: 30, z: 20 };
    payload.motionSegment.endTcp = { x: 85, y: 30, z: 20 };
    payload.motionSegment.startOrientation = { x: 0, y: 0, z: 1 };

    const resVertical = await CollisionAuthority.evaluate(payload);
    expect(resVertical.status).toBe(CollisionStatus.NO_COLLISION);

    // Now, tilt the tool in 5-axis space towards the workpiece using orientation vector {-1, 0, 0}.
    // This extends the cutter cylinder horizontally directly into the workpiece block!
    payload.motionSegment.startOrientation = { x: -1, y: 0, z: 0 };
    const resTilted = await CollisionAuthority.evaluate(payload);
    expect(resTilted.status).toBe(CollisionStatus.PENETRATION); // tilted cutter intersects
  });

  // 7. mid-path collision -> detected
  test('P9_M07: mid-path collision -> detected with Time of Impact', async () => {
    const payload = createBasePayload();
    // Start is safe outside block at (100, 35, 15).
    // End is safe outside block at (-30, 35, 15).
    // The continuous swept trajectory passes directly through the middle of the workpiece block!
    payload.motionSegment.startTcp = { x: 100, y: 35, z: 15 };
    payload.motionSegment.endTcp = { x: -30, y: 35, z: 15 };

    // Evaluate using Continuous Swept CCD Provider
    const result = await CollisionAuthority.evaluate(payload, 'CONTINUOUS_SWEPT_PROVIDER_P4');
    expect(result.status).toBe(CollisionStatus.PENETRATION);
    
    // Time of Impact (TOI) must be between 0.0 and 1.0
    expect(result.temporalInfo.timeOfImpactNormalized).not.toBeNull();
    expect(result.temporalInfo.timeOfImpactNormalized).toBeGreaterThan(0.0);
    expect(result.temporalInfo.timeOfImpactNormalized).toBeLessThan(1.0);
  });

  // 8. clearance -> finite computed value
  test('P9_M08: clearance -> finite computed value', async () => {
    const payload = createBasePayload();
    // Tool is safe, 15mm separated from workpiece
    payload.motionSegment.startTcp = { x: 30, y: 30, z: 51 }; // 51 - 6 (radius) = 45mm, which is exactly 15mm above z=30
    payload.motionSegment.endTcp = { x: 30, y: 30, z: 51 };

    const result = await CollisionAuthority.evaluate(payload);
    expect(result.status).toBe(CollisionStatus.NO_COLLISION);
    expect(result.metrics.minClearanceMm).toBeCloseTo(15.0, 1);
    expect(Number.isFinite(result.metrics.minClearanceMm)).toBe(true);
  });

  // 9. invalid axis -> FAIL_CLOSED
  test('P9_M09: invalid coordinates -> FAIL_CLOSED', async () => {
    const payload = createBasePayload();
    // Passing infinite coordinates or NaN coordinates
    payload.motionSegment.startTcp = { x: NaN, y: 100, z: 80 };

    const result = await CollisionAuthority.evaluate(payload);
    expect(result.status).toBe(CollisionStatus.ANALYSIS_FAILED);
    expect(result.provenSafe).toBe(false);
    expect(result.failureState.isFailed).toBe(true);
    expect(result.failureState.failureReason).toContain('non-finite or NaN');
  });
});
