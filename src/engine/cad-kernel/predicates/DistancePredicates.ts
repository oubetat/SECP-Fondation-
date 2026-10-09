/**
 * SECP CAD Kernel — Distance Predicates
 * Phase 2 (PATCH-018)
 */
import { Point, Plane } from '../geometry/GeometryContracts';
import { GeometricTolerance, GeometricToleranceModel } from './GeometricTolerance';
import { 
  ToleranceEngine, 
  ToleranceOperation, 
  ToleranceContext 
} from '../tolerance';
import {
  GeometricPredicateResult,
  GeneralClassification,
  Line3D,
  Segment3D
} from './PredicateContracts';
import { GeometricRelations } from './GeometricRelations';

export class DistancePredicates {
  /**
   * Distance between two 3D points.
   */
  public static pointPointDistance(
    p1: Point,
    p2: Point
  ): GeometricPredicateResult<GeneralClassification, { distance: number; squaredDistance: number }> {
    if (!p1 || !p2 || !GeometricTolerance.isFiniteNumber(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z)) {
      return {
        classification: 'INVALID',
        semantics: 'ROBUST_NUMERICAL',
        diagnostics: ['Points contain non-finite coordinates']
      };
    }
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const dz = p2.z - p1.z;
    const sq = dx * dx + dy * dy + dz * dz;
    const dist = Math.sqrt(sq);

    return {
      classification: 'TRUE',
      value: { distance: dist, squaredDistance: sq },
      semantics: 'ROBUST_NUMERICAL',
      diagnostics: [`distance = ${dist}`]
    };
  }

  /**
   * Checks if two points are coincident using an explicit ToleranceContext.
   */
  public static pointsCoincident(
    p1: Point,
    p2: Point,
    context: ToleranceContext
  ): boolean {
    return ToleranceEngine.pointsCoincident(p1, p2, context);
  }

  /**
   * Perpendicular distance from point to 3D line.
   */
  public static pointLineDistance(
    pt: Point,
    line: Line3D,
    tolModel: GeometricToleranceModel = GeometricTolerance.DEFAULT
  ): GeometricPredicateResult<GeneralClassification, { distance: number; parameter: number }> {
    const onLineRes = GeometricRelations.pointOnLine(pt, line, tolModel);
    if (onLineRes.classification === 'INVALID') {
      return {
        classification: 'INVALID',
        semantics: 'TOLERANCE_BASED',
        diagnostics: onLineRes.diagnostics
      };
    }

    return {
      classification: 'TRUE',
      value: onLineRes.value,
      semantics: 'TOLERANCE_BASED',
      diagnostics: [`distance to line = ${onLineRes.value?.distance}`]
    };
  }

  /**
   * Shortest distance from point to 3D segment (clamped to [0, 1]).
   */
  public static pointSegmentDistance(
    pt: Point,
    seg: Segment3D,
    tolModel: GeometricToleranceModel = GeometricTolerance.DEFAULT
  ): GeometricPredicateResult<GeneralClassification, { distance: number; parameter: number; closestPoint: Point }> {
    if (!pt || !seg || !seg.start || !seg.end) {
      return {
        classification: 'INVALID',
        semantics: 'TOLERANCE_BASED',
        diagnostics: ['Null point or segment inputs']
      };
    }

    const vx = seg.end.x - seg.start.x;
    const vy = seg.end.y - seg.start.y;
    const vz = seg.end.z - seg.start.z;
    const lenSq = vx * vx + vy * vy + vz * vz;

    if (lenSq <= tolModel.absoluteLength * tolModel.absoluteLength) {
      // Degenerate segment
      const dRes = this.pointPointDistance(pt, seg.start);
      return {
        classification: 'TRUE',
        value: {
          distance: dRes.value!.distance,
          parameter: 0,
          closestPoint: { x: seg.start.x, y: seg.start.y, z: seg.start.z }
        },
        semantics: 'TOLERANCE_BASED',
        diagnostics: ['Degenerate segment']
      };
    }

    const dx = pt.x - seg.start.x;
    const dy = pt.y - seg.start.y;
    const dz = pt.z - seg.start.z;

    const tRaw = (dx * vx + dy * vy + dz * vz) / lenSq;
    const tClamped = Math.max(0, Math.min(1, tRaw));

    const closestX = seg.start.x + tClamped * vx;
    const closestY = seg.start.y + tClamped * vy;
    const closestZ = seg.start.z + tClamped * vz;

    const dRes = this.pointPointDistance(pt, { x: closestX, y: closestY, z: closestZ });

    return {
      classification: 'TRUE',
      value: {
        distance: dRes.value!.distance,
        parameter: tClamped,
        closestPoint: { x: closestX, y: closestY, z: closestZ }
      },
      semantics: 'TOLERANCE_BASED',
      diagnostics: [`tRaw = ${tRaw}, tClamped = ${tClamped}, distance = ${dRes.value!.distance}`]
    };
  }

  /**
   * Distance from point to plane.
   */
  public static pointPlaneDistance(
    pt: Point,
    plane: Plane,
    tolModel: GeometricToleranceModel = GeometricTolerance.DEFAULT
  ): GeometricPredicateResult<GeneralClassification, number> {
    const sDist = GeometricRelations.pointPlaneSignedDistance(pt, plane, tolModel);
    if (sDist.classification === 'INVALID') {
      return {
        classification: 'INVALID',
        value: NaN,
        semantics: 'ROBUST_NUMERICAL',
        diagnostics: sDist.diagnostics
      };
    }

    return {
      classification: 'TRUE',
      value: Math.abs(sDist.value!),
      semantics: 'ROBUST_NUMERICAL',
      diagnostics: [`distance = ${Math.abs(sDist.value!)}`]
    };
  }
}
