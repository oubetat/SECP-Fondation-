/**
 * SECP CAD Kernel — Geometric Relationships (Parallelism, Perpendicularity, Incidences)
 * Phase 2 (PATCH-018)
 */
import { Point, Vector, Direction, Plane } from '../geometry/GeometryContracts';
import { GeometricTolerance, GeometricToleranceModel } from './GeometricTolerance';
import {
  GeometricPredicateResult,
  GeneralClassification,
  Line3D,
  Ray3D,
  Segment3D,
  LineLineRelation3D,
  LinePlaneRelation,
  PlanePlaneRelation,
  PointPlaneClassification
} from './PredicateContracts';
import { VectorPredicates } from './VectorPredicates';
import { OrientationPredicates } from './OrientationPredicates';

export class GeometricRelations {
  /**
   * Evaluates the signed distance from a point to a plane: n . (P - origin) / ||n||
   */
  public static pointPlaneSignedDistance(
    pt: Point,
    plane: Plane,
    tolModel: GeometricToleranceModel = GeometricTolerance.DEFAULT
  ): GeometricPredicateResult<GeneralClassification, number> {
    if (!pt || !plane || !plane.origin || !plane.normal) {
      return {
        classification: 'INVALID',
        value: NaN,
        semantics: 'ROBUST_NUMERICAL',
        diagnostics: ['Invalid point or plane geometry']
      };
    }
    if (!GeometricTolerance.isFiniteNumber(pt.x, pt.y, pt.z, plane.origin.x, plane.origin.y, plane.origin.z, plane.normal.x, plane.normal.y, plane.normal.z)) {
      return {
        classification: 'INVALID',
        value: NaN,
        semantics: 'ROBUST_NUMERICAL',
        diagnostics: ['Coordinates or plane normals contain non-finite numbers']
      };
    }

    const normLenSq = plane.normal.x * plane.normal.x + plane.normal.y * plane.normal.y + plane.normal.z * plane.normal.z;
    if (normLenSq <= tolModel.absoluteLength * tolModel.absoluteLength) {
      return {
        classification: 'INVALID',
        value: NaN,
        semantics: 'ROBUST_NUMERICAL',
        diagnostics: ['Plane has zero-length normal vector']
      };
    }

    const normLen = Math.sqrt(normLenSq);
    const dx = pt.x - plane.origin.x;
    const dy = pt.y - plane.origin.y;
    const dz = pt.z - plane.origin.z;

    const dot = dx * plane.normal.x + dy * plane.normal.y + dz * plane.normal.z;
    const signedDist = dot / normLen;

    return {
      classification: 'TRUE',
      value: signedDist,
      semantics: 'ROBUST_NUMERICAL',
      diagnostics: [`signedDistance = ${signedDist}`]
    };
  }

  /**
   * Classifies a point relative to a plane: POSITIVE_SIDE, NEGATIVE_SIDE, ON_PLANE
   */
  public static classifyPointToPlane(
    pt: Point,
    plane: Plane,
    tolModel: GeometricToleranceModel = GeometricTolerance.DEFAULT
  ): GeometricPredicateResult<PointPlaneClassification, number> {
    const distRes = this.pointPlaneSignedDistance(pt, plane, tolModel);
    if (distRes.classification === 'INVALID') {
      return {
        classification: 'INVALID',
        value: NaN,
        semantics: 'TOLERANCE_BASED',
        diagnostics: distRes.diagnostics
      };
    }

    const dist = distRes.value!;
    const maxCoord = Math.max(Math.abs(pt.x), Math.abs(pt.y), Math.abs(pt.z), Math.abs(plane.origin.x), Math.abs(plane.origin.y), Math.abs(plane.origin.z));
    const lenTol = GeometricTolerance.getScaleAwareLengthTolerance(maxCoord, tolModel);

    if (Math.abs(dist) <= lenTol) {
      return {
        classification: 'ON_PLANE',
        value: dist,
        semantics: 'TOLERANCE_BASED',
        diagnostics: [`Point is within plane tolerance ${lenTol}`]
      };
    }

    return {
      classification: dist > 0 ? 'POSITIVE_SIDE' : 'NEGATIVE_SIDE',
      value: dist,
      semantics: 'TOLERANCE_BASED',
      diagnostics: [`signedDistance = ${dist}`]
    };
  }

  /**
   * Predicate: Point lies on a 3D line.
   */
  public static pointOnLine(
    pt: Point,
    line: Line3D,
    tolModel: GeometricToleranceModel = GeometricTolerance.DEFAULT
  ): GeometricPredicateResult<GeneralClassification, { distance: number; parameter: number }> {
    if (!pt || !line || !line.origin || !line.direction) {
      return {
        classification: 'INVALID',
        semantics: 'TOLERANCE_BASED',
        diagnostics: ['Invalid point or line geometry']
      };
    }

    const pB: Point = {
      x: line.origin.x + line.direction.x,
      y: line.origin.y + line.direction.y,
      z: line.origin.z + line.direction.z
    };

    const coll = OrientationPredicates.areCollinear(line.origin, pB, pt, tolModel);
    if (coll.classification === 'INVALID') {
      return {
        classification: 'INVALID',
        semantics: 'TOLERANCE_BASED',
        diagnostics: coll.diagnostics
      };
    }

    const dirLenSq = line.direction.x * line.direction.x + line.direction.y * line.direction.y + line.direction.z * line.direction.z;
    if (dirLenSq <= tolModel.absoluteLength * tolModel.absoluteLength) {
      return {
        classification: 'INVALID',
        semantics: 'TOLERANCE_BASED',
        diagnostics: ['Line has zero-length direction vector']
      };
    }

    const dx = pt.x - line.origin.x;
    const dy = pt.y - line.origin.y;
    const dz = pt.z - line.origin.z;

    const t = (dx * line.direction.x + dy * line.direction.y + dz * line.direction.z) / dirLenSq;
    const isCollinear = coll.classification === 'TRUE_COLLINEAR';

    return {
      classification: isCollinear ? 'TRUE' : 'FALSE',
      value: { distance: coll.value!, parameter: t },
      semantics: 'TOLERANCE_BASED',
      diagnostics: [`t = ${t}, distance = ${coll.value}`]
    };
  }

  /**
   * Predicate: Point lies on a 3D ray (parameter t >= -tol).
   */
  public static pointOnRay(
    pt: Point,
    ray: Ray3D,
    tolModel: GeometricToleranceModel = GeometricTolerance.DEFAULT
  ): GeometricPredicateResult<GeneralClassification, { distance: number; parameter: number }> {
    const lineRes = this.pointOnLine(pt, ray, tolModel);
    if (lineRes.classification !== 'TRUE') {
      return lineRes;
    }

    const t = lineRes.value!.parameter;
    const isOnRay = t >= -tolModel.parameter;
    return {
      classification: isOnRay ? 'TRUE' : 'FALSE',
      value: lineRes.value,
      semantics: 'TOLERANCE_BASED',
      diagnostics: [`t = ${t}, rayOrigin t>=0`]
    };
  }

  /**
   * Predicate: Point lies on a 3D segment (collinear and parameter t in [0, 1]).
   */
  public static pointOnSegment(
    pt: Point,
    seg: Segment3D,
    tolModel: GeometricToleranceModel = GeometricTolerance.DEFAULT
  ): GeometricPredicateResult<GeneralClassification, { distance: number; parameter: number }> {
    if (!pt || !seg || !seg.start || !seg.end) {
      return {
        classification: 'INVALID',
        semantics: 'TOLERANCE_BASED',
        diagnostics: ['Invalid segment inputs']
      };
    }

    const coll = OrientationPredicates.areCollinear(seg.start, seg.end, pt, tolModel);
    if (coll.classification === 'INVALID') {
      return {
        classification: 'INVALID',
        semantics: 'TOLERANCE_BASED',
        diagnostics: coll.diagnostics
      };
    }

    const dirX = seg.end.x - seg.start.x;
    const dirY = seg.end.y - seg.start.y;
    const dirZ = seg.end.z - seg.start.z;
    const lenSq = dirX * dirX + dirY * dirY + dirZ * dirZ;

    if (lenSq <= tolModel.absoluteLength * tolModel.absoluteLength) {
      // Degenerate segment: start == end
      const dX = pt.x - seg.start.x, dY = pt.y - seg.start.y, dZ = pt.z - seg.start.z;
      const d = Math.sqrt(dX * dX + dY * dY + dZ * dZ);
      const isCoincident = d <= tolModel.absoluteLength;
      return {
        classification: isCoincident ? 'TRUE' : 'FALSE',
        value: { distance: d, parameter: 0 },
        semantics: 'TOLERANCE_BASED',
        diagnostics: ['Degenerate segment (coincident endpoints)']
      };
    }

    const dx = pt.x - seg.start.x;
    const dy = pt.y - seg.start.y;
    const dz = pt.z - seg.start.z;

    const t = (dx * dirX + dy * dirY + dz * dirZ) / lenSq;
    const isCollinear = coll.classification === 'TRUE_COLLINEAR';
    const inBounds = t >= -tolModel.parameter && t <= 1.0 + tolModel.parameter;

    const onSeg = isCollinear && inBounds;
    return {
      classification: onSeg ? 'TRUE' : 'FALSE',
      value: { distance: coll.value!, parameter: t },
      semantics: 'TOLERANCE_BASED',
      diagnostics: [`isCollinear = ${isCollinear}, t = ${t}, inBounds = ${inBounds}`]
    };
  }

  /**
   * Evaluates relationship between two 3D lines.
   * PARALLEL, COINCIDENT, INTERSECTING, SKEW, DEGENERATE, INDETERMINATE, INVALID
   */
  public static lineLineRelation3D(
    l1: Line3D,
    l2: Line3D,
    tolModel: GeometricToleranceModel = GeometricTolerance.DEFAULT
  ): GeometricPredicateResult<LineLineRelation3D, number> {
    if (!l1 || !l2 || !l1.origin || !l1.direction || !l2.origin || !l2.direction) {
      return {
        classification: 'INVALID',
        semantics: 'TOLERANCE_BASED',
        diagnostics: ['Invalid line definitions']
      };
    }

    const par = VectorPredicates.parallel(l1.direction, l2.direction, tolModel);
    if (par.classification === 'INVALID') {
      return {
        classification: 'DEGENERATE',
        semantics: 'TOLERANCE_BASED',
        diagnostics: par.diagnostics
      };
    }

    const isParallel = par.classification === 'TRUE';

    if (isParallel) {
      // Check if l2.origin lies on l1
      const onLine = this.pointOnLine(l2.origin, l1, tolModel);
      if (onLine.classification === 'TRUE') {
        return {
          classification: 'COINCIDENT',
          semantics: 'TOLERANCE_BASED',
          diagnostics: ['Lines are coincident in 3D']
        };
      }
      return {
        classification: 'PARALLEL',
        semantics: 'TOLERANCE_BASED',
        diagnostics: ['Lines are parallel and distinct in 3D']
      };
    }

    // Lines are not parallel. Check if they are coplanar (intersecting) or skew.
    const p1 = l1.origin;
    const p2 = { x: l1.origin.x + l1.direction.x, y: l1.origin.y + l1.direction.y, z: l1.origin.z + l1.direction.z };
    const p3 = l2.origin;
    const p4 = { x: l2.origin.x + l2.direction.x, y: l2.origin.y + l2.direction.y, z: l2.origin.z + l2.direction.z };

    const coplanar = OrientationPredicates.areCoplanar(p1, p2, p3, p4, tolModel);
    if (coplanar.classification === 'COPLANAR') {
      return {
        classification: 'INTERSECTING',
        semantics: 'TOLERANCE_BASED',
        diagnostics: ['Lines are coplanar and non-parallel (intersecting in 3D)']
      };
    }

    return {
      classification: 'SKEW',
      semantics: 'TOLERANCE_BASED',
      diagnostics: ['Lines are skew in 3D']
    };
  }

  /**
   * Evaluates relationship between a Line and a Plane.
   * INTERSECTS, PARALLEL, COPLANAR, INDETERMINATE, INVALID
   */
  public static linePlaneRelation(
    line: Line3D,
    plane: Plane,
    tolModel: GeometricToleranceModel = GeometricTolerance.DEFAULT
  ): GeometricPredicateResult<LinePlaneRelation, number> {
    if (!line || !plane) {
      return {
        classification: 'INVALID',
        semantics: 'TOLERANCE_BASED',
        diagnostics: ['Invalid line or plane']
      };
    }

    const perp = VectorPredicates.perpendicular(line.direction, plane.normal, tolModel);
    if (perp.classification === 'INVALID') {
      return {
        classification: 'INVALID',
        semantics: 'TOLERANCE_BASED',
        diagnostics: perp.diagnostics
      };
    }

    const isDirPerpNormal = perp.classification === 'TRUE'; // meaning line is parallel to the plane surface

    if (isDirPerpNormal) {
      const onPlane = this.classifyPointToPlane(line.origin, plane, tolModel);
      if (onPlane.classification === 'ON_PLANE') {
        return {
          classification: 'COPLANAR',
          semantics: 'TOLERANCE_BASED',
          diagnostics: ['Line lies entirely within the plane']
        };
      }
      return {
        classification: 'PARALLEL',
        semantics: 'TOLERANCE_BASED',
        diagnostics: ['Line is parallel and distinct from plane']
      };
    }

    return {
      classification: 'INTERSECTS',
      semantics: 'TOLERANCE_BASED',
      diagnostics: ['Line intersects plane at a single point']
    };
  }

  /**
   * Evaluates relationship between two Planes.
   * COINCIDENT, PARALLEL_DISTINCT, INTERSECTING, INDETERMINATE, INVALID
   */
  public static planePlaneRelation(
    p1: Plane,
    p2: Plane,
    tolModel: GeometricToleranceModel = GeometricTolerance.DEFAULT
  ): GeometricPredicateResult<PlanePlaneRelation, number> {
    if (!p1 || !p2) {
      return {
        classification: 'INVALID',
        semantics: 'TOLERANCE_BASED',
        diagnostics: ['Invalid plane parameters']
      };
    }

    const par = VectorPredicates.parallel(p1.normal, p2.normal, tolModel);
    if (par.classification === 'INVALID') {
      return {
        classification: 'INVALID',
        semantics: 'TOLERANCE_BASED',
        diagnostics: par.diagnostics
      };
    }

    if (par.classification === 'TRUE') {
      const onPlane = this.classifyPointToPlane(p2.origin, p1, tolModel);
      if (onPlane.classification === 'ON_PLANE') {
        return {
          classification: 'COINCIDENT',
          semantics: 'TOLERANCE_BASED',
          diagnostics: ['Planes are coincident']
        };
      }
      return {
        classification: 'PARALLEL_DISTINCT',
        semantics: 'TOLERANCE_BASED',
        diagnostics: ['Planes are parallel and distinct']
      };
    }

    return {
      classification: 'INTERSECTING',
      semantics: 'TOLERANCE_BASED',
      diagnostics: ['Planes intersect along a line']
    };
  }

  /**
   * Perpendicularity: Line ⟂ Plane
   * True if line direction is parallel to plane normal.
   */
  public static linePerpendicularPlane(
    line: Line3D,
    plane: Plane,
    tolModel: GeometricToleranceModel = GeometricTolerance.DEFAULT
  ): GeometricPredicateResult<GeneralClassification, boolean> {
    const par = VectorPredicates.parallel(line.direction, plane.normal, tolModel);
    return par;
  }

  /**
   * Perpendicularity: Plane ⟂ Plane
   * True if plane normals are perpendicular.
   */
  public static planePerpendicularPlane(
    p1: Plane,
    p2: Plane,
    tolModel: GeometricToleranceModel = GeometricTolerance.DEFAULT
  ): GeometricPredicateResult<GeneralClassification, boolean> {
    return VectorPredicates.perpendicular(p1.normal, p2.normal, tolModel);
  }
}
