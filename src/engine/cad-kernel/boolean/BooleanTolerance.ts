/**
 * SECP CAD Kernel — Boolean Tolerance Policy
 * Phase 2 (PATCH-019)
 * 
 * Enforces strict routing of all Boolean distance, angle, and parametric checks
 * through the centralized GeometricTolerance infrastructure.
 */
import { GeometricTolerance, GeometricToleranceModel } from '../predicates/GeometricTolerance';
import { Point, Direction, Surface } from '../geometry/GeometryContracts';
import { VectorPredicates } from '../predicates/VectorPredicates';
import { DistancePredicates } from '../predicates/DistancePredicates';

export class BooleanTolerance {
  /**
   * Resolves the active tolerance configuration.
   */
  public static resolve(model?: GeometricToleranceModel): GeometricToleranceModel {
    return model || GeometricTolerance.DEFAULT;
  }

  /**
   * Checks if two points are equal within the scale-aware length tolerance.
   */
  public static arePointsCoincident(
    p1: Point, 
    p2: Point, 
    model: GeometricToleranceModel = GeometricTolerance.DEFAULT
  ): boolean {
    const scale = Math.max(
      Math.abs(p1.x), Math.abs(p1.y), Math.abs(p1.z),
      Math.abs(p2.x), Math.abs(p2.y), Math.abs(p2.z)
    );
    const tol = GeometricTolerance.getScaleAwareLengthTolerance(scale, model);
    const distRes = DistancePredicates.pointPointDistance(p1, p2);
    if (distRes.classification === 'INVALID' || distRes.value === null) {
      return false;
    }
    return distRes.value.distance <= tol;
  }

  /**
   * Checks if an edge between two points is degenerate (zero length).
   */
  public static isZeroLengthEdge(
    start: Point,
    end: Point,
    model: GeometricToleranceModel = GeometricTolerance.DEFAULT
  ): boolean {
    return this.arePointsCoincident(start, end, model);
  }

  /**
   * Checks if two directions are parallel within angular tolerance.
   */
  public static areDirectionsParallel(
    d1: Direction,
    d2: Direction,
    model: GeometricToleranceModel = GeometricTolerance.DEFAULT
  ): boolean {
    const parRes = VectorPredicates.parallel(d1, d2, model);
    return parRes.classification === 'TRUE';
  }

  /**
   * Checks if a point lies on a surface within scale-aware tolerance.
   */
  public static isPointOnSurface(
    pt: Point,
    surfacePoint: Point,
    normal: Direction,
    model: GeometricToleranceModel = GeometricTolerance.DEFAULT
  ): boolean {
    const pPlaneDistRes = DistancePredicates.pointPlaneDistance(pt, { origin: surfacePoint, normal, xDir: { x: 1, y: 0, z: 0 } });
    if (pPlaneDistRes.classification === 'INVALID' || pPlaneDistRes.value === null) {
      return false;
    }
    const scale = Math.max(Math.abs(pt.x), Math.abs(pt.y), Math.abs(pt.z));
    const tol = GeometricTolerance.getScaleAwareLengthTolerance(scale, model);
    return pPlaneDistRes.value <= tol;
  }
}
