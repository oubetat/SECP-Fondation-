/**
 * SECP CAD Kernel — Hard Acceptance Gate 018 (Geometric Predicates)
 * Phase 2 (PATCH-018)
 * 
 * Strict deterministic evaluation with 25 independent checks.
 * Zero tolerance for synthetic passes or bypassed tests.
 */
import { Point, Vector, Plane, BoundingBox } from '../geometry/GeometryContracts';
import { NurbsCurve, NurbsSurface } from '../nurbs/NurbsContracts';
import { GeometricTolerance } from './GeometricTolerance';
import { VectorPredicates } from './VectorPredicates';
import { OrientationPredicates } from './OrientationPredicates';
import { GeometricRelations } from './GeometricRelations';
import { ContainmentPredicates } from './ContainmentPredicates';
import { IntersectionPredicates } from './IntersectionPredicates';
import { DistancePredicates } from './DistancePredicates';
import { TopologyPredicates } from './TopologyPredicates';
import { NurbsPredicates } from './NurbsPredicates';
import { PredicateSerializer } from './PredicateSerializer';

export interface Gate018CheckResult {
  readonly id: string;
  readonly name: string;
  readonly passed: boolean;
  readonly details: string;
}

export interface Gate018Report {
  readonly gate: 'HARD_ACCEPTANCE_GATE_018';
  readonly passed: boolean;
  readonly totalChecks: number;
  readonly passedChecks: number;
  readonly failedChecks: number;
  readonly checks: readonly Gate018CheckResult[];
  readonly canonicalHash: string;
}

export class HardAcceptanceGate018 {
  public static evaluateAll(): Gate018Report {
    const checks: Gate018CheckResult[] = [];

    // CHECK 01: Finite numbers & NaN handling
    {
      const invalidV: Vector = { x: NaN, y: 1.0, z: 0.0 };
      const dotRes = VectorPredicates.dotProduct(invalidV, { x: 1, y: 0, z: 0 });
      const passed = dotRes.classification === 'INVALID';
      checks.push({
        id: 'CHECK_01_FINITE_NUMBERS',
        name: 'Finite Numbers Validation & NaN Rejection',
        passed,
        details: passed ? 'Rejected non-finite vector components' : 'Failed to reject NaN'
      });
    }

    // CHECK 02: Dot and cross product precision
    {
      const v1: Vector = { x: 1, y: 2, z: 3 };
      const v2: Vector = { x: 4, y: 5, z: 6 };
      const dot = VectorPredicates.dotProduct(v1, v2).value!; // 1*4 + 2*5 + 3*6 = 32
      const cross = VectorPredicates.crossProduct(v1, v2).value!; // (-3, 6, -3)
      const passed = dot === 32 && cross.x === -3 && cross.y === 6 && cross.z === -3;
      checks.push({
        id: 'CHECK_02_DOT_CROSS_PRODUCT',
        name: 'Dot and Cross Product Exactness',
        passed,
        details: passed ? 'Dot=32, Cross=(-3,6,-3)' : `Incorrect values: dot=${dot}`
      });
    }

    // CHECK 03: Safe vector normalization
    {
      const zeroV: Vector = { x: 0, y: 0, z: 0 };
      const normZero = VectorPredicates.normalize(zeroV);
      const vUnit = VectorPredicates.normalize({ x: 3, y: 0, z: 4 });
      const passed = normZero.classification === 'INVALID' &&
                     vUnit.classification === 'TRUE' &&
                     Math.abs(vUnit.value!.x - 0.6) < 1e-12 &&
                     Math.abs(vUnit.value!.z - 0.8) < 1e-12;
      checks.push({
        id: 'CHECK_03_VECTOR_LENGTH_NORMALIZE',
        name: 'Safe Vector Normalization (Zero & Unit)',
        passed,
        details: passed ? 'Zero vector safely handled, unit vector computed' : 'Failed normalization'
      });
    }

    // CHECK 04: Vector Parallelism & Perpendicularity
    {
      const v1: Vector = { x: 2, y: 0, z: 0 };
      const v2: Vector = { x: 5, y: 0, z: 0 };
      const v3: Vector = { x: 0, y: 3, z: 0 };
      const par = VectorPredicates.parallel(v1, v2);
      const perp = VectorPredicates.perpendicular(v1, v3);
      const same = VectorPredicates.sameDirection(v1, v2);
      const passed = par.classification === 'TRUE' && perp.classification === 'TRUE' && same.classification === 'TRUE';
      checks.push({
        id: 'CHECK_04_VECTOR_PARALLEL_PERPENDICULAR',
        name: 'Vector Parallelism & Perpendicularity',
        passed,
        details: passed ? 'Parallel and perpendicular predicates verified' : 'Failed parallel/perp'
      });
    }

    // CHECK 05: 2D Orientation CCW
    {
      const o = OrientationPredicates.orientation2D({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 });
      const passed = o.classification === 'COUNTERCLOCKWISE';
      checks.push({
        id: 'CHECK_05_ORIENTATION_2D_CCW',
        name: '2D Orientation Counter-Clockwise',
        passed,
        details: passed ? 'Correctly identified CCW orientation' : `Got ${o.classification}`
      });
    }

    // CHECK 06: 2D Orientation CW
    {
      const o = OrientationPredicates.orientation2D({ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 0 });
      const passed = o.classification === 'CLOCKWISE';
      checks.push({
        id: 'CHECK_06_ORIENTATION_2D_CW',
        name: '2D Orientation Clockwise',
        passed,
        details: passed ? 'Correctly identified CW orientation' : `Got ${o.classification}`
      });
    }

    // CHECK 07: 2D Orientation Collinear
    {
      const o = OrientationPredicates.orientation2D({ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 });
      const passed = o.classification === 'COLLINEAR';
      checks.push({
        id: 'CHECK_07_ORIENTATION_2D_COLLINEAR',
        name: '2D Orientation Collinear Points',
        passed,
        details: passed ? 'Correctly identified Collinear points' : `Got ${o.classification}`
      });
    }

    // CHECK 08: 3D Orientation Positive (Right-handed tetrahedron)
    {
      const o = OrientationPredicates.orientation3D(
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
        { x: 0, y: 1, z: 0 },
        { x: 0, y: 0, z: 1 }
      );
      const passed = o.classification === 'POSITIVE';
      checks.push({
        id: 'CHECK_08_ORIENTATION_3D_POSITIVE',
        name: '3D Orientation Positive (Tetrahedral volume)',
        passed,
        details: passed ? 'Positive orientation verified' : `Got ${o.classification}`
      });
    }

    // CHECK 09: 3D Orientation Negative
    {
      const o = OrientationPredicates.orientation3D(
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 1, z: 0 },
        { x: 1, y: 0, z: 0 },
        { x: 0, y: 0, z: 1 }
      );
      const passed = o.classification === 'NEGATIVE';
      checks.push({
        id: 'CHECK_09_ORIENTATION_3D_NEGATIVE',
        name: '3D Orientation Negative',
        passed,
        details: passed ? 'Negative orientation verified' : `Got ${o.classification}`
      });
    }

    // CHECK 10: 3D Orientation Coplanar
    {
      const o = OrientationPredicates.orientation3D(
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
        { x: 0, y: 1, z: 0 },
        { x: 1, y: 1, z: 0 }
      );
      const passed = o.classification === 'COPLANAR';
      checks.push({
        id: 'CHECK_10_ORIENTATION_3D_COPLANAR',
        name: '3D Orientation Coplanar Points',
        passed,
        details: passed ? 'Coplanar orientation verified' : `Got ${o.classification}`
      });
    }

    // CHECK 11: 3D Collinearity
    {
      const c1 = OrientationPredicates.areCollinear({ x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 }, { x: 2, y: 2, z: 2 });
      const c2 = OrientationPredicates.areCollinear({ x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 }, { x: 2, y: 2, z: 3 });
      const passed = c1.classification === 'TRUE_COLLINEAR' && c2.classification === 'NOT_COLLINEAR';
      checks.push({
        id: 'CHECK_11_COLLINEARITY_3D',
        name: '3D Collinearity Verification',
        passed,
        details: passed ? 'Collinear and non-collinear 3D points classified' : 'Failed collinearity'
      });
    }

    // CHECK 12: 3D Coplanarity
    {
      const cp1 = OrientationPredicates.areCoplanar(
        { x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }, { x: 0, y: 10, z: 0 }, { x: 10, y: 10, z: 0 }
      );
      const cp2 = OrientationPredicates.areCoplanar(
        { x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }, { x: 0, y: 10, z: 0 }, { x: 10, y: 10, z: 5 }
      );
      const passed = cp1.classification === 'COPLANAR' && cp2.classification === 'NOT_COPLANAR';
      checks.push({
        id: 'CHECK_12_COPLANARITY_3D',
        name: '3D Coplanarity Verification',
        passed,
        details: passed ? 'Coplanar and non-coplanar sets classified' : 'Failed coplanarity'
      });
    }

    // CHECK 13: Point / Plane classification
    {
      const plane: Plane = {
        origin: { x: 0, y: 0, z: 0 },
        normal: { x: 0, y: 0, z: 1 },
        xDir: { x: 1, y: 0, z: 0 }
      };
      const pos = GeometricRelations.classifyPointToPlane({ x: 5, y: 5, z: 2 }, plane);
      const neg = GeometricRelations.classifyPointToPlane({ x: 5, y: 5, z: -2 }, plane);
      const on = GeometricRelations.classifyPointToPlane({ x: 5, y: 5, z: 0 }, plane);
      const passed = pos.classification === 'POSITIVE_SIDE' &&
                     neg.classification === 'NEGATIVE_SIDE' &&
                     on.classification === 'ON_PLANE';
      checks.push({
        id: 'CHECK_13_POINT_PLANE_CLASSIFICATION',
        name: 'Point-to-Plane Classification',
        passed,
        details: passed ? 'Positive, negative, on-plane classified correctly' : 'Failed plane classification'
      });
    }

    // CHECK 14: Point on Line, Ray, Segment
    {
      const seg = { start: { x: 0, y: 0, z: 0 }, end: { x: 10, y: 0, z: 0 } };
      const onSeg = GeometricRelations.pointOnSegment({ x: 5, y: 0, z: 0 }, seg);
      const offSegEnd = GeometricRelations.pointOnSegment({ x: 15, y: 0, z: 0 }, seg);
      const onRay = GeometricRelations.pointOnRay({ x: 15, y: 0, z: 0 }, { origin: seg.start, direction: { x: 1, y: 0, z: 0 } });
      const passed = onSeg.classification === 'TRUE' &&
                     offSegEnd.classification === 'FALSE' &&
                     onRay.classification === 'TRUE';
      checks.push({
        id: 'CHECK_14_POINT_ON_LINE_RAY_SEGMENT',
        name: 'Point on Line, Ray, Segment Relations',
        passed,
        details: passed ? 'Parameter bounds respected on segment/ray' : 'Failed segment/ray checks'
      });
    }

    // CHECK 15: Line / Line 3D Relations
    {
      const l1 = { origin: { x: 0, y: 0, z: 0 }, direction: { x: 1, y: 0, z: 0 } };
      const l2Par = { origin: { x: 0, y: 2, z: 0 }, direction: { x: 1, y: 0, z: 0 } };
      const l3Skew = { origin: { x: 0, y: 0, z: 1 }, direction: { x: 0, y: 1, z: 0 } };
      const relPar = GeometricRelations.lineLineRelation3D(l1, l2Par);
      const relSkew = GeometricRelations.lineLineRelation3D(l1, l3Skew);
      const passed = relPar.classification === 'PARALLEL' && relSkew.classification === 'SKEW';
      checks.push({
        id: 'CHECK_15_LINE_LINE_RELATIONS',
        name: '3D Line-Line Parallel & Skew Relations',
        passed,
        details: passed ? 'Parallel and Skew lines recognized' : 'Failed line-line relation'
      });
    }

    // CHECK 16: Plane / Plane Relations
    {
      const p1: Plane = { origin: { x: 0, y: 0, z: 0 }, normal: { x: 0, y: 0, z: 1 }, xDir: { x: 1, y: 0, z: 0 } };
      const p2: Plane = { origin: { x: 0, y: 0, z: 5 }, normal: { x: 0, y: 0, z: 1 }, xDir: { x: 1, y: 0, z: 0 } };
      const p3: Plane = { origin: { x: 0, y: 0, z: 0 }, normal: { x: 1, y: 0, z: 0 }, xDir: { x: 0, y: 1, z: 0 } };
      const rPar = GeometricRelations.planePlaneRelation(p1, p2);
      const rInt = GeometricRelations.planePlaneRelation(p1, p3);
      const passed = rPar.classification === 'PARALLEL_DISTINCT' && rInt.classification === 'INTERSECTING';
      checks.push({
        id: 'CHECK_16_PLANE_PLANE_RELATIONS',
        name: 'Plane-Plane Parallel & Intersecting Relations',
        passed,
        details: passed ? 'Parallel and Intersecting planes recognized' : 'Failed plane-plane relation'
      });
    }

    // CHECK 17: Point in 2D Triangle
    {
      const tri2D = { a: { x: 0, y: 0 }, b: { x: 10, y: 0 }, c: { x: 0, y: 10 } };
      const inside = ContainmentPredicates.pointInTriangle2D({ x: 2, y: 2 }, tri2D);
      const outside = ContainmentPredicates.pointInTriangle2D({ x: 8, y: 8 }, tri2D);
      const boundary = ContainmentPredicates.pointInTriangle2D({ x: 5, y: 0 }, tri2D);
      const passed = inside.classification === 'INSIDE' &&
                     outside.classification === 'OUTSIDE' &&
                     boundary.classification === 'BOUNDARY';
      checks.push({
        id: 'CHECK_17_POINT_IN_TRIANGLE_2D',
        name: 'Point in 2D Triangle Containment',
        passed,
        details: passed ? 'Inside, outside, boundary correctly classified' : 'Failed 2D triangle containment'
      });
    }

    // CHECK 18: Point in 3D Triangle
    {
      const tri3D = {
        a: { x: 0, y: 0, z: 0 },
        b: { x: 10, y: 0, z: 0 },
        c: { x: 0, y: 10, z: 0 }
      };
      const inside3D = ContainmentPredicates.pointInTriangle3D({ x: 2, y: 2, z: 0 }, tri3D);
      const offPlane = ContainmentPredicates.pointInTriangle3D({ x: 2, y: 2, z: 1 }, tri3D);
      const passed = inside3D.classification === 'INSIDE' && offPlane.classification === 'OUTSIDE';
      checks.push({
        id: 'CHECK_18_POINT_IN_TRIANGLE_3D',
        name: 'Point in 3D Triangle Containment',
        passed,
        details: passed ? 'Inside and off-plane correctly identified' : 'Failed 3D triangle containment'
      });
    }

    // CHECK 19: Point in AABB
    {
      const box: BoundingBox = { min: { x: 0, y: 0, z: 0 }, max: { x: 10, y: 10, z: 10 } };
      const inBox = ContainmentPredicates.classifyPointToAABB({ x: 5, y: 5, z: 5 }, box);
      const onBox = ContainmentPredicates.classifyPointToAABB({ x: 0, y: 5, z: 5 }, box);
      const outBox = ContainmentPredicates.classifyPointToAABB({ x: 15, y: 5, z: 5 }, box);
      const passed = inBox.classification === 'INSIDE' &&
                     onBox.classification === 'BOUNDARY' &&
                     outBox.classification === 'OUTSIDE';
      checks.push({
        id: 'CHECK_19_POINT_IN_AABB',
        name: 'Point in AABB Containment',
        passed,
        details: passed ? 'AABB Inside, Boundary, Outside verified' : 'Failed AABB classification'
      });
    }

    // CHECK 20: 2D Segment Intersection
    {
      const s1 = { start: { x: 0, y: 0 }, end: { x: 10, y: 10 } };
      const s2 = { start: { x: 0, y: 10 }, end: { x: 10, y: 0 } };
      const s3Disjoint = { start: { x: 20, y: 0 }, end: { x: 20, y: 10 } };
      const proper = IntersectionPredicates.segmentSegmentRelation2D(s1, s2);
      const disjoint = IntersectionPredicates.segmentSegmentRelation2D(s1, s3Disjoint);
      const passed = proper.classification === 'PROPER_INTERSECTION' && disjoint.classification === 'DISJOINT';
      checks.push({
        id: 'CHECK_20_SEGMENT_INTERSECTION_2D',
        name: '2D Segment-Segment Intersection',
        passed,
        details: passed ? 'Proper intersection and disjoint relations verified' : 'Failed 2D segment intersection'
      });
    }

    // CHECK 21: 3D Segment Intersection & Skew
    {
      const s1 = { start: { x: 0, y: 0, z: 0 }, end: { x: 10, y: 0, z: 0 } };
      const s2Skew = { start: { x: 5, y: -5, z: 2 }, end: { x: 5, y: 5, z: 2 } };
      const relSkew = IntersectionPredicates.segmentSegmentRelation3D(s1, s2Skew);
      const passed = relSkew.classification === 'SKEW';
      checks.push({
        id: 'CHECK_21_SEGMENT_INTERSECTION_3D',
        name: '3D Segment Skew Detection',
        passed,
        details: passed ? 'Skew segments recognized in 3D' : `Got ${relSkew.classification}`
      });
    }

    // CHECK 22: Distance Predicates Exactness
    {
      const p1: Point = { x: 0, y: 0, z: 0 };
      const p2: Point = { x: 3, y: 4, z: 0 };
      const dist = DistancePredicates.pointPointDistance(p1, p2).value!.distance;
      const plane: Plane = { origin: { x: 0, y: 0, z: 0 }, normal: { x: 0, y: 0, z: 1 }, xDir: { x: 1, y: 0, z: 0 } };
      const pPlaneDist = DistancePredicates.pointPlaneDistance({ x: 10, y: 10, z: 7.5 }, plane).value!;
      const passed = Math.abs(dist - 5.0) < 1e-12 && Math.abs(pPlaneDist - 7.5) < 1e-12;
      checks.push({
        id: 'CHECK_22_DISTANCES',
        name: 'Distance Predicate Exactness',
        passed,
        details: passed ? 'Euclidean & plane distances verified' : 'Distance calculation error'
      });
    }

    // CHECK 23: NURBS Predicate Integration
    {
      const curve: NurbsCurve = {
        degree: 1,
        knots: [0, 0, 1, 1],
        controlPoints: [
          { x: 0, y: 0, z: 0, w: 1 },
          { x: 10, y: 0, z: 0, w: 1 }
        ],
        evaluate: (u) => ({ x: u * 10, y: 0, z: 0 }),
        domain: () => ({ uMin: 0, uMax: 1 })
      };
      const onCurve = NurbsPredicates.pointOnNurbsCurveAtParam({ x: 5, y: 0, z: 0 }, curve, 0.5);
      const passed = onCurve.classification === 'EXACT_ON' || onCurve.classification === 'WITHIN_TOLERANCE';
      checks.push({
        id: 'CHECK_23_NURBS_INTEGRATION',
        name: 'NURBS Curve Predicate Integration',
        passed,
        details: passed ? 'Point on NURBS curve verified' : 'Failed NURBS curve predicate'
      });
    }

    // CHECK 24: Topology Planar Loop Winding
    {
      const poly = [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 }
      ];
      const areaRes = TopologyPredicates.computePlanarLoopSignedArea2D(poly);
      const passed = areaRes.classification === 'COUNTERCLOCKWISE' && Math.abs(areaRes.value! - 100) < 1e-10;
      checks.push({
        id: 'CHECK_24_TOPOLOGY_PLANAR_LOOP',
        name: 'Planar Loop Winding & Area Predicate',
        passed,
        details: passed ? 'CCW polygon with Area=100 computed' : 'Failed planar loop check'
      });
    }

    // CHECK 25: Determinism and Canonical Serialization Hash
    {
      const ptA = { x: 1, y: 2, z: 3 };
      const ptB = { x: 4, y: 5, z: 6 };
      const res = DistancePredicates.pointPointDistance(ptA, ptB);
      const hash1 = PredicateSerializer.hashPredicateExecution('pointPointDistance', { ptA, ptB }, res);
      const hash2 = PredicateSerializer.hashPredicateExecution('pointPointDistance', { ptA, ptB }, res);
      const passed = typeof hash1 === 'string' && hash1.length === 64 && hash1 === hash2;
      checks.push({
        id: 'CHECK_25_DETERMINISM_CANONICAL_HASH',
        name: 'Deterministic Canonical Serialization & Hash Lineage',
        passed,
        details: passed ? `Deterministic SHA-256: ${hash1}` : 'Hash mismatch'
      });
    }

    const passedChecks = checks.filter(c => c.passed).length;
    const failedChecks = checks.length - passedChecks;
    const allPassed = failedChecks === 0;

    const reportData = {
      gate: 'HARD_ACCEPTANCE_GATE_018' as const,
      passed: allPassed,
      totalChecks: checks.length,
      passedChecks,
      failedChecks,
      checks
    };

    const canonicalHash = PredicateSerializer.hashPredicateExecution(
      'HardAcceptanceGate018',
      {},
      {
        classification: allPassed ? 'TRUE' : 'FALSE',
        value: reportData,
        semantics: 'ROBUST_NUMERICAL',
        diagnostics: []
      }
    );

    return Object.freeze({
      ...reportData,
      canonicalHash
    });
  }
}
