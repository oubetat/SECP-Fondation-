/**
 * SECP CAD Kernel — Intersection Predicates (Segments 2D/3D)
 * Phase 2 (PATCH-018)
 */
import { Point } from '../geometry/GeometryContracts';
import { GeometricTolerance, GeometricToleranceModel } from './GeometricTolerance';
import {
  GeometricPredicateResult,
  Segment2D,
  Segment3D,
  SegmentRelation2D,
  SegmentRelation3D
} from './PredicateContracts';
import { OrientationPredicates } from './OrientationPredicates';
import { GeometricRelations } from './GeometricRelations';

export class IntersectionPredicates {
  /**
   * 2D Segment-Segment Relationship Predicate
   * Classifications: DISJOINT, PROPER_INTERSECTION, TOUCHING, OVERLAPPING, COLLINEAR_DISJOINT, INDETERMINATE, INVALID
   */
  public static segmentSegmentRelation2D(
    s1: Segment2D,
    s2: Segment2D,
    tolModel: GeometricToleranceModel = GeometricTolerance.DEFAULT
  ): GeometricPredicateResult<SegmentRelation2D, { intersectionPoint?: { x: number; y: number } }> {
    if (!s1 || !s2 || !s1.start || !s1.end || !s2.start || !s2.end) {
      return {
        classification: 'INVALID',
        semantics: 'ROBUST_NUMERICAL',
        diagnostics: ['Null segment inputs']
      };
    }
    if (!GeometricTolerance.isFiniteNumber(s1.start.x, s1.start.y, s1.end.x, s1.end.y, s2.start.x, s2.start.y, s2.end.x, s2.end.y)) {
      return {
        classification: 'INVALID',
        semantics: 'ROBUST_NUMERICAL',
        diagnostics: ['Non-finite segment coordinates']
      };
    }

    const p1 = s1.start, q1 = s1.end;
    const p2 = s2.start, q2 = s2.end;

    // 4 Orientations
    const o1 = OrientationPredicates.orientation2D(p1, q1, p2, tolModel);
    const o2 = OrientationPredicates.orientation2D(p1, q1, q2, tolModel);
    const o3 = OrientationPredicates.orientation2D(p2, q2, p1, tolModel);
    const o4 = OrientationPredicates.orientation2D(p2, q2, q1, tolModel);

    if (o1.classification === 'INVALID' || o2.classification === 'INVALID' ||
        o3.classification === 'INVALID' || o4.classification === 'INVALID') {
      return {
        classification: 'INVALID',
        semantics: 'ROBUST_NUMERICAL',
        diagnostics: ['Orientation evaluation failed']
      };
    }

    // General case: strict straddling
    const straddle1 = (o1.classification === 'COUNTERCLOCKWISE' && o2.classification === 'CLOCKWISE') ||
                      (o1.classification === 'CLOCKWISE' && o2.classification === 'COUNTERCLOCKWISE');
    const straddle2 = (o3.classification === 'COUNTERCLOCKWISE' && o4.classification === 'CLOCKWISE') ||
                      (o3.classification === 'CLOCKWISE' && o4.classification === 'COUNTERCLOCKWISE');

    if (straddle1 && straddle2) {
      // Compute exact intersection point
      const a1 = q1.y - p1.y, b1 = p1.x - q1.x, c1 = a1 * p1.x + b1 * p1.y;
      const a2 = q2.y - p2.y, b2 = p2.x - q2.x, c2 = a2 * p2.x + b2 * p2.y;
      const det = a1 * b2 - a2 * b1;
      const ix = (b2 * c1 - b1 * c2) / det;
      const iy = (a1 * c2 - a2 * c1) / det;

      return {
        classification: 'PROPER_INTERSECTION',
        value: { intersectionPoint: { x: ix, y: iy } },
        semantics: 'ROBUST_NUMERICAL',
        diagnostics: ['Segments properly intersect at interior points']
      };
    }

    // Special cases: Collinear or Touching endpoints
    const isCollinear1 = o1.classification === 'COLLINEAR' && o2.classification === 'COLLINEAR';
    const isCollinear2 = o3.classification === 'COLLINEAR' && o4.classification === 'COLLINEAR';

    if (isCollinear1 && isCollinear2) {
      // All 4 points are collinear. Project onto 1D to determine overlap/touch/disjoint.
      const dx = Math.abs(q1.x - p1.x);
      const dy = Math.abs(q1.y - p1.y);

      let t_p1 = 0, t_q1 = 0, t_p2 = 0, t_q2 = 0;
      if (dx >= dy) {
        t_p1 = p1.x; t_q1 = q1.x;
        t_p2 = p2.x; t_q2 = q2.x;
      } else {
        t_p1 = p1.y; t_q1 = q1.y;
        t_p2 = p2.y; t_q2 = q2.y;
      }

      const min1 = Math.min(t_p1, t_q1), max1 = Math.max(t_p1, t_q1);
      const min2 = Math.min(t_p2, t_q2), max2 = Math.max(t_p2, t_q2);

      const overlapMin = Math.max(min1, min2);
      const overlapMax = Math.min(max1, max2);
      const tol = tolModel.absoluteLength;

      if (overlapMin > overlapMax + tol) {
        return {
          classification: 'COLLINEAR_DISJOINT',
          semantics: 'ROBUST_NUMERICAL',
          diagnostics: ['Collinear segments are disjoint']
        };
      }

      if (Math.abs(overlapMin - overlapMax) <= tol) {
        return {
          classification: 'TOUCHING',
          semantics: 'ROBUST_NUMERICAL',
          diagnostics: ['Collinear segments touch at a single endpoint']
        };
      }

      return {
        classification: 'OVERLAPPING',
        semantics: 'ROBUST_NUMERICAL',
        diagnostics: ['Collinear segments have non-zero interval overlap']
      };
    }

    // Touching cases (endpoint of one segment lies on the other)
    const touch1 = o1.classification === 'COLLINEAR' && this.onSegment1D(p1, q1, p2, tolModel);
    const touch2 = o2.classification === 'COLLINEAR' && this.onSegment1D(p1, q1, q2, tolModel);
    const touch3 = o3.classification === 'COLLINEAR' && this.onSegment1D(p2, q2, p1, tolModel);
    const touch4 = o4.classification === 'COLLINEAR' && this.onSegment1D(p2, q2, q1, tolModel);

    if (touch1 || touch2 || touch3 || touch4) {
      return {
        classification: 'TOUCHING',
        semantics: 'ROBUST_NUMERICAL',
        diagnostics: ['Segments touch at an endpoint']
      };
    }

    return {
      classification: 'DISJOINT',
      semantics: 'ROBUST_NUMERICAL',
      diagnostics: ['Segments do not intersect']
    };
  }

  /**
   * Helper: check if point P lies on bounding box of segment [A, B] in 2D
   */
  private static onSegment1D(
    a: { x: number; y: number },
    b: { x: number; y: number },
    p: { x: number; y: number },
    tolModel: GeometricToleranceModel
  ): boolean {
    const tol = tolModel.absoluteLength;
    return (
      p.x <= Math.max(a.x, b.x) + tol &&
      p.x >= Math.min(a.x, b.x) - tol &&
      p.y <= Math.max(a.y, b.y) + tol &&
      p.y >= Math.min(a.y, b.y) - tol
    );
  }

  /**
   * 3D Segment-Segment Relationship Predicate
   * Classifications: DISJOINT, INTERSECTING, COLLINEAR_OVERLAP, SKEW, INDETERMINATE, INVALID
   */
  public static segmentSegmentRelation3D(
    s1: Segment3D,
    s2: Segment3D,
    tolModel: GeometricToleranceModel = GeometricTolerance.DEFAULT
  ): GeometricPredicateResult<SegmentRelation3D, { distance?: number; intersectionPoint?: Point }> {
    if (!s1 || !s2 || !s1.start || !s1.end || !s2.start || !s2.end) {
      return {
        classification: 'INVALID',
        semantics: 'TOLERANCE_BASED',
        diagnostics: ['Null segment 3D inputs']
      };
    }

    // Check coplanarity of 4 endpoints
    const coplanarRes = OrientationPredicates.areCoplanar(s1.start, s1.end, s2.start, s2.end, tolModel);
    if (coplanarRes.classification === 'INVALID') {
      return {
        classification: 'INVALID',
        semantics: 'TOLERANCE_BASED',
        diagnostics: coplanarRes.diagnostics
      };
    }

    if (coplanarRes.classification === 'NOT_COPLANAR') {
      return {
        classification: 'SKEW',
        semantics: 'TOLERANCE_BASED',
        diagnostics: ['Segments are non-coplanar (skew in 3D)']
      };
    }

    // Segments are coplanar. Project onto dominant plane and evaluate 2D relation.
    const ab = { x: s1.end.x - s1.start.x, y: s1.end.y - s1.start.y, z: s1.end.z - s1.start.z };
    const ac = { x: s2.start.x - s1.start.x, y: s2.start.y - s1.start.y, z: s2.start.z - s1.start.z };
    const normal = {
      x: ab.y * ac.z - ab.z * ac.y,
      y: ab.z * ac.x - ab.x * ac.z,
      z: ab.x * ac.y - ab.y * ac.x
    };

    const nx = Math.abs(normal.x), ny = Math.abs(normal.y), nz = Math.abs(normal.z);
    let s1_2D: Segment2D;
    let s2_2D: Segment2D;

    if (nz >= nx && nz >= ny) {
      s1_2D = { start: { x: s1.start.x, y: s1.start.y }, end: { x: s1.end.x, y: s1.end.y } };
      s2_2D = { start: { x: s2.start.x, y: s2.start.y }, end: { x: s2.end.x, y: s2.end.y } };
    } else if (ny >= nx && ny >= nz) {
      s1_2D = { start: { x: s1.start.x, y: s1.start.z }, end: { x: s1.end.x, y: s1.end.z } };
      s2_2D = { start: { x: s2.start.x, y: s2.start.z }, end: { x: s2.end.x, y: s2.end.z } };
    } else {
      s1_2D = { start: { x: s1.start.y, y: s1.start.z }, end: { x: s1.end.y, y: s1.end.z } };
      s2_2D = { start: { x: s2.start.y, y: s2.start.z }, end: { x: s2.end.y, y: s2.end.z } };
    }

    const rel2D = this.segmentSegmentRelation2D(s1_2D, s2_2D, tolModel);

    if (rel2D.classification === 'PROPER_INTERSECTION' || rel2D.classification === 'TOUCHING') {
      return {
        classification: 'INTERSECTING',
        semantics: 'TOLERANCE_BASED',
        diagnostics: rel2D.diagnostics
      };
    }

    if (rel2D.classification === 'OVERLAPPING') {
      return {
        classification: 'COLLINEAR_OVERLAP',
        semantics: 'TOLERANCE_BASED',
        diagnostics: rel2D.diagnostics
      };
    }

    return {
      classification: 'DISJOINT',
      semantics: 'TOLERANCE_BASED',
      diagnostics: ['Coplanar 3D segments do not intersect']
    };
  }
}
