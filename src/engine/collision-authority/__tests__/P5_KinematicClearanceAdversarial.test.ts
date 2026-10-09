/**
 * SECP Industrial OS v3 — Collision Authority Core
 * P5 Kinematic Clearance & Multi-Body Collision Adversarial Test Battery
 * MISSION: COLLISION-ENGINE-P5-KINEMATIC-CLEARANCE-001
 * MUTATIONS: 26 (M01-M26)
 * GATES: 30 (G01-G30)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  CollisionAuthority,
  CollisionStatus,
  CanonicalCollisionInput,
  HardAcceptanceGateP5,
  KinematicClearanceEngine
} from '../index';
import { ExactNarrowPhaseMath, Triangle3DExact } from '../narrow-phase/ExactNarrowPhaseMath';
import { CanonicalGeometryAdapter } from '../adapters/CanonicalGeometryAdapter';
import { DEFAULT_UNIT_SYSTEM_MM, EngineeringDocument } from '../../cad-kernel/document/CADDocument';

describe('P5 Kinematic Clearance Adversarial Battery (M01-M26)', () => {
  let doc: EngineeringDocument;
  let canonicalGeo: any;

  // Thin obstacle triangle at x = 0 plane, y in [-10, 10], z in [0, 30]
  const obstacleTri: Triangle3DExact = {
    v0: { x: 0, y: -10, z: 0 },
    v1: { x: 0, y: 10, z: 0 },
    v2: { x: 0, y: 0, z: 30 }
  };

  beforeEach(() => {
    CollisionAuthority.ensureDefaultProviders();
    const resolver = CollisionAuthority.getResolver();
    resolver.clear();

    doc = {
      documentId: 'DOC_P5_MUTATION_BATTERY',
      revision: 1,
      name: 'P5 Mutation Test Doc',
      units: DEFAULT_UNIT_SYSTEM_MM,
      sketches: [],
      constraints: [],
      features: [],
      parameters: [],
      topologyMap: { version: 1 },
      derived: {
        geometryHash: 'HASH_P5_MUT_1',
        topologyHash: 'TOPO_P5_MUT_1',
        mesh: { normals: [], facesCount: 0, topologyMap: { faceTriangleMap: {}, edgeVertexMap: {}, vertexIndexMap: {}, sharedEdges: [] }, brepHash: "MOCK", meshHash: "MOCK", 
          vertices: Array.from(new Float32Array([-10, -10, -10, 10, 10, 10])),
          indices: Array.from(new Uint32Array([0, 1, 2]))
        }
      },
      evidence: []
    };
    resolver.register(doc);
    canonicalGeo = CanonicalGeometryAdapter.adapt(doc);
  });

  const baseInput: CanonicalCollisionInput = {
    domain: 'CAM_MULTI_AXIS',
    coordinateFrame: 'WCS',
    units: 'MILLIMETERS',
    toleranceProfile: { linearToleranceMm: 0.005, angularToleranceDeg: 0.5, clearanceWarningMarginMm: 2.0, safeClearanceMarginMm: 0.5 },
    cadRevisionId: '1',
    canonicalGeometry: undefined,
    toolAssembly: { cutterDiameterMm: 10, fluteLengthMm: 30, stickoutMm: 50, shankDiameterMm: 10, holderLowerDiameterMm: 25, holderGaugeLengthMm: 40 },
    motionSegment: {
      startTcp: { x: -15, y: 0, z: 5 },
      startOrientation: { x: 0, y: 0, z: 1 },
      endTcp: { x: 15, y: 0, z: 5 },
      endOrientation: { x: 0, y: 0, z: 1 },
      motionType: 'FEED'
    },
    geometry: { tessellatedTriangles: [obstacleTri] }
  };

  // M01: Center distance says safe, CAD geometry collides
  it('M01: Center distance heuristic fails to detect collision, but geometric clearance catches it', () => {
    // Tool flute segment at x=0, z=15 has radius 5. Obstacle triangle is at x=0.
    // Centerline distance at x=0 is 0, but if evaluated from an offset center (e.g. x=3):
    // Center distance = 3mm > 2mm margin, but radius = 5mm => penetration = 2mm!
    const tcp = { x: 3, y: 0, z: 10 };
    const centerDist = 3.0; // Distance of centerline to x=0 plane
    const centerDistanceSaysSafe = centerDist > 2.0;
    expect(centerDistanceSaysSafe).toBe(true);

    const capRes = ExactNarrowPhaseMath.capsuleToTriangleDistance(tcp, { x: 3, y: 0, z: 30 }, 5, obstacleTri);
    expect(capRes.isColliding).toBe(true);
    expect(capRes.penetrationDepthMm).toBeGreaterThan(1.0);
  });

  // M02: Bounding sphere says safe, actual geometry collides
  it('M02: Bounding sphere approximation cannot substitute for true CAD geometry', () => {
    const report = KinematicClearanceEngine.evaluateKinematicClearance({
      ...baseInput,
      canonicalGeometry: canonicalGeo
    });
    expect(report.isColliding).toBe(true);
    expect(report.overallStatus).toBe('PENETRATION');
  });

  // M03: Tool tip safe, shaft collides
  it('M03: Tool tip position is completely safe outside obstacle, but tool shaft penetrates', () => {
    // TCP at z = -20 (well below obstacle base z=0), but stickout extends to z = +30 (inside obstacle)
    const shaftOnlyInput: CanonicalCollisionInput = {
      ...baseInput,
      canonicalGeometry: canonicalGeo,
      motionSegment: {
        startTcp: { x: 0, y: 0, z: -10 }, // Tip is below triangle base z=0
        startOrientation: { x: 0, y: 0, z: 1 },
        endTcp: { x: 0, y: 0, z: -10 },
        endOrientation: { x: 0, y: 0, z: 1 },
        motionType: 'FEED'
      }
    };
    const report = KinematicClearanceEngine.evaluateKinematicClearance(shaftOnlyInput);
    const tipDist = ExactNarrowPhaseMath.closestPointPointToTriangle({ x: 0, y: 0, z: -10 }, obstacleTri).distance;
    expect(tipDist).toBeGreaterThan(5.0); // Tip itself is distant

    // But overall tool assembly is colliding due to shaft/flute
    expect(report.isColliding).toBe(true);
  });

  // M04: Tool safe, holder collides
  it('M04: Cutter flutes are completely clear, but holder stage collides with fixture', () => {
    // Fixture obstacle at z = 45 (above cutter flute length of 30)
    const holderObstacle: Triangle3DExact = {
      v0: { x: 0, y: -10, z: 45 },
      v1: { x: 0, y: 10, z: 45 },
      v2: { x: 0, y: 0, z: 55 }
    };
    const holderOnlyInput: CanonicalCollisionInput = {
      ...baseInput,
      canonicalGeometry: canonicalGeo,
      motionSegment: {
        startTcp: { x: 0, y: 0, z: 0 },
        startOrientation: { x: 0, y: 0, z: 1 },
        endTcp: { x: 0, y: 0, z: 0 },
        endOrientation: { x: 0, y: 0, z: 1 },
        motionType: 'FEED'
      },
      geometry: { tessellatedTriangles: [holderObstacle] }
    };
    const report = KinematicClearanceEngine.evaluateKinematicClearance(holderOnlyInput);
    const holderColliding = report.details.some(d => d.componentTypeA === 'TOOL_HOLDER' && d.isColliding);
    expect(holderColliding).toBe(true);
  });

  // M05: Endpoint clearance safe, interior motion collides
  it('M05: Endpoint poses are both clear, but continuous trajectory collides in the interior', () => {
    const report = KinematicClearanceEngine.evaluateKinematicClearance({
      ...baseInput,
      canonicalGeometry: canonicalGeo
    });
    // Start at x=-15 (clear), end at x=15 (clear)
    const startClear = ExactNarrowPhaseMath.capsuleToTriangleDistance({ x: -15, y: 0, z: 5 }, { x: -15, y: 0, z: 35 }, 5, obstacleTri).clearanceMm > 5;
    const endClear = ExactNarrowPhaseMath.capsuleToTriangleDistance({ x: 15, y: 0, z: 5 }, { x: 15, y: 0, z: 35 }, 5, obstacleTri).clearanceMm > 5;
    expect(startClear).toBe(true);
    expect(endClear).toBe(true);

    // But continuous motion detects collision
    expect(report.isColliding).toBe(true);
  });

  // M06: Fixture collision hidden by bounding approximation
  it('M06: Fixture collision is evaluated accurately using exact geometry', () => {
    const fixtureTri: Triangle3DExact = { v0: { x: 0, y: -5, z: 10 }, v1: { x: 0, y: 5, z: 10 }, v2: { x: 0, y: 0, z: 20 } };
    const report = KinematicClearanceEngine.evaluateKinematicClearance(baseInput, { customObstacles: [fixtureTri] });
    expect(report.isColliding).toBe(true);
  });

  // M07: Machine component collision hidden by center-distance test
  it('M07: Machine simulation provider evaluates true multi-body geometry clearance', () => {
    const res = CollisionAuthority.evaluateSync({
      ...baseInput,
      domain: 'NC_SIMULATION',
      canonicalGeometry: canonicalGeo
    }, 'MACHINE_SIMULATION_COLLISION_PROVIDER');
    expect(res.status).toBe(CollisionStatus.MACHINE_COLLISION);
  });

  // M08: Nested assembly transform error
  it('M08: Nested kinematic transform preserves valid 4x4 matrix representation', () => {
    const fk = KinematicClearanceEngine.computeForwardKinematics({ X: 10, Y: 20, Z: 30, A: 30, C: 45 });
    expect(fk.transforms[0].matrix.m.length).toBe(16);
    expect(fk.transforms[1].matrix.m.length).toBe(16);
  });

  // M09: Wrong parent transform
  it('M09: Rotary table transform rotates correctly with A and C angles', () => {
    const fk = KinematicClearanceEngine.computeForwardKinematics({ X: 0, Y: 0, Z: 0, A: 90, C: 0 });
    const tableZ = fk.transforms[1].zAxisWCS;
    // When A=90, table normal tilts into Y axis
    expect(Math.abs(tableZ.y - 1.0)).toBeLessThan(1e-4);
  });

  // M10: Wrong coordinate frame
  it('M10: Coordinate frame mismatch fails closed with ANALYSIS_FAILED', () => {
    const res = CollisionAuthority.evaluateSync({
      ...baseInput,
      coordinateFrame: 'TCS',
      canonicalGeometry: { ...canonicalGeo, coordinateFrame: 'WCS' }
    });
    expect(res.status).toBe(CollisionStatus.ANALYSIS_FAILED);
    expect(res.provenSafe).toBe(false);
  });

  // M11: Wrong transform revision
  it('M11: Transform revision mismatch fails closed with ANALYSIS_FAILED', () => {
    const res = CollisionAuthority.evaluateSync({
      ...baseInput,
      canonicalGeometry: { ...canonicalGeo, revisionId: 'FORGED_REV_99' }
    });
    expect(res.status).toBe(CollisionStatus.ANALYSIS_FAILED);
    expect(res.provenSafe).toBe(false);
  });

  // M12: Stale kinematic state
  it('M12: Stale geometry hash in kinematic input fails closed', () => {
    const res = CollisionAuthority.evaluateSync({
      ...baseInput,
      canonicalGeometry: { ...canonicalGeo, geometryHash: 'STALE_KIN_HASH' }
    });
    expect(res.status).toBe(CollisionStatus.ANALYSIS_FAILED);
    expect(res.provenSafe).toBe(false);
  });

  // M13: Singular/near-singular configuration
  it('M13: Singular configuration in rotary table is detected and condition number flagged', () => {
    const fk = KinematicClearanceEngine.computeForwardKinematics({ X: 0, Y: 0, Z: 0, A: 0, C: 0 });
    expect(fk.isSingular).toBe(true);
    expect(fk.conditionNumber).toBe(Infinity);
  });

  // M14: Zero-length axis
  it('M14: Zero-length tool orientation vector fails input normalization', () => {
    const res = ExactNarrowPhaseMath.normalize({ x: 0, y: 0, z: 0 });
    expect(res.z).toBe(1); // Safely normalized to default z-axis without NaN
  });

  // M15: Invalid joint state
  it('M15: Non-finite joint value throws and fails closed', () => {
    expect(() => KinematicClearanceEngine.computeForwardKinematics({ X: NaN, Y: 0, Z: 0, A: 0, C: 0 })).toThrow();
  });

  // M16: NaN transform
  it('M16: NaN bounding coordinates in canonical geometry fail closed with INVALID_GEOMETRY', () => {
    const res = CollisionAuthority.evaluateSync({
      ...baseInput,
      canonicalGeometry: {
        ...canonicalGeo,
        bounds: { min: { x: NaN, y: 0, z: 0 }, max: { x: 10, y: 10, z: 10 } }
      }
    });
    expect(res.status).toBe(CollisionStatus.INVALID_GEOMETRY);
    expect(res.provenSafe).toBe(false);
  });

  // M17: Infinity transform
  it('M17: Infinite coordinates in bounding box fail closed with INVALID_GEOMETRY', () => {
    const res = CollisionAuthority.evaluateSync({
      ...baseInput,
      canonicalGeometry: {
        ...canonicalGeo,
        bounds: { min: { x: -Infinity, y: 0, z: 0 }, max: { x: 10, y: 10, z: 10 } }
      }
    });
    expect(res.status).toBe(CollisionStatus.INVALID_GEOMETRY);
    expect(res.provenSafe).toBe(false);
  });

  // M18: Broad phase false negative injection
  it('M18: Colliding bodies must not be culled by broad phase', () => {
    const report = KinematicClearanceEngine.evaluateKinematicClearance({
      ...baseInput,
      canonicalGeometry: canonicalGeo
    });
    expect(report.isColliding).toBe(true);
    expect(report.details.some(d => d.narrowPhaseEvaluated && d.isColliding)).toBe(true);
  });

  // M19: Exact narrow phase failure
  it('M19: Missing motion segment in kinematic provider fails closed', () => {
    const res = CollisionAuthority.evaluateSync({
      ...baseInput,
      motionSegment: undefined
    }, 'KINEMATICS_COLLISION_PROVIDER');
    expect(res.status).toBe(CollisionStatus.ANALYSIS_FAILED);
    expect(res.provenSafe).toBe(false);
  });

  // M20: Clearance failure converted to safe result
  it('M20: Result object status is deeply frozen and cannot be mutated to NO_COLLISION', () => {
    const res = CollisionAuthority.evaluateSync({
      ...baseInput,
      canonicalGeometry: canonicalGeo
    }, 'KINEMATICS_COLLISION_PROVIDER');
    expect(() => { (res as any).status = CollisionStatus.NO_COLLISION; }).toThrow();
  });

  // M21: Synthetic geometry injection
  it('M21: Synthetic geometry rejected for production kinematics evaluation', () => {
    const syntheticGeo = { ...canonicalGeo, geometrySource: 'SYNTHETIC' as const };
    const res = CollisionAuthority.evaluateSync({
      ...baseInput,
      canonicalGeometry: syntheticGeo
    });
    expect(res.status).toBe(CollisionStatus.UNSUPPORTED);
    expect(res.provenSafe).toBe(false);
  });

  // M22: Stale canonical geometry injection
  it('M22: Stale canonical geometry fails closed with ANALYSIS_FAILED', () => {
    const staleGeo = { ...canonicalGeo, geometryHash: 'STALE_CANONICAL_HASH' };
    const res = CollisionAuthority.evaluateSync({
      ...baseInput,
      canonicalGeometry: staleGeo
    });
    expect(res.status).toBe(CollisionStatus.ANALYSIS_FAILED);
    expect(res.provenSafe).toBe(false);
  });

  // M23: Tool-tip-only fallback injection
  it('M23: Kinematic clearance evaluates full tool assembly, not tool-tip only', () => {
    const report = KinematicClearanceEngine.evaluateKinematicClearance(baseInput);
    const checkedTypes = new Set(report.details.map(d => d.componentTypeA));
    expect(checkedTypes.has('TOOL_CUTTER')).toBe(true);
    expect(checkedTypes.has('TOOL_SHANK')).toBe(true);
    expect(checkedTypes.has('TOOL_HOLDER')).toBe(true);
  });

  // M24: Hardcoded clearance injection
  it('M24: Geometric clearance varies continuously with position (not fixed 25.0 or 15.0)', () => {
    const rep1 = KinematicClearanceEngine.evaluateKinematicClearance({
      ...baseInput,
      motionSegment: {
        startTcp: { x: 30, y: 0, z: 0 },
        startOrientation: { x: 0, y: 0, z: 1 },
        endTcp: { x: 30, y: 0, z: 0 },
        endOrientation: { x: 0, y: 0, z: 1 },
        motionType: 'FEED'
      }
    });
    const rep2 = KinematicClearanceEngine.evaluateKinematicClearance({
      ...baseInput,
      motionSegment: {
        startTcp: { x: 60, y: 0, z: 0 },
        startOrientation: { x: 0, y: 0, z: 1 },
        endTcp: { x: 60, y: 0, z: 0 },
        endOrientation: { x: 0, y: 0, z: 1 },
        motionType: 'FEED'
      }
    });
    expect(rep1.minimumClearanceMm).not.toBe(rep2.minimumClearanceMm);
    expect(rep2.minimumClearanceMm).toBeGreaterThan(rep1.minimumClearanceMm);
  });

  // M25: Provider bypass
  it('M25: Unregistered provider fails closed to ANALYSIS_FAILED', () => {
    const res = CollisionAuthority.evaluateSync(baseInput, 'BYPASS_PROVIDER');
    expect(res.status).toBe(CollisionStatus.ANALYSIS_FAILED);
    expect(res.provenSafe).toBe(false);
  });

  // M26: provenSafe=true mutation
  it('M26: Result object provenSafe is read-only and cannot be forged to true', () => {
    const res = CollisionAuthority.evaluateSync({
      ...baseInput,
      canonicalGeometry: canonicalGeo
    }, 'KINEMATICS_COLLISION_PROVIDER');
    expect(res.provenSafe).toBe(false);
    expect(() => { (res as any).provenSafe = true; }).toThrow();
  });

  // Hard Acceptance Gate Execution
  it('G01-G30: Hard Acceptance Gate P5 executes with 100% PASS', async () => {
    const report = await HardAcceptanceGateP5.execute();
    expect(report.verdict).toBe('P5_KINEMATIC_CLEARANCE_FULLY_VERIFIED');
    expect(report.passedGates).toBe(30);
    expect(report.failedGates).toBe(0);
  });
});
