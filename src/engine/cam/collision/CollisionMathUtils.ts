/**
 * SECP Industrial OS v3 — Real CAM Kernel
 * PATCH-259 — Exact Collision Math & Geometrical Utilities
 */

import { Vector3D } from '../../cadKernel';
import { AABB3D, Triangle3D } from './CollisionTypes';

export class CollisionMathUtils {
  public static add(a: Vector3D, b: Vector3D): Vector3D {
    return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
  }

  public static subtract(a: Vector3D, b: Vector3D): Vector3D {
    return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
  }

  public static scale(v: Vector3D, s: number): Vector3D {
    return { x: v.x * s, y: v.y * s, z: v.z * s };
  }

  public static dot(a: Vector3D, b: Vector3D): number {
    return a.x * b.x + a.y * b.y + a.z * b.z;
  }

  public static cross(a: Vector3D, b: Vector3D): Vector3D {
    return {
      x: a.y * b.z - a.z * b.y,
      y: a.z * b.x - a.x * b.z,
      z: a.x * b.y - a.y * b.x
    };
  }

  public static length(v: Vector3D): number {
    return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  }

  public static distance(a: Vector3D, b: Vector3D): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = a.z - b.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  public static normalize(v: Vector3D): Vector3D {
    const len = this.length(v);
    if (len < 1e-12) return { x: 0, y: 0, z: 1 };
    return { x: v.x / len, y: v.y / len, z: v.z / len };
  }

  public static lerp(a: Vector3D, b: Vector3D, t: number): Vector3D {
    return {
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
      z: a.z + (b.z - a.z) * t
    };
  }

  public static createAABB(pts: Vector3D[]): AABB3D {
    if (pts.length === 0) {
      return { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } };
    }
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    for (const p of pts) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
      if (p.z < minZ) minZ = p.z;
      if (p.z > maxZ) maxZ = p.z;
    }
    return {
      min: { x: minX, y: minY, z: minZ },
      max: { x: maxX, y: maxY, z: maxZ }
    };
  }

  public static intersectAABB(a: AABB3D, b: AABB3D): boolean {
    return (
      a.min.x <= b.max.x &&
      a.max.x >= b.min.x &&
      a.min.y <= b.max.y &&
      a.max.y >= b.min.y &&
      a.min.z <= b.max.z &&
      a.max.z >= b.min.z
    );
  }

  public static distanceAABBToAABB(a: AABB3D, b: AABB3D): number {
    const dx = Math.max(0, Math.max(a.min.x - b.max.x, b.min.x - a.max.x));
    const dy = Math.max(0, Math.max(a.min.y - b.max.y, b.min.y - a.max.y));
    const dz = Math.max(0, Math.max(a.min.z - b.max.z, b.min.z - a.max.z));
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  public static expandAABB(aabb: AABB3D, margin: number): AABB3D {
    return {
      min: { x: aabb.min.x - margin, y: aabb.min.y - margin, z: aabb.min.z - margin },
      max: { x: aabb.max.x + margin, y: aabb.max.y + margin, z: aabb.max.z + margin }
    };
  }

  public static closestPointOnSegment(p: Vector3D, a: Vector3D, b: Vector3D): { point: Vector3D; t: number; distance: number } {
    const ab = this.subtract(b, a);
    const abLenSq = this.dot(ab, ab);
    if (abLenSq < 1e-12) {
      return { point: a, t: 0, distance: this.distance(p, a) };
    }
    const ap = this.subtract(p, a);
    let t = this.dot(ap, ab) / abLenSq;
    t = Math.max(0, Math.min(1, t));
    const point = this.add(a, this.scale(ab, t));
    return { point, t, distance: this.distance(p, point) };
  }

  public static closestPointsBetweenSegments(
    p1: Vector3D, q1: Vector3D,
    p2: Vector3D, q2: Vector3D
  ): { point1: Vector3D; point2: Vector3D; distance: number } {
    const d1 = this.subtract(q1, p1);
    const d2 = this.subtract(q2, p2);
    const r = this.subtract(p1, p2);

    const a = this.dot(d1, d1);
    const e = this.dot(d2, d2);
    const f = this.dot(d2, r);

    let s = 0;
    let t = 0;

    if (a <= 1e-12 && e <= 1e-12) {
      return { point1: p1, point2: p2, distance: this.distance(p1, p2) };
    }

    if (a <= 1e-12) {
      s = 0;
      t = Math.max(0, Math.min(1, f / e));
    } else {
      const c = this.dot(d1, r);
      if (e <= 1e-12) {
        t = 0;
        s = Math.max(0, Math.min(1, -c / a));
      } else {
        const b = this.dot(d1, d2);
        const denom = a * e - b * b;
        if (denom !== 0) {
          s = Math.max(0, Math.min(1, (b * f - c * e) / denom));
        } else {
          s = 0;
        }
        t = (b * s + f) / e;
        if (t < 0) {
          t = 0;
          s = Math.max(0, Math.min(1, -c / a));
        } else if (t > 1) {
          t = 1;
          s = Math.max(0, Math.min(1, (b - c) / a));
        }
      }
    }

    const c1 = this.add(p1, this.scale(d1, s));
    const c2 = this.add(p2, this.scale(d2, t));
    return { point1: c1, point2: c2, distance: this.distance(c1, c2) };
  }

  public static capsuleIntersectsAABB(
    p0: Vector3D, p1: Vector3D, radius: number, aabb: AABB3D
  ): { intersects: boolean; clearanceMm: number; penetrationDepthMm: number; closestPtSegment: Vector3D } {
    const samples = 10;
    let minDist = Infinity;
    let bestPt = p0;

    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const pt = this.lerp(p0, p1, t);
      // Distance from point to AABB
      const cx = Math.max(aabb.min.x, Math.min(pt.x, aabb.max.x));
      const cy = Math.max(aabb.min.y, Math.min(pt.y, aabb.max.y));
      const cz = Math.max(aabb.min.z, Math.min(pt.z, aabb.max.z));
      const dist = this.distance(pt, { x: cx, y: cy, z: cz });

      if (dist < minDist) {
        minDist = dist;
        bestPt = pt;
      }
    }

    const clearance = minDist - radius;
    const intersects = clearance <= 0;
    return {
      intersects,
      clearanceMm: Math.max(0, clearance),
      penetrationDepthMm: intersects ? Math.abs(clearance) : 0,
      closestPtSegment: bestPt
    };
  }

  public static capsuleIntersectsCapsule(
    p1: Vector3D, q1: Vector3D, r1: number,
    p2: Vector3D, q2: Vector3D, r2: number
  ): { intersects: boolean; clearanceMm: number; penetrationDepthMm: number } {
    const res = this.closestPointsBetweenSegments(p1, q1, p2, q2);
    const sumRadius = r1 + r2;
    const clearance = res.distance - sumRadius;
    const intersects = clearance <= 0;
    return {
      intersects,
      clearanceMm: Math.max(0, clearance),
      penetrationDepthMm: intersects ? Math.abs(clearance) : 0
    };
  }

  public static rayTriangleIntersection(
    rayOrigin: Vector3D,
    rayDir: Vector3D,
    tri: Triangle3D
  ): { hit: boolean; t: number; point: Vector3D; u: number; v: number } {
    const EPSILON = 1e-7;
    const edge1 = this.subtract(tri.v1, tri.v0);
    const edge2 = this.subtract(tri.v2, tri.v0);
    const h = this.cross(rayDir, edge2);
    const a = this.dot(edge1, h);

    if (a > -EPSILON && a < EPSILON) {
      return { hit: false, t: 0, point: rayOrigin, u: 0, v: 0 };
    }

    const f = 1.0 / a;
    const s = this.subtract(rayOrigin, tri.v0);
    const u = f * this.dot(s, h);

    if (u < 0.0 || u > 1.0) {
      return { hit: false, t: 0, point: rayOrigin, u, v: 0 };
    }

    const q = this.cross(s, edge1);
    const v = f * this.dot(rayDir, q);

    if (v < 0.0 || u + v > 1.0) {
      return { hit: false, t: 0, point: rayOrigin, u, v };
    }

    const t = f * this.dot(edge2, q);
    if (t > EPSILON) {
      const point = this.add(rayOrigin, this.scale(rayDir, t));
      return { hit: true, t, point, u, v };
    }

    return { hit: false, t: 0, point: rayOrigin, u, v };
  }

  public static closestPointOnTriangle(
    p: Vector3D,
    tri: Triangle3D
  ): { point: Vector3D; distance: number } {
    const a = tri.v0;
    const b = tri.v1;
    const c = tri.v2;

    const ab = this.subtract(b, a);
    const ac = this.subtract(c, a);
    const ap = this.subtract(p, a);

    const d1 = this.dot(ab, ap);
    const d2 = this.dot(ac, ap);
    if (d1 <= 0 && d2 <= 0) return { point: a, distance: this.distance(p, a) };

    const bp = this.subtract(p, b);
    const d3 = this.dot(ab, bp);
    const d4 = this.dot(ac, bp);
    if (d3 >= 0 && d4 <= d3) return { point: b, distance: this.distance(p, b) };

    const vc = d1 * d4 - d3 * d2;
    if (vc <= 0 && d1 >= 0 && d3 <= 0) {
      const v = d1 / (d1 - d3);
      const pt = this.add(a, this.scale(ab, v));
      return { point: pt, distance: this.distance(p, pt) };
    }

    const cp = this.subtract(p, c);
    const d5 = this.dot(ab, cp);
    const d6 = this.dot(ac, cp);
    if (d6 >= 0 && d5 <= d6) return { point: c, distance: this.distance(p, c) };

    const vb = d5 * d2 - d1 * d6;
    if (vb <= 0 && d2 >= 0 && d6 <= 0) {
      const w = d2 / (d2 - d6);
      const pt = this.add(a, this.scale(ac, w));
      return { point: pt, distance: this.distance(p, pt) };
    }

    const va = d3 * d6 - d5 * d4;
    if (va <= 0 && (d4 - d3) >= 0 && (d5 - d6) >= 0) {
      const w = (d4 - d3) / ((d4 - d3) + (d5 - d6));
      const pt = this.add(b, this.scale(this.subtract(c, b), w));
      return { point: pt, distance: this.distance(p, pt) };
    }

    const denom = 1.0 / (va + vb + vc);
    const v = vb * denom;
    const w = vc * denom;
    const pt = this.add(a, this.add(this.scale(ab, v), this.scale(ac, w)));
    return { point: pt, distance: this.distance(p, pt) };
  }
}

