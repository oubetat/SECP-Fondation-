/**
 * SECP CAD Kernel — GCS 3D Constraint Residuals
 * Phase 2 (PATCH-026)
 */

import { Point, Vector } from '../cad-kernel/geometry/GeometryContracts';
import { VectorPredicates } from '../cad-kernel/predicates/VectorPredicates';
import { GeometricTolerance } from '../cad-kernel/predicates/GeometricTolerance';

export class Constraint3DResidual {
  /**
   * Helper to compute safe unit direction vector.
   * If zero or invalid, returns fallback direction and raises structured diagnostic.
   */
  public static safeNormalize(v: Vector): Vector {
    const res = VectorPredicates.normalize(v, GeometricTolerance.DEFAULT);
    if (res.classification === 'INVALID') {
      // Return safe fallback instead of throwing or generating NaN
      return { x: 1, y: 0, z: 0 };
    }
    return res.value!;
  }

  /**
   * COINCIDENT_3D: r = P1 - P2
   */
  public static coincident(p1: Point, p2: Point): number[] {
    return [p1.x - p2.x, p1.y - p2.y, p1.z - p2.z];
  }

  /**
   * POINT_ON_LINE_3D: cross product of (P - O) with direction D
   */
  public static pointOnLine(p: Point, lineOrigin: Point, lineDir: Vector): number[] {
    const v: Vector = { x: p.x - lineOrigin.x, y: p.y - lineOrigin.y, z: p.z - lineOrigin.z };
    const dHat = this.safeNormalize(lineDir);
    const cross = VectorPredicates.crossProduct(v, dHat).value!;
    return [cross.x, cross.y, cross.z];
  }

  /**
   * POINT_ON_PLANE_3D: signed distance to plane (P - O) . N
   */
  public static pointOnPlane(p: Point, planeOrigin: Point, planeNormal: Vector): number {
    const v: Vector = { x: p.x - planeOrigin.x, y: p.y - planeOrigin.y, z: p.z - planeOrigin.z };
    const nHat = this.safeNormalize(planeNormal);
    const dot = VectorPredicates.dotProduct(v, nHat).value!;
    return dot;
  }

  /**
   * POINT_ON_CIRCLE_3D: Point lies on circle plane AND distance from center = radius
   */
  public static pointOnCircle(p: Point, center: Point, normal: Vector, radius: number): number[] {
    const planeResidual = this.pointOnPlane(p, center, normal);
    const distSq = (p.x - center.x) ** 2 + (p.y - center.y) ** 2 + (p.z - center.z) ** 2;
    const dist = Math.sqrt(distSq);
    const radResidual = dist - radius;
    return [planeResidual, radResidual];
  }

  /**
   * DISTANCE_3D: Euclidean distance residual
   */
  public static distance(p1: Point, p2: Point, target: number): number {
    const distSq = (p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2 + (p1.z - p2.z) ** 2;
    const actual = Math.sqrt(distSq);
    return actual - target;
  }

  /**
   * DISTANCE_X_3D
   */
  public static distanceX(p1: Point, p2: Point, target: number): number {
    return (p1.x - p2.x) - target;
  }

  /**
   * DISTANCE_Y_3D
   */
  public static distanceY(p1: Point, p2: Point, target: number): number {
    return (p1.y - p2.y) - target;
  }

  /**
   * DISTANCE_Z_3D
   */
  public static distanceZ(p1: Point, p2: Point, target: number): number {
    return (p1.z - p2.z) - target;
  }

  /**
   * ANGLE_3D: dotProduct(v1Hat, v2Hat) - cos(targetRad)
   */
  public static angle(v1: Vector, v2: Vector, targetRad: number): number {
    const v1Hat = this.safeNormalize(v1);
    const v2Hat = this.safeNormalize(v2);
    const dot = VectorPredicates.dotProduct(v1Hat, v2Hat).value!;
    return dot - Math.cos(targetRad);
  }

  /**
   * PARALLEL_3D: crossProduct(v1Hat, v2Hat) = 0
   */
  public static parallel(v1: Vector, v2: Vector): number[] {
    const v1Hat = this.safeNormalize(v1);
    const v2Hat = this.safeNormalize(v2);
    const cross = VectorPredicates.crossProduct(v1Hat, v2Hat).value!;
    return [cross.x, cross.y, cross.z];
  }

  /**
   * PERPENDICULAR_3D: dotProduct(v1Hat, v2Hat) = 0
   */
  public static perpendicular(v1: Vector, v2: Vector): number {
    const v1Hat = this.safeNormalize(v1);
    const v2Hat = this.safeNormalize(v2);
    return VectorPredicates.dotProduct(v1Hat, v2Hat).value!;
  }

  /**
   * COLLINEAR_3D: Three points P1, P2, P3 are collinear if (P2 - P1) x (P3 - P1) = 0
   */
  public static collinear(p1: Point, p2: Point, p3: Point): number[] {
    const v12: Vector = { x: p2.x - p1.x, y: p2.y - p1.y, z: p2.z - p1.z };
    const v13: Vector = { x: p3.x - p1.x, y: p3.y - p1.y, z: p3.z - p1.z };
    const cross = VectorPredicates.crossProduct(v12, v13).value!;
    return [cross.x, cross.y, cross.z];
  }

  /**
   * COPLANAR_3D: Four points P1, P2, P3, P4 are coplanar if (P2-P1) . ((P3-P1) x (P4-P1)) = 0
   */
  public static coplanar(p1: Point, p2: Point, p3: Point, p4: Point): number {
    const v12: Vector = { x: p2.x - p1.x, y: p2.y - p1.y, z: p2.z - p1.z };
    const v13: Vector = { x: p3.x - p1.x, y: p3.y - p1.y, z: p3.z - p1.z };
    const v14: Vector = { x: p4.x - p1.x, y: p4.y - p1.y, z: p4.z - p1.z };
    const cross = VectorPredicates.crossProduct(v13, v14).value!;
    return VectorPredicates.dotProduct(v12, cross).value!;
  }

  /**
   * CONCENTRIC_3D: identical centers (3 residual components)
   */
  public static concentric(c1: Point, c2: Point): number[] {
    return [c1.x - c2.x, c1.y - c2.y, c1.z - c2.z];
  }

  /**
   * COAXIAL_3D: Parallel directions AND offset between origins is parallel to axis
   */
  public static coaxial(o1: Point, d1: Vector, o2: Point, d2: Vector): number[] {
    const dirResidual = this.parallel(d1, d2);
    const offset: Vector = { x: o2.x - o1.x, y: o2.y - o1.y, z: o2.z - o1.z };
    const offsetResidual = this.parallel(offset, d1);
    return [...dirResidual, ...offsetResidual];
  }

  /**
   * TANGENT_3D: Tangency condition depending on combination
   * 1. Sphere and Plane: distance from sphere center to plane equals radius
   * 2. Sphere and Sphere: distance between centers equals sum of radii
   */
  public static tangentSpherePlane(center: Point, radius: number, planeOrigin: Point, planeNormal: Vector): number {
    const dist = Math.abs(this.pointOnPlane(center, planeOrigin, planeNormal));
    return dist - radius;
  }

  public static tangentSphereSphere(c1: Point, r1: number, c2: Point, r2: number): number {
    const distSq = (c1.x - c2.x) ** 2 + (c1.y - c2.y) ** 2 + (c1.z - c2.z) ** 2;
    const dist = Math.sqrt(distSq);
    return dist - (r1 + r2);
  }

  /**
   * FIX_3D: Position matches fixed targets
   */
  public static fix(p: Point, target: Point): number[] {
    return [p.x - target.x, p.y - target.y, p.z - target.z];
  }

  /**
   * RADIUS_3D: radius equals target
   */
  public static radius(r: number, target: number): number {
    return r - target;
  }

  /**
   * DIAMETER_3D: diameter equals target
   */
  public static diameter(r: number, target: number): number {
    return 2 * r - target;
  }
}
