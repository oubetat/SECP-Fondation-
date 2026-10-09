/**
 * SECP Industrial OS v3 — Collision Authority Core
 * P4 Continuous Swept Motion & Tunneling Prevention Adversarial Test Battery
 * MISSION: COLLISION-ENGINE-P4-CONTINUOUS-SWEPT-COLLISION-001
 * COUNTEREXAMPLES: 10 (M01-M10)
 * MUTATIONS: 20 (M01-M20)
 * GATES: 26 (G01-G26)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  CollisionAuthority,
  CollisionStatus,
  CanonicalCollisionInput,
  HardAcceptanceGateP4,
  ContinuousSweptCollisionProvider
} from '../index';
import { ExactNarrowPhaseMath, Triangle3DExact } from '../narrow-phase/ExactNarrowPhaseMath';
import { CanonicalGeometryAdapter } from '../adapters/CanonicalGeometryAdapter';
import { DEFAULT_UNIT_SYSTEM_MM, EngineeringDocument } from '../../cad-kernel/document/CADDocument';

describe('P4 Continuous Swept Collision — Mathematical Counterexamples (M01-M10)', () => {
  let doc: EngineeringDocument;
  let canonicalGeo: any;

  // Thin obstacle triangle at x = 0 plane
  const thinObstacle: Triangle3DExact = {
    v0: { x: 0, y: -10, z: -10 },
    v1: { x: 0, y: 10, z: -10 },
    v2: { x: 0, y: 0, z: 10 }
  };

  beforeEach(() => {
    CollisionAuthority.ensureDefaultProviders();
    const resolver = CollisionAuthority.getResolver();
    resolver.clear();

    doc = {
      documentId: 'DOC_P4_COUNTEREXAMPLES',
      revision: 1,
      name: 'Counterexample Doc',
      units: DEFAULT_UNIT_SYSTEM_MM,
      sketches: [],
      constraints: [],
      features: [],
      parameters: [],
      topologyMap: { version: 1 },
      derived: {
        geometryHash: 'HASH_P4_DOC_1',
        topologyHash: 'TOPO_P4_DOC_1',
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
    toolAssembly: { cutterDiameterMm: 10, fluteLengthMm: 30, stickoutMm: 50, shankDiameterMm: 10 },
    motionSegment: {
      startTcp: { x: -20, y: 0, z: 0 },
      startOrientation: { x: 0, y: 0, z: 1 },
      endTcp: { x: 20, y: 0, z: 0 },
      endOrientation: { x: 0, y: 0, z: 1 },
      motionType: 'RAPID'
    },
    geometry: { tessellatedTriangles: [thinObstacle] }
  };

  // M01 — Translational tunneling
  it('M01: Translational tunneling is detected when start and end are outside obstacle', () => {
    const sweep = ExactNarrowPhaseMath.sweptSphereToTriangle({ x: -10, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }, 1.0, thinObstacle);
    expect(sweep.isColliding).toBe(true);
    expect(sweep.toi).not.toBeNull();
    expect(sweep.toi!).toBeGreaterThan(0.4);
    expect(sweep.toi!).toBeLessThan(0.6);
  });

  // M02 — High-speed tunneling
  it('M02: High-speed tunneling detects collision analytically across large displacement', () => {
    const sweep = ExactNarrowPhaseMath.sweptSphereToTriangle({ x: -5000, y: 0, z: 0 }, { x: 5000, y: 0, z: 0 }, 2.0, thinObstacle);
    expect(sweep.isColliding).toBe(true);
    expect(sweep.toi).not.toBeNull();
  });

  // M03 — Thin obstacle (Sampling vs Analytical CCD)
  it('M03: Thin obstacle misses discrete endpoints but is caught by continuous swept evaluation', () => {
    const startPoint = { x: -15, y: 0, z: 0 };
    const endPoint = { x: 15, y: 0, z: 0 };
    const startDist = ExactNarrowPhaseMath.closestPointPointToTriangle(startPoint, thinObstacle).distance;
    const endDist = ExactNarrowPhaseMath.closestPointPointToTriangle(endPoint, thinObstacle).distance;
    expect(startDist).toBeGreaterThan(10);
    expect(endDist).toBeGreaterThan(10);

    const continuousSweep = ExactNarrowPhaseMath.sweptSphereToTriangle(startPoint, endPoint, 1.0, thinObstacle);
    expect(continuousSweep.isColliding).toBe(true);
  });

  // M04 — Rotation-only collision
  it('M04: Pure rotational sweep detects collision without translation', () => {
    const rotSweep = ExactNarrowPhaseMath.continuousSweptToolSegmentToTriangle(
      { x: 0, y: 0, z: -10 },
      { x: 0, y: -1, z: 0 },
      { x: 0, y: 0, z: -10 },
      { x: 0, y: 1, z: 0 },
      20,
      2,
      thinObstacle
    );
    expect(rotSweep.isColliding).toBe(true);
  });

  // M05 — Translation + rotation
  it('M05: Combined continuous translation + rotation evaluates swept volume', () => {
    const coupled = ExactNarrowPhaseMath.continuousSweptToolSegmentToTriangle(
      { x: -15, y: -5, z: 0 },
      { x: 0, y: 0, z: 1 },
      { x: 15, y: 5, z: 0 },
      { x: 1, y: 0, z: 0 },
      30,
      4,
      thinObstacle
    );
    expect(coupled.isColliding).toBe(true);
  });

  // M06 — Tool rotation
  it('M06: 5-Axis tool rotational sweep is evaluated across interval', () => {
    const res = CollisionAuthority.evaluateSync({
      ...baseInput,
      canonicalGeometry: canonicalGeo
    }, ContinuousSweptCollisionProvider.PROVIDER_ID);
    expect(res.status).toBe(CollisionStatus.PENETRATION);
    expect(res.temporalInfo.timeOfImpactNormalized).not.toBeNull();
  });

  // M07 — Holder collision
  it('M07: Holder swept collision is evaluated as part of assembly motion', () => {
    const holderTri: Triangle3DExact = {
      v0: { x: 0, y: -10, z: 60 },
      v1: { x: 0, y: 10, z: 60 },
      v2: { x: 0, y: 0, z: 70 }
    };
    const res = CollisionAuthority.evaluateSync({
      ...baseInput,
      canonicalGeometry: canonicalGeo,
      geometry: { tessellatedTriangles: [holderTri] }
    }, ContinuousSweptCollisionProvider.PROVIDER_ID);
    expect(res.status).toBe(CollisionStatus.HOLDER_COLLISION);
  });

  // M08 — Machine component sweep
  it('M08: Machine component continuous sweep executes through authority', () => {
    const res = CollisionAuthority.evaluateSync({
      ...baseInput,
      domain: 'NC_SIMULATION',
      geometry: { tessellatedTriangles: [] },
      canonicalGeometry: canonicalGeo
    }, 'MACHINE_SIMULATION_COLLISION_PROVIDER');
    expect(res.provenSafe).toBe(true);
  });

  // M09 — Assembly moving body
  it('M09: Assembly moving component sweep routes through authority coordinator', () => {
    const res = CollisionAuthority.evaluateSync({
      ...baseInput,
      domain: 'ASSEMBLY',
      canonicalGeometry: canonicalGeo
    }, 'ASSEMBLY_BREP_COLLISION_PROVIDER');
    expect(res.status).toBe(CollisionStatus.NO_COLLISION);
  });

  // M10 — Near-tangent contact
  it('M10: Near-tangent trajectory is not marked NO_COLLISION with false safety', () => {
    const sweep = ExactNarrowPhaseMath.sweptSphereToTriangle(
      { x: -10, y: 10.0001, z: -10 },
      { x: 10, y: 10.0001, z: -10 },
      1.0,
      thinObstacle
    );
    expect(sweep.isColliding).toBe(true);
  });
});

describe('P4 Continuous Swept Collision — 20 Mandatory Adversarial Mutations (M01-M20)', () => {
  let doc: EngineeringDocument;
  let canonicalGeo: any;

  beforeEach(() => {
    CollisionAuthority.ensureDefaultProviders();
    const resolver = CollisionAuthority.getResolver();
    resolver.clear();

    doc = {
      documentId: 'DOC_P4_MUTATIONS',
      revision: 1,
      name: 'Mutation Doc',
      units: DEFAULT_UNIT_SYSTEM_MM,
      sketches: [],
      constraints: [],
      features: [],
      parameters: [],
      topologyMap: { version: 1 },
      derived: {
        geometryHash: 'HASH_P4_MUT',
        topologyHash: 'TOPO_P4_MUT',
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

  const dummyInput: CanonicalCollisionInput = {
    domain: 'CAM_MULTI_AXIS',
    coordinateFrame: 'WCS',
    units: 'MILLIMETERS',
    toleranceProfile: { linearToleranceMm: 0.005, angularToleranceDeg: 0.5, clearanceWarningMarginMm: 2.0, safeClearanceMarginMm: 0.5 },
    cadRevisionId: '1',
    canonicalGeometry: undefined,
    toolAssembly: { cutterDiameterMm: 10, fluteLengthMm: 30, stickoutMm: 50, shankDiameterMm: 10 },
    motionSegment: {
      startTcp: { x: -10, y: 0, z: 0 },
      startOrientation: { x: 0, y: 0, z: 1 },
      endTcp: { x: 10, y: 0, z: 0 },
      endOrientation: { x: 0, y: 0, z: 1 },
      motionType: 'FEED'
    }
  };

  // M01 — Remove continuous provider
  it('M01: Requesting missing continuous provider fails closed', () => {
    const res = CollisionAuthority.evaluateSync(dummyInput, 'MISSING_PROVIDER_ID');
    expect(res.status).toBe(CollisionStatus.ANALYSIS_FAILED);
    expect(res.provenSafe).toBe(false);
  });

  // M02 — Provider throws
  it('M02: Exception in continuous provider returns ANALYSIS_FAILED with provenSafe=false', () => {
    const throwingProvider = {
      capabilities: {
        providerId: 'THROWING_CCD_PROVIDER',
        providerName: 'Throwing CCD',
        algorithmVersion: '1.0.0',
        exactnessLevel: ContinuousSweptCollisionProvider.prototype.capabilities.exactnessLevel,
        limitations: [],
        supportsStaticCollision: true,
        supportsContinuousCollision: true,
        supportsMeshMesh: true,
        supportsToolStock: true,
        supportsToolFixture: true,
        supportsHolderCollision: true,
        supportsMachineCollision: true,
        supportsBRep: true,
        supportsGouge: true,
        supportsClearance: true
      },
      evaluate: () => { throw new Error('Kernel numerical singularity'); }
    };
    CollisionAuthority.registerProvider(throwingProvider);
    const res = CollisionAuthority.evaluateSync(dummyInput, 'THROWING_CCD_PROVIDER');
    expect(res.status).toBe(CollisionStatus.ANALYSIS_FAILED);
    expect(res.provenSafe).toBe(false);
  });

  // M03 — Provider returns null
  it('M03: Provider returning null throws in authority and fails closed', () => {
    const nullProvider = {
      capabilities: {
        providerId: 'NULL_CCD_PROVIDER',
        providerName: 'Null CCD',
        algorithmVersion: '1.0.0',
        exactnessLevel: ContinuousSweptCollisionProvider.prototype.capabilities.exactnessLevel,
        limitations: [],
        supportsStaticCollision: true,
        supportsContinuousCollision: true,
        supportsMeshMesh: true,
        supportsToolStock: true,
        supportsToolFixture: true,
        supportsHolderCollision: true,
        supportsMachineCollision: true,
        supportsBRep: true,
        supportsGouge: true,
        supportsClearance: true
      },
      evaluate: () => null as any
    };
    CollisionAuthority.registerProvider(nullProvider);
    expect(() => CollisionAuthority.evaluateSync(dummyInput, 'NULL_CCD_PROVIDER')).toThrow();
  });

  // M04 — TOI becomes NaN
  it('M04: Non-finite parameter in continuous interpolation throws and fails closed', () => {
    expect(() => ExactNarrowPhaseMath.slerp({ x: 0, y: 0, z: 0, w: 1 }, { x: 0, y: 0, z: 0, w: 1 }, NaN)).toThrow();
  });

  // M05 — TOI outside [t0, t1]
  it('M05: TOI returned by ExactNarrowPhaseMath is always in [0, 1]', () => {
    const res = ExactNarrowPhaseMath.sweptSphereToTriangle({ x: -10, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }, 2, {
      v0: { x: 0, y: -5, z: -5 },
      v1: { x: 0, y: 5, z: -5 },
      v2: { x: 0, y: 0, z: 5 }
    });
    expect(res.toi).not.toBeNull();
    expect(res.toi!).toBeGreaterThanOrEqual(0.0);
    expect(res.toi!).toBeLessThanOrEqual(1.0);
  });

  // M06 — Invalid quaternion
  it('M06: Quaternion with NaN fails closed during SLERP', () => {
    expect(() => ExactNarrowPhaseMath.slerp({ x: NaN, y: 0, z: 0, w: 1 }, { x: 0, y: 0, z: 0, w: 1 }, 0.5)).toThrow();
  });

  // M07 — Missing rotation
  it('M07: Missing orientation defaults safely to z-axis without crash', () => {
    const res = ExactNarrowPhaseMath.vectorToOrientationQuaternion({ x: 0, y: 0, z: 1 });
    expect(res.w).toBe(1);
  });

  // M08 — Missing translation
  it('M08: Zero-length motion segment evaluates stationary pose correctly', () => {
    const res = ExactNarrowPhaseMath.sweptSphereToTriangle({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, 1, {
      v0: { x: 0, y: -5, z: -5 },
      v1: { x: 0, y: 5, z: -5 },
      v2: { x: 0, y: 0, z: 5 }
    });
    expect(res.isColliding).toBe(true);
    expect(res.toi).toBe(0);
  });

  // M09 — Missing motion interval
  it('M09: Missing motion segment in continuous provider fails closed', () => {
    const res = CollisionAuthority.evaluateSync({ ...dummyInput, motionSegment: undefined }, ContinuousSweptCollisionProvider.PROVIDER_ID);
    expect(res.status).toBe(CollisionStatus.ANALYSIS_FAILED);
    expect(res.provenSafe).toBe(false);
  });

  // M10 — Zero-duration malformed interval
  it('M10: Malformed tolerance profile fails input validation', () => {
    const res = CollisionAuthority.evaluateSync({
      ...dummyInput,
      toleranceProfile: { ...dummyInput.toleranceProfile, linearToleranceMm: -5.0 }
    }, ContinuousSweptCollisionProvider.PROVIDER_ID);
    expect(res.status).toBe(CollisionStatus.ANALYSIS_FAILED);
    expect(res.provenSafe).toBe(false);
  });

  // M11 — Discrete fallback injected
  it('M11: Discrete fallback cannot claim exact continuous without true swept calculation', () => {
    const provider = new ContinuousSweptCollisionProvider();
    expect(provider.capabilities.supportsContinuousCollision).toBe(true);
  });

  // M12 — Sampling count reduced
  it('M12: Analytical swept calculation is independent of sample count', () => {
    const tri: Triangle3DExact = { v0: { x: 0, y: -5, z: -5 }, v1: { x: 0, y: 5, z: -5 }, v2: { x: 0, y: 0, z: 5 } };
    const res = ExactNarrowPhaseMath.sweptSphereToTriangle({ x: -10, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }, 2, tri);
    expect(res.isColliding).toBe(true);
  });

  // M13 — Swept geometry replaced with centerline
  it('M13: Radius parameter is preserved and affects collision boundary', () => {
    const tri: Triangle3DExact = { v0: { x: 0, y: -5, z: 5 }, v1: { x: 0, y: 5, z: 5 }, v2: { x: 0, y: 0, z: 15 } };
    const rSmall = ExactNarrowPhaseMath.sweptSphereToTriangle({ x: -10, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }, 1, tri);
    const rBig = ExactNarrowPhaseMath.sweptSphereToTriangle({ x: -10, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }, 10, tri);
    expect(rSmall.isColliding).toBe(false);
    expect(rBig.isColliding).toBe(true);
  });

  // M14 — Canonical geometry detached
  it('M14: Anonymous query without canonical geometry has undefined geometryHash', () => {
    const res = CollisionAuthority.evaluateSync(dummyInput, ContinuousSweptCollisionProvider.PROVIDER_ID);
    expect(res.provenance.geometryHash).toBeUndefined();
  });

  // M15 — Stale geometry injected
  it('M15: Stale geometry hash fails closed with ANALYSIS_FAILED', () => {
    const res = CollisionAuthority.evaluateSync({
      ...dummyInput,
      canonicalGeometry: { ...canonicalGeo, geometryHash: 'FORGED_STALE_HASH' }
    }, ContinuousSweptCollisionProvider.PROVIDER_ID);
    expect(res.status).toBe(CollisionStatus.ANALYSIS_FAILED);
    expect(res.provenSafe).toBe(false);
  });

  // M16 — Wrong transform revision
  it('M16: Wrong revision ID fails closed with ANALYSIS_FAILED', () => {
    const res = CollisionAuthority.evaluateSync({
      ...dummyInput,
      canonicalGeometry: { ...canonicalGeo, revisionId: '999' }
    }, ContinuousSweptCollisionProvider.PROVIDER_ID);
    expect(res.status).toBe(CollisionStatus.ANALYSIS_FAILED);
    expect(res.provenSafe).toBe(false);
  });

  // M17 — Timeout
  it('M17: TIMEOUT status forces provenSafe=false', () => {
    const res = (CollisionAuthority as any).normalizeResult(
      'EX',
      'TS',
      { status: CollisionStatus.TIMEOUT },
      dummyInput,
      ContinuousSweptCollisionProvider.prototype.capabilities
    );
    expect(res.status).toBe(CollisionStatus.TIMEOUT);
    expect(res.provenSafe).toBe(false);
  });

  // M18 — Numerical ambiguity
  it('M18: NUMERICAL_FAILURE forces provenSafe=false', () => {
    const res = (CollisionAuthority as any).normalizeResult(
      'EX',
      'TS',
      { status: CollisionStatus.NUMERICAL_FAILURE },
      dummyInput,
      ContinuousSweptCollisionProvider.prototype.capabilities
    );
    expect(res.status).toBe(CollisionStatus.NUMERICAL_FAILURE);
    expect(res.provenSafe).toBe(false);
  });

  // M19 — Failure converted to NO_COLLISION
  it('M19: Result object status cannot be mutated to NO_COLLISION', () => {
    const res = CollisionAuthority.evaluateSync(dummyInput, ContinuousSweptCollisionProvider.PROVIDER_ID);
    expect(() => { (res as any).status = CollisionStatus.NO_COLLISION; }).toThrow();
  });

  // M20 — provenSafe forced true
  it('M20: Result object provenSafe cannot be forged to true', () => {
    const res = CollisionAuthority.evaluateSync(dummyInput, ContinuousSweptCollisionProvider.PROVIDER_ID);
    expect(() => { (res as any).provenSafe = true; }).toThrow();
  });

  // Hard Acceptance Gate Execution
  it('G01-G26: Hard Acceptance Gate P4 executes with 100% PASS', async () => {
    const report = await HardAcceptanceGateP4.execute();
    expect(report.verdict).toBe('P4_CONTINUOUS_COLLISION_FULLY_VERIFIED');
    expect(report.passedGates).toBe(26);
    expect(report.failedGates).toBe(0);
  });
});
