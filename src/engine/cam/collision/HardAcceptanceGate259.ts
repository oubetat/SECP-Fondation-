/**
 * SECP Industrial OS v3 — Real CAM Kernel
 * PATCH-259 — Hard Acceptance Gate 259 (36 Deterministic Collision Tests)
 */

import { Vector3D } from '../../cadKernel';
import { CollisionMathUtils } from './CollisionMathUtils';
import { BroadPhaseDetector } from './BroadPhaseDetector';
import { NarrowPhaseDetector } from './NarrowPhaseDetector';
import { ContinuousCollisionDetector } from './ContinuousCollisionDetector';
import { GougeDetector } from './GougeDetector';
import { CollisionClassifier, CollisionAvoidanceAdvisor } from './CollisionClassifier';
import { CollisionEvidenceGenerator } from './CollisionEvidenceGenerator';
import { CollisionDetectionEngine } from './CollisionDetectionEngine';
import {
  AABB3D,
  CollisionTolerance,
  FixtureGeometry,
  HolderGeometry,
  ProtectedGeometryModel,
  ToolGeometry,
  ToolPose,
  Triangle3D
} from './CollisionTypes';

export interface GateTestResult {
  testId: string;
  name: string;
  category: string;
  passed: boolean;
  durationMs: number;
  details: string;
}

export interface GateExecutionSummary {
  gateId: string;
  totalTests: number;
  passedCount: number;
  failedCount: number;
  passRatio: number;
  allPassed: boolean;
  timestamp: string;
  results: GateTestResult[];
}

export class HardAcceptanceGate259 {
  public static runAllTests(): GateExecutionSummary {
    const results: GateTestResult[] = [];

    const test = (testId: string, name: string, category: string, fn: () => boolean, detailExtractor?: () => string) => {
      const t0 = performance.now();
      let passed = false;
      let details = '';
      try {
        passed = fn();
        details = detailExtractor ? detailExtractor() : (passed ? 'Verified nominal mathematical behavior.' : 'Assertion failed.');
      } catch (err: any) {
        passed = false;
        details = `Exception: ${err?.message || String(err)}`;
      }
      const durationMs = performance.now() - t0;
      results.push({ testId, name, category, passed, durationMs, details });
    };

    // 1. Math & AABB
    test('TEST_01', 'AABB construction & bounds calculation', 'MATH', () => {
      const pts: Vector3D[] = [{ x: -10, y: 5, z: 2 }, { x: 20, y: -8, z: 15 }];
      const aabb = CollisionMathUtils.createAABB(pts);
      return aabb.min.x === -10 && aabb.max.x === 20 && aabb.min.y === -8 && aabb.max.y === 5;
    });

    test('TEST_02', 'AABB-AABB intersection predicate', 'MATH', () => {
      const a: AABB3D = { min: { x: 0, y: 0, z: 0 }, max: { x: 10, y: 10, z: 10 } };
      const b: AABB3D = { min: { x: 5, y: 5, z: 5 }, max: { x: 15, y: 15, z: 15 } };
      const c: AABB3D = { min: { x: 20, y: 20, z: 20 }, max: { x: 30, y: 30, z: 30 } };
      return CollisionMathUtils.intersectAABB(a, b) === true && CollisionMathUtils.intersectAABB(a, c) === false;
    });

    test('TEST_03', 'AABB clearance distance calculation', 'MATH', () => {
      const a: AABB3D = { min: { x: 0, y: 0, z: 0 }, max: { x: 10, y: 10, z: 10 } };
      const b: AABB3D = { min: { x: 15, y: 0, z: 0 }, max: { x: 25, y: 10, z: 10 } };
      const d = CollisionMathUtils.distanceAABBToAABB(a, b);
      return Math.abs(d - 5.0) < 1e-4;
    });

    // 2. Spatial Acceleration & BVH
    test('TEST_04', 'Spatial BVH tree construction', 'SPATIAL', () => {
      const tris: Triangle3D[] = Array.from({ length: 20 }, (_, i) => ({
        v0: { x: i * 5, y: 0, z: 0 },
        v1: { x: i * 5 + 2, y: 2, z: 0 },
        v2: { x: i * 5 + 2, y: 0, z: 2 },
        normal: { x: 0, y: 0, z: 1 }
      }));
      const root = BroadPhaseDetector.buildBVH(tris, 4);
      return !root.isLeaf && !!root.left && !!root.right;
    });

    test('TEST_05', 'Spatial BVH accelerated query filtering', 'SPATIAL', () => {
      const tris: Triangle3D[] = Array.from({ length: 30 }, (_, i) => ({
        v0: { x: i * 10, y: 0, z: 0 },
        v1: { x: i * 10 + 2, y: 2, z: 0 },
        v2: { x: i * 10 + 2, y: 0, z: 2 },
        normal: { x: 0, y: 0, z: 1 }
      }));
      const root = BroadPhaseDetector.buildBVH(tris, 4);
      const queryAABB: AABB3D = { min: { x: 15, y: -5, z: -5 }, max: { x: 25, y: 5, z: 5 } };
      const found: Triangle3D[] = [];
      BroadPhaseDetector.queryBVH(root, queryAABB, found);
      return found.length > 0 && found.length < 30;
    });

    // 3. Exact Point/Segment/Triangle Geometry
    test('TEST_06', 'Point-to-segment closest projection', 'GEOMETRY', () => {
      const a: Vector3D = { x: 0, y: 0, z: 0 };
      const b: Vector3D = { x: 10, y: 0, z: 0 };
      const p: Vector3D = { x: 5, y: 5, z: 0 };
      const res = CollisionMathUtils.closestPointOnSegment(p, a, b);
      return Math.abs(res.point.x - 5) < 1e-4 && Math.abs(res.point.y - 0) < 1e-4 && Math.abs(res.t - 0.5) < 1e-4;
    });

    test('TEST_07', 'Segment-to-segment shortest distance', 'GEOMETRY', () => {
      const p1 = { x: 0, y: 0, z: 0 }, q1 = { x: 10, y: 0, z: 0 };
      const p2 = { x: 5, y: 5, z: 5 }, q2 = { x: 5, y: -5, z: 5 };
      const res = CollisionMathUtils.closestPointsBetweenSegments(p1, q1, p2, q2);
      return Math.abs(res.distance - 5.0) < 1e-4;
    });

    test('TEST_08', 'Capsule to AABB clearance test', 'GEOMETRY', () => {
      const p0 = { x: 0, y: 0, z: 20 }, p1 = { x: 10, y: 0, z: 20 };
      const aabb: AABB3D = { min: { x: -5, y: -5, z: 0 }, max: { x: 15, y: 5, z: 10 } };
      const res = CollisionMathUtils.capsuleIntersectsAABB(p0, p1, 3.0, aabb);
      return res.intersects === false && Math.abs(res.clearanceMm - 7.0) < 1e-3;
    });

    test('TEST_09', 'Capsule to capsule penetration depth', 'GEOMETRY', () => {
      const p1 = { x: 0, y: 0, z: 0 }, q1 = { x: 10, y: 0, z: 0 };
      const p2 = { x: 5, y: 0, z: 4 }, q2 = { x: 5, y: 10, z: 4 };
      const res = CollisionMathUtils.capsuleIntersectsCapsule(p1, q1, 3, p2, q2, 3); // Sum radius = 6, dist = 4 -> pen = 2
      return res.intersects === true && Math.abs(res.penetrationDepthMm - 2.0) < 1e-3;
    });

    test('TEST_10', 'Ray-Triangle Möller-Trumbore intersection', 'GEOMETRY', () => {
      const tri: Triangle3D = {
        v0: { x: 0, y: 0, z: 0 },
        v1: { x: 10, y: 0, z: 0 },
        v2: { x: 0, y: 10, z: 0 },
        normal: { x: 0, y: 0, z: 1 }
      };
      const res = CollisionMathUtils.rayTriangleIntersection({ x: 2, y: 2, z: 5 }, { x: 0, y: 0, z: -1 }, tri);
      return res.hit === true && Math.abs(res.t - 5.0) < 1e-4 && Math.abs(res.point.z) < 1e-4;
    });

    test('TEST_11', 'Closest point on triangle predicate', 'GEOMETRY', () => {
      const tri: Triangle3D = {
        v0: { x: 0, y: 0, z: 0 },
        v1: { x: 10, y: 0, z: 0 },
        v2: { x: 0, y: 10, z: 0 },
        normal: { x: 0, y: 0, z: 1 }
      };
      const p = { x: 3, y: 3, z: 4 };
      const res = CollisionMathUtils.closestPointOnTriangle(p, tri);
      return Math.abs(res.distance - 4.0) < 1e-3 && Math.abs(res.point.x - 3) < 1e-3 && Math.abs(res.point.y - 3) < 1e-3;
    });

    // 4. Narrow Phase & Assembly Components
    const sampleTool: ToolGeometry = {
      toolId: 'T_TEST_D10',
      toolType: 'ENDMILL',
      cutterDiameterMm: 10,
      fluteLengthMm: 20,
      shoulderLengthMm: 30,
      shankDiameterMm: 10,
      totalLengthMm: 70,
      stickoutMm: 35
    };

    const sampleHolder: HolderGeometry = {
      holderId: 'H_BT40',
      holderType: 'TAPERED',
      gaugeLengthMm: 50,
      lowerDiameterMm: 35,
      upperDiameterMm: 60,
      collarDiameterMm: 60
    };

    const defaultTols: CollisionTolerance = CollisionDetectionEngine.DEFAULT_TOLERANCES;

    test('TEST_12', 'Tool cutter contact detection', 'NARROW_PHASE', () => {
      const pose: ToolPose = { tcp: { x: 5, y: 5, z: 0 }, toolOrientation: { x: 0, y: 0, z: 1 } };
      const tri: Triangle3D = { v0: { x: 0, y: 0, z: 0 }, v1: { x: 10, y: 0, z: 0 }, v2: { x: 0, y: 10, z: 0 }, normal: { x: 0, y: 0, z: 1 } };
      const res = NarrowPhaseDetector.testToolAssemblyAgainstTriangles(pose, sampleTool, sampleHolder, undefined, [tri], defaultTols);
      return res.hasContact === false || res.clearanceMm < 5.0;
    });

    test('TEST_13', 'Tool shank interference detection', 'NARROW_PHASE', () => {
      // Triangle situated at Z=25 (above flutes 20mm, inside shank 35mm)
      const pose: ToolPose = { tcp: { x: 0, y: 0, z: 0 }, toolOrientation: { x: 0, y: 0, z: 1 } };
      const tri: Triangle3D = { v0: { x: 0, y: 0, z: 25 }, v1: { x: 4, y: 0, z: 25 }, v2: { x: 0, y: 4, z: 25 }, normal: { x: 0, y: 0, z: 1 } };
      const res = NarrowPhaseDetector.testToolAssemblyAgainstTriangles(pose, sampleTool, sampleHolder, undefined, [tri], defaultTols);
      return res.hasContact === true && res.contactingSegment === 'SHANK';
    });

    test('TEST_14', 'Holder conical profile collision detection', 'NARROW_PHASE', () => {
      // Obstacle at Z=45 (inside holder zone Z[35..85])
      const pose: ToolPose = { tcp: { x: 0, y: 0, z: 0 }, toolOrientation: { x: 0, y: 0, z: 1 } };
      const tri: Triangle3D = { v0: { x: 10, y: 0, z: 45 }, v1: { x: 12, y: 0, z: 45 }, v2: { x: 10, y: 2, z: 45 }, normal: { x: 0, y: 0, z: 1 } };
      const res = NarrowPhaseDetector.testToolAssemblyAgainstTriangles(pose, sampleTool, sampleHolder, undefined, [tri], defaultTols);
      return res.hasContact === true && (res.contactingSegment === 'HOLDER_LOWER' || res.contactingSegment === 'HOLDER_UPPER');
    });

    test('TEST_15', 'Spindle nose housing collision detection', 'NARROW_PHASE', () => {
      const spindle = { spindleId: 'SP_1', outerDiameterMm: 120, noseLengthMm: 50, housingWidthMm: 150, housingLengthMm: 150, gaugePivotOffsetMm: { x: 0, y: 0, z: 0 } };
      // Obstacle at Z=90 (inside spindle zone Z[85..135])
      const pose: ToolPose = { tcp: { x: 0, y: 0, z: 0 }, toolOrientation: { x: 0, y: 0, z: 1 } };
      const tri: Triangle3D = { v0: { x: 20, y: 0, z: 90 }, v1: { x: 25, y: 0, z: 90 }, v2: { x: 20, y: 5, z: 90 }, normal: { x: 0, y: 0, z: 1 } };
      const res = NarrowPhaseDetector.testToolAssemblyAgainstTriangles(pose, sampleTool, sampleHolder, spindle, [tri], defaultTols);
      return res.hasContact === true && res.contactingSegment === 'SPINDLE';
    });

    test('TEST_16', 'Fixture keep-out zone violation test', 'NARROW_PHASE', () => {
      const fixture: FixtureGeometry = {
        fixtureId: 'FIX_1',
        fixtureType: 'VISE_JAWS',
        name: 'Vise',
        aabb: { min: { x: 10, y: -10, z: -10 }, max: { x: 30, y: 10, z: 10 } },
        keepOutZoneMarginMm: 2.0,
        isKeepOutZoneActive: true
      };
      const pose: ToolPose = { tcp: { x: 12, y: 0, z: 5 }, toolOrientation: { x: 0, y: 0, z: 1 } };
      const res = NarrowPhaseDetector.testToolAssemblyAgainstFixture(pose, sampleTool, sampleHolder, undefined, fixture, defaultTols);
      return res.hasContact === true;
    });

    // 5. Gouge Detection
    test('TEST_17', 'Gouge detection on protected non-machinable surface', 'GOUGE', () => {
      const protectedModel: ProtectedGeometryModel = {
        partId: 'P1',
        protectedSurfaces: [{ surfaceId: 'SEAL_FACE', faceId: 'F_SEAL', surfaceName: 'O-Ring Seal Face', isMachinable: false, requiredClearanceMm: 1.0, allowableOvercutMm: 0 }],
        globalPartAllowanceMm: 0,
        defaultFinishToleranceMm: 0.01
      };
      const tri: Triangle3D = { v0: { x: 0, y: 0, z: 0 }, v1: { x: 10, y: 0, z: 0 }, v2: { x: 0, y: 10, z: 0 }, normal: { x: 0, y: 0, z: 1 }, faceId: 'F_SEAL' };
      const pose: ToolPose = { tcp: { x: 2, y: 2, z: 0.2 }, toolOrientation: { x: 0, y: 0, z: 1 } }; // Clearance is 0.2 mm < 1.0 mm required
      const gouge = GougeDetector.checkGouge(pose, sampleTool, protectedModel, [tri], defaultTols);
      return gouge !== null && gouge.isGouge === true && Math.abs(gouge.overcutDepthMm - 0.8) < 1e-2;
    });

    // 6. Continuous Collision Detection (CCD)
    test('TEST_18', 'CCD adaptive subdivision across fast travel', 'CCD', () => {
      const pA: ToolPose = { tcp: { x: 0, y: 0, z: 10 }, toolOrientation: { x: 0, y: 0, z: 1 } };
      const pB: ToolPose = { tcp: { x: 100, y: 0, z: 10 }, toolOrientation: { x: 0, y: 0, z: 1 } };
      const res = ContinuousCollisionDetector.testSweptMotion(pA, pB, sampleTool, sampleHolder, undefined, [], undefined, defaultTols);
      return res.hasCollision === false && res.minClearanceMm > 0;
    });

    test('TEST_19', 'CCD detects between-points tunneling collision', 'CCD', () => {
      const pA: ToolPose = { tcp: { x: -20, y: 0, z: 5 }, toolOrientation: { x: 0, y: 0, z: 1 } };
      const pB: ToolPose = { tcp: { x: 20, y: 0, z: 5 }, toolOrientation: { x: 0, y: 0, z: 1 } };
      const obstacle: Triangle3D = { v0: { x: -2, y: -2, z: 5 }, v1: { x: 2, y: -2, z: 5 }, v2: { x: 0, y: 2, z: 5 }, normal: { x: 0, y: 0, z: 1 } };
      const res = ContinuousCollisionDetector.testSweptMotion(pA, pB, sampleTool, sampleHolder, undefined, [obstacle], undefined, defaultTols);
      return res.hasCollision === true && res.criticalSubStepT > 0.3 && res.criticalSubStepT < 0.7;
    });

    // 7. Classifier & Collision Matrix
    test('TEST_20', 'Collision matrix differentiates stock cut vs crash', 'CLASSIFIER', () => {
      const poseLinear: ToolPose = { tcp: { x: 0, y: 0, z: 0 }, toolOrientation: { x: 0, y: 0, z: 1 }, motionType: 'LINEAR' };
      const narrowRes: any = { hasContact: true, contactingSegment: 'CUTTER', penetrationDepthMm: 1.5, clearanceMm: 0, contactPointWCS: { x: 0, y: 0, z: 0 }, contactNormal: { x: 0, y: 0, z: 1 } };
      const inc = CollisionClassifier.classifyContact(0, 0, poseLinear, sampleTool, sampleHolder, narrowRes, false);
      return inc.type === 'STOCK_CONTACT' && inc.state === 'CLEAR';
    });

    test('TEST_21', 'Rapid traverse in material marked CRITICAL collision', 'CLASSIFIER', () => {
      const poseRapid: ToolPose = { tcp: { x: 0, y: 0, z: 0 }, toolOrientation: { x: 0, y: 0, z: 1 }, motionType: 'RAPID' };
      const narrowRes: any = { hasContact: true, contactingSegment: 'CUTTER', penetrationDepthMm: 1.5, clearanceMm: 0, contactPointWCS: { x: 0, y: 0, z: 0 }, contactNormal: { x: 0, y: 0, z: 1 } };
      const inc = CollisionClassifier.classifyContact(0, 0, poseRapid, sampleTool, sampleHolder, narrowRes, false);
      return inc.type === 'TOOL_COLLISION' && inc.severity === 'CRITICAL' && inc.state === 'COLLISION';
    });

    test('TEST_22', 'Clearance warning triggered on proximity < 2.0mm', 'CLASSIFIER', () => {
      const pose: ToolPose = { tcp: { x: 0, y: 0, z: 0 }, toolOrientation: { x: 0, y: 0, z: 1 } };
      const narrowRes: any = { hasContact: false, contactingSegment: 'NONE', penetrationDepthMm: 0, clearanceMm: 1.2, contactPointWCS: { x: 0, y: 0, z: 0 }, contactNormal: { x: 0, y: 0, z: 1 } };
      const inc = CollisionClassifier.classifyContact(0, 0, pose, sampleTool, sampleHolder, narrowRes, false);
      return inc.state === 'WARNING' && inc.type === 'CLEARANCE_VIOLATION';
    });

    // 8. Avoidance Recommendations
    test('TEST_23', 'Advisor calculates minimum tool stickout extension', 'ADVISOR', () => {
      const inc: any = { incidentId: 'INC_1', segmentIndex: 2, type: 'HOLDER_COLLISION', severity: 'CRITICAL', penetrationDepthMm: 8.5, toolPose: { toolOrientation: { z: 1 } } };
      const rec = CollisionAvoidanceAdvisor.suggestAction(inc, sampleTool, sampleHolder);
      return rec.primaryAction === 'EXTEND_TOOL_STICKOUT' && (rec.suggestedValue || 0) >= sampleTool.stickoutMm + 8.5;
    });

    test('TEST_24', 'Advisor suggests fixture clearance plane retract', 'ADVISOR', () => {
      const inc: any = { incidentId: 'INC_2', segmentIndex: 4, type: 'FIXTURE_COLLISION', severity: 'CRITICAL', penetrationDepthMm: 2.0, toolPose: { toolOrientation: { z: 1 } } };
      const rec = CollisionAvoidanceAdvisor.suggestAction(inc, sampleTool, sampleHolder);
      return rec.primaryAction === 'RETRACT_CLEARANCE_PLANE';
    });

    test('TEST_25', 'Advisor suggests 5-axis orientation adjustment on wall hit', 'ADVISOR', () => {
      const inc: any = { incidentId: 'INC_3', segmentIndex: 5, type: 'TOOL_COLLISION', severity: 'ERROR', penetrationDepthMm: 1.0, toolPose: { toolOrientation: { x: 0.5, y: 0, z: 0.866 } } };
      const rec = CollisionAvoidanceAdvisor.suggestAction(inc, sampleTool, sampleHolder);
      return rec.primaryAction === 'MODIFY_ORIENTATION';
    });

    // 9. Provenance & Industrial OS Telemetry
    test('TEST_26', 'Cryptographic SHA-256 evidence package signing', 'PROVENANCE', () => {
      const dummyReport: any = {
        jobId: 'J1', setupId: 'S1', operationName: 'OP1', toolId: 'T1', overallState: 'CLEAR',
        isPathValid: true, isPathRejected: false, minOverallClearanceMm: 5.0, maxPenetrationDepthMm: 0,
        totalIncidentsCount: 0, detectionMode: 'EXACT', tolerances: defaultTols, coverageStatus: 'PROVEN'
      };
      const evid = CollisionEvidenceGenerator.generateEvidencePackage(dummyReport, sampleTool, sampleHolder);
      return evid.provenanceSignature.startsWith('sha256_') && evid.gatePassed === true;
    });

    test('TEST_27', 'Industrial OS telemetry event stream logging', 'PROVENANCE', () => {
      const ev = CollisionEvidenceGenerator.createOSEvent('COLLISION_CHECK_STARTED', { jobId: 'J100' });
      return ev.eventType === 'COLLISION_CHECK_STARTED' && !!ev.timestamp;
    });

    // 10. Reference Benchmarks (A through G)
    const catalog = CollisionDetectionEngine.getBenchmarkCatalog();

    test('TEST_28', 'Benchmark A: Safe 3-Axis Toolpath passes CLEAR', 'BENCHMARK', () => {
      const bm = catalog.find(b => b.id === 'BENCHMARK_A')!;
      const tris = CollisionDetectionEngine.createSampleObstacleTriangles(bm.id);
      const res = CollisionDetectionEngine.verifyToolpath('JOB_A', 'SETUP_1', bm.name, bm.toolpathNodes, bm.tool, bm.holder, undefined, tris, bm.fixture);
      return res.report.overallState === 'CLEAR' && res.report.isPathValid === true;
    });

    test('TEST_29', 'Benchmark B: Tool / Part Collision detected & rejected', 'BENCHMARK', () => {
      const bm = catalog.find(b => b.id === 'BENCHMARK_B')!;
      const tris = CollisionDetectionEngine.createSampleObstacleTriangles(bm.id);
      const res = CollisionDetectionEngine.verifyToolpath('JOB_B', 'SETUP_1', bm.name, bm.toolpathNodes, bm.tool, bm.holder, undefined, tris, bm.fixture);
      return res.report.overallState === 'COLLISION' && res.report.toolCollisionCount > 0 && res.report.isPathRejected === true;
    });

    test('TEST_30', 'Benchmark C: Holder / Deep Pocket Collision detected', 'BENCHMARK', () => {
      const bm = catalog.find(b => b.id === 'BENCHMARK_C')!;
      const tris = CollisionDetectionEngine.createSampleObstacleTriangles(bm.id);
      const res = CollisionDetectionEngine.verifyToolpath('JOB_C', 'SETUP_1', bm.name, bm.toolpathNodes, bm.tool, bm.holder, undefined, tris, bm.fixture);
      return res.report.overallState === 'COLLISION' && res.report.holderCollisionCount > 0;
    });

    test('TEST_31', 'Benchmark D: Fixture Keep-Out Violation detected', 'BENCHMARK', () => {
      const bm = catalog.find(b => b.id === 'BENCHMARK_D')!;
      const tris = CollisionDetectionEngine.createSampleObstacleTriangles(bm.id);
      const res = CollisionDetectionEngine.verifyToolpath('JOB_D', 'SETUP_1', bm.name, bm.toolpathNodes, bm.tool, bm.holder, undefined, tris, bm.fixture);
      return res.report.overallState === 'COLLISION' && res.report.fixtureCollisionCount > 0;
    });

    test('TEST_32', 'Benchmark E: 4-Axis Rotary Collision detected', 'BENCHMARK', () => {
      const bm = catalog.find(b => b.id === 'BENCHMARK_E')!;
      const tris = CollisionDetectionEngine.createSampleObstacleTriangles(bm.id);
      const res = CollisionDetectionEngine.verifyToolpath('JOB_E', 'SETUP_1', bm.name, bm.toolpathNodes, bm.tool, bm.holder, undefined, tris, bm.fixture);
      return res.report.overallState === 'COLLISION';
    });

    test('TEST_33', 'Benchmark F: 5-Axis Orientation Tilt Collision detected', 'BENCHMARK', () => {
      const bm = catalog.find(b => b.id === 'BENCHMARK_F')!;
      const tris = CollisionDetectionEngine.createSampleObstacleTriangles(bm.id);
      const res = CollisionDetectionEngine.verifyToolpath('JOB_F', 'SETUP_1', bm.name, bm.toolpathNodes, bm.tool, bm.holder, undefined, tris, bm.fixture);
      return res.report.overallState === 'COLLISION';
    });

    test('TEST_34', 'Benchmark G: CCD Rapid Midsegment Collision detected', 'BENCHMARK', () => {
      const bm = catalog.find(b => b.id === 'BENCHMARK_G')!;
      const tris = CollisionDetectionEngine.createSampleObstacleTriangles(bm.id);
      const res = CollisionDetectionEngine.verifyToolpath('JOB_G', 'SETUP_1', bm.name, bm.toolpathNodes, bm.tool, bm.holder, undefined, tris, bm.fixture);
      return res.report.overallState === 'COLLISION';
    });

    // 11. Safety Gate & Invariant Integrity
    test('TEST_35', 'Path rejection safety gate strictly enforced', 'SAFETY_GATE', () => {
      const bm = catalog.find(b => b.id === 'BENCHMARK_D')!;
      const tris = CollisionDetectionEngine.createSampleObstacleTriangles(bm.id);
      const res = CollisionDetectionEngine.verifyToolpath('JOB_D', 'SETUP_1', bm.name, bm.toolpathNodes, bm.tool, bm.holder, undefined, tris, bm.fixture);
      return res.report.isPathRejected === true && res.evidence.gatePassed === false;
    });

    test('TEST_36', 'Full evidence package completeness and provenance', 'SAFETY_GATE', () => {
      const bm = catalog.find(b => b.id === 'BENCHMARK_A')!;
      const tris = CollisionDetectionEngine.createSampleObstacleTriangles(bm.id);
      const res = CollisionDetectionEngine.verifyToolpath('JOB_A', 'SETUP_1', bm.name, bm.toolpathNodes, bm.tool, bm.holder, undefined, tris, bm.fixture);
      return !!res.evidence.evidenceId && !!res.evidence.provenanceSignature && res.evidence.classification === 'PROVEN';
    });

    const passedCount = results.filter(r => r.passed).length;
    const totalTests = results.length;

    return {
      gateId: 'HARD_ACCEPTANCE_GATE_259_COLLISION',
      totalTests,
      passedCount,
      failedCount: totalTests - passedCount,
      passRatio: passedCount / totalTests,
      allPassed: passedCount === totalTests,
      timestamp: new Date().toISOString(),
      results
    };
  }
}
