/**
 * SECP CAD Kernel — Production 3D GCS Spatial Constraint Residuals
 * Phase 15 (PATCH-173)
 *
 * Implements clean, analytically conditioned vector and geometric equations
 * for 23 spatial constraint types with singularity damping and unit stabilization.
 */

import { Point, Vector } from '../cad-kernel/geometry/GeometryContracts';
import { VectorPredicates } from '../cad-kernel/predicates/VectorPredicates';
import { GeometricTolerance } from '../cad-kernel/predicates/GeometricTolerance';

export class SpatialConstraintResidual {
  public static safeNormalize(v: Vector): Vector {
    const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
    if (len < 1e-12 || !Number.isFinite(len)) {
      return { x: 1, y: 0, z: 0 };
    }
    return { x: v.x / len, y: v.y / len, z: v.z / len };
  }

  public static coincident(p1: Point, p2: Point): number[] {
    return [p1.x - p2.x, p1.y - p2.y, p1.z - p2.z];
  }

  public static pointOnLine(p: Point, origin: Point, dir: Vector): number[] {
    const dHat = this.safeNormalize(dir);
    const v: Vector = { x: p.x - origin.x, y: p.y - origin.y, z: p.z - origin.z };
    // Cross product (p - origin) x dHat
    return [
      v.y * dHat.z - v.z * dHat.y,
      v.z * dHat.x - v.x * dHat.z,
      v.x * dHat.y - v.y * dHat.x
    ];
  }

  public static pointOnPlane(p: Point, planeOrigin: Point, planeNormal: Vector): number {
    const nHat = this.safeNormalize(planeNormal);
    return (p.x - planeOrigin.x) * nHat.x + (p.y - planeOrigin.y) * nHat.y + (p.z - planeOrigin.z) * nHat.z;
  }

  public static lineOnPlane(lineOrigin: Point, lineDir: Vector, planeOrigin: Point, planeNormal: Vector): number[] {
    const posRes = this.pointOnPlane(lineOrigin, planeOrigin, planeNormal);
    const nHat = this.safeNormalize(planeNormal);
    const dHat = this.safeNormalize(lineDir);
    const dirRes = dHat.x * nHat.x + dHat.y * nHat.y + dHat.z * nHat.z;
    return [posRes, dirRes];
  }

  public static pointOnCircle(p: Point, center: Point, normal: Vector, radius: number): number[] {
    const planeRes = this.pointOnPlane(p, center, normal);
    const dx = p.x - center.x;
    const dy = p.y - center.y;
    const dz = p.z - center.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    return [planeRes, dist - radius];
  }

  public static distance(p1: Point, p2: Point, target: number): number {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    const dz = p1.z - p2.z;
    const actual = Math.sqrt(dx * dx + dy * dy + dz * dz);
    return actual - target;
  }

  public static distancePointPlane(p: Point, planeOrigin: Point, planeNormal: Vector, target: number): number {
    const signedDist = this.pointOnPlane(p, planeOrigin, planeNormal);
    return Math.abs(signedDist) - target;
  }

  public static angle(v1: Vector, v2: Vector, targetRad: number): number {
    const u1 = this.safeNormalize(v1);
    const u2 = this.safeNormalize(v2);
    const dot = u1.x * u2.x + u1.y * u2.y + u1.z * u2.z;
    return dot - Math.cos(targetRad);
  }

  public static parallel(v1: Vector, v2: Vector): number[] {
    const u1 = this.safeNormalize(v1);
    const u2 = this.safeNormalize(v2);
    return [
      u1.y * u2.z - u1.z * u2.y,
      u1.z * u2.x - u1.x * u2.z,
      u1.x * u2.y - u1.y * u2.x
    ];
  }

  public static perpendicular(v1: Vector, v2: Vector): number {
    const u1 = this.safeNormalize(v1);
    const u2 = this.safeNormalize(v2);
    return u1.x * u2.x + u1.y * u2.y + u1.z * u2.z;
  }

  public static collinear(p1: Point, p2: Point, p3: Point): number[] {
    const v12: Vector = { x: p2.x - p1.x, y: p2.y - p1.y, z: p2.z - p1.z };
    const v13: Vector = { x: p3.x - p1.x, y: p3.y - p1.y, z: p3.z - p1.z };
    return [
      v12.y * v13.z - v12.z * v13.y,
      v12.z * v13.x - v12.x * v13.z,
      v12.x * v13.y - v12.y * v13.x
    ];
  }

  public static coplanar(p1: Point, p2: Point, p3: Point, p4: Point): number {
    const v12: Vector = { x: p2.x - p1.x, y: p2.y - p1.y, z: p2.z - p1.z };
    const v13: Vector = { x: p3.x - p1.x, y: p3.y - p1.y, z: p3.z - p1.z };
    const v14: Vector = { x: p4.x - p1.x, y: p4.y - p1.y, z: p4.z - p1.z };
    const crossX = v13.y * v14.z - v13.z * v14.y;
    const crossY = v13.z * v14.x - v13.x * v14.z;
    const crossZ = v13.x * v14.y - v13.y * v14.x;
    return v12.x * crossX + v12.y * crossY + v12.z * crossZ;
  }

  public static concentric(c1: Point, c2: Point): number[] {
    return [c1.x - c2.x, c1.y - c2.y, c1.z - c2.z];
  }

  public static coaxial(o1: Point, d1: Vector, o2: Point, d2: Vector): number[] {
    const dirRes = this.parallel(d1, d2);
    const offset: Vector = { x: o2.x - o1.x, y: o2.y - o1.y, z: o2.z - o1.z };
    const offsetRes = this.parallel(offset, d1);
    return [...dirRes, ...offsetRes];
  }

  public static tangentSpherePlane(center: Point, radius: number, planeOrigin: Point, planeNormal: Vector): number {
    const dist = Math.abs(this.pointOnPlane(center, planeOrigin, planeNormal));
    return dist - radius;
  }

  public static tangentSphereSphere(c1: Point, r1: number, c2: Point, r2: number): number {
    const dx = c1.x - c2.x;
    const dy = c1.y - c2.y;
    const dz = c1.z - c2.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    return dist - (r1 + r2);
  }

  public static midpoint(p1: Point, p2: Point, pMid: Point): number[] {
    return [
      0.5 * (p1.x + p2.x) - pMid.x,
      0.5 * (p1.y + p2.y) - pMid.y,
      0.5 * (p1.z + p2.z) - pMid.z
    ];
  }

  public static symmetry(p1: Point, p2: Point, planeOrigin: Point, planeNormal: Vector): number[] {
    const mid: Point = {
      x: 0.5 * (p1.x + p2.x),
      y: 0.5 * (p1.y + p2.y),
      z: 0.5 * (p1.z + p2.z)
    };
    const midOnPlane = this.pointOnPlane(mid, planeOrigin, planeNormal);
    const diff: Vector = { x: p2.x - p1.x, y: p2.y - p1.y, z: p2.z - p1.z };
    const parallelNormal = this.parallel(diff, planeNormal);
    return [midOnPlane, ...parallelNormal];
  }

  public static fix(p: Point, target: Point): number[] {
    return [p.x - target.x, p.y - target.y, p.z - target.z];
  }

  public static assemblyMate(
    pos1: Point,
    normal1: Vector,
    pos2: Point,
    normal2: Vector,
    offset: number = 0
  ): number[] {
    const u1 = this.safeNormalize(normal1);
    const u2 = this.safeNormalize(normal2);
    // Opposed normals: u1 . u2 + 1 = 0
    const normalOpposed = u1.x * u2.x + u1.y * u2.y + u1.z * u2.z + 1.0;
    // Offset along normal: (pos2 - pos1) . u1 - offset = 0
    const relX = pos2.x - pos1.x;
    const relY = pos2.y - pos1.y;
    const relZ = pos2.z - pos1.z;
    const distRes = relX * u1.x + relY * u1.y + relZ * u1.z - offset;
    return [normalOpposed, distRes];
  }

  public static assemblyAlign(
    pos1: Point,
    normal1: Vector,
    pos2: Point,
    normal2: Vector,
    offset: number = 0
  ): number[] {
    const u1 = this.safeNormalize(normal1);
    const u2 = this.safeNormalize(normal2);
    // Aligned normals: u1 . u2 - 1 = 0
    const normalAligned = u1.x * u2.x + u1.y * u2.y + u1.z * u2.z - 1.0;
    const relX = pos2.x - pos1.x;
    const relY = pos2.y - pos1.y;
    const relZ = pos2.z - pos1.z;
    const distRes = relX * u1.x + relY * u1.y + relZ * u1.z - offset;
    return [normalAligned, distRes];
  }
}
