import {
  Capsule3D,
  CollisionObject,
  DistanceQueryResult,
  NarrowPhaseVerdict,
  PenetrationDepthResult,
  Point3D,
  Triangle3D,
  Vector3D
} from "./types";

export class NarrowPhaseCollisionEngine {
  /**
   * Evaluates exact distance and intersection between two collision objects.
   */
  public static queryDistance(
    objA: CollisionObject,
    objB: CollisionObject
  ): DistanceQueryResult {
    // 1. Capsule to Capsule (e.g. Tool / Shank / Holder vs Fixture clamp capsule)
    if (objA.capsule && objB.capsule) {
      return this.capsuleToCapsuleDistance(objA.capsule, objB.capsule, [objA.objectId, objB.objectId]);
    }

    // 2. Capsule to AABB (e.g. Tool/Holder vs Stock/Fixture/Workpiece box)
    if (objA.capsule) {
      return this.capsuleToAABBDistance(objA.capsule, objB.aabb, [objA.objectId, objB.objectId]);
    } else if (objB.capsule) {
      const res = this.capsuleToAABBDistance(objB.capsule, objA.aabb, [objB.objectId, objA.objectId]);
      return {
        minimumDistance: res.minimumDistance,
        closestPointA: res.closestPointB,
        closestPointB: res.closestPointA,
        normal: { x: -res.normal.x, y: -res.normal.y, z: -res.normal.z },
        pair: [objA.objectId, objB.objectId],
        confidence: res.confidence
      };
    }

    // 3. Fallback: AABB to AABB exact distance
    return this.aabbToAABBDistance(objA.aabb, objB.aabb, [objA.objectId, objB.objectId]);
  }

  /**
   * Evaluates penetration depth between two objects if they intersect.
   */
  public static computePenetration(
    objA: CollisionObject,
    objB: CollisionObject,
    distResult: DistanceQueryResult
  ): PenetrationDepthResult {
    if (distResult.minimumDistance > 0) {
      return {
        penetrationDepth: 0.0,
        penetrationLocation: distResult.closestPointA,
        penetrationPair: [objA.objectId, objB.objectId],
        estimatedVolume: 0.0
      };
    }

    const depth = Math.abs(distResult.minimumDistance);
    const midPoint: Point3D = {
      x: (distResult.closestPointA.x + distResult.closestPointB.x) * 0.5,
      y: (distResult.closestPointA.y + distResult.closestPointB.y) * 0.5,
      z: (distResult.closestPointA.z + distResult.closestPointB.z) * 0.5
    };

    return {
      penetrationDepth: depth,
      penetrationLocation: midPoint,
      penetrationPair: [objA.objectId, objB.objectId],
      estimatedVolume: depth * depth * depth * 0.5
    };
  }

  /**
   * Distance between two 3D capsules defined by line segment + radius.
   */
  public static capsuleToCapsuleDistance(
    c1: Capsule3D,
    c2: Capsule3D,
    pair: [string, string]
  ): DistanceQueryResult {
    const { pA, pB, dist } = this.segmentToSegmentClosestPoints(c1.p1, c1.p2, c2.p1, c2.p2);
    const clearance = dist - (c1.radius + c2.radius);

    const normal = this.normalizeVector({
      x: pB.x - pA.x,
      y: pB.y - pA.y,
      z: pB.z - pA.z
    });

    return {
      minimumDistance: clearance,
      closestPointA: pA,
      closestPointB: pB,
      normal,
      pair,
      confidence: 1.0
    };
  }

  /**
   * Distance between a capsule and an AABB.
   */
  public static capsuleToAABBDistance(
    cap: Capsule3D,
    box: { min: Point3D; max: Point3D },
    pair: [string, string]
  ): DistanceQueryResult {
    // Sample along capsule core segment
    const steps = 10;
    let minDist = Number.POSITIVE_INFINITY;
    let bestCapPoint: Point3D = cap.p1;
    let bestBoxPoint: Point3D = box.min;

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const pt: Point3D = {
        x: cap.p1.x + t * (cap.p2.x - cap.p1.x),
        y: cap.p1.y + t * (cap.p2.y - cap.p1.y),
        z: cap.p1.z + t * (cap.p2.z - cap.p1.z)
      };

      const clampedToBox: Point3D = {
        x: Math.max(box.min.x, Math.min(box.max.x, pt.x)),
        y: Math.max(box.min.y, Math.min(box.max.y, pt.y)),
        z: Math.max(box.min.z, Math.min(box.max.z, pt.z))
      };

      const dx = pt.x - clampedToBox.x;
      const dy = pt.y - clampedToBox.y;
      const dz = pt.z - clampedToBox.z;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (d < minDist) {
        minDist = d;
        bestCapPoint = pt;
        bestBoxPoint = clampedToBox;
      }
    }

    const netDistance = minDist - cap.radius;
    const normal = this.normalizeVector({
      x: bestBoxPoint.x - bestCapPoint.x,
      y: bestBoxPoint.y - bestCapPoint.y,
      z: bestBoxPoint.z - bestCapPoint.z
    });

    return {
      minimumDistance: netDistance,
      closestPointA: bestCapPoint,
      closestPointB: bestBoxPoint,
      normal,
      pair,
      confidence: 0.98
    };
  }

  /**
   * Exact Euclidean distance between two AABBs.
   */
  public static aabbToAABBDistance(
    boxA: { min: Point3D; max: Point3D },
    boxB: { min: Point3D; max: Point3D },
    pair: [string, string]
  ): DistanceQueryResult {
    let dx = 0;
    if (boxA.min.x > boxB.max.x) dx = boxA.min.x - boxB.max.x;
    else if (boxB.min.x > boxA.max.x) dx = boxB.min.x - boxA.max.x;

    let dy = 0;
    if (boxA.min.y > boxB.max.y) dy = boxA.min.y - boxB.max.y;
    else if (boxB.min.y > boxA.max.y) dy = boxB.min.y - boxA.max.y;

    let dz = 0;
    if (boxA.min.z > boxB.max.z) dz = boxA.min.z - boxB.max.z;
    else if (boxB.min.z > boxA.max.z) dz = boxB.min.z - boxA.max.z;

    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

    const midA: Point3D = {
      x: (boxA.min.x + boxA.max.x) * 0.5,
      y: (boxA.min.y + boxA.max.y) * 0.5,
      z: (boxA.min.z + boxA.max.z) * 0.5
    };
    const midB: Point3D = {
      x: (boxB.min.x + boxB.max.x) * 0.5,
      y: (boxB.min.y + boxB.max.y) * 0.5,
      z: (boxB.min.z + boxB.max.z) * 0.5
    };

    const normal = this.normalizeVector({
      x: midB.x - midA.x,
      y: midB.y - midA.y,
      z: midB.z - midA.z
    });

    return {
      minimumDistance: dist,
      closestPointA: midA,
      closestPointB: midB,
      normal,
      pair,
      confidence: 1.0
    };
  }

  /**
   * Helper: Closest points between two 3D line segments p1-p2 and q1-q2.
   */
  public static segmentToSegmentClosestPoints(
    p1: Point3D,
    p2: Point3D,
    q1: Point3D,
    q2: Point3D
  ): { pA: Point3D; pB: Point3D; dist: number } {
    const d1 = { x: p2.x - p1.x, y: p2.y - p1.y, z: p2.z - p1.z };
    const d2 = { x: q2.x - q1.x, y: q2.y - q1.y, z: q2.z - q1.z };
    const r = { x: p1.x - q1.x, y: p1.y - q1.y, z: p1.z - q1.z };

    const a = d1.x * d1.x + d1.y * d1.y + d1.z * d1.z;
    const e = d2.x * d2.x + d2.y * d2.y + d2.z * d2.z;
    const f = d2.x * r.x + d2.y * r.y + d2.z * r.z;

    let s = 0.0;
    let t = 0.0;

    if (a <= 1e-8 && e <= 1e-8) {
      s = 0.0;
      t = 0.0;
    } else if (a <= 1e-8) {
      s = 0.0;
      t = Math.max(0.0, Math.min(1.0, f / e));
    } else {
      const c = d1.x * r.x + d1.y * r.y + d1.z * r.z;
      if (e <= 1e-8) {
        t = 0.0;
        s = Math.max(0.0, Math.min(1.0, -c / a));
      } else {
        const b = d1.x * d2.x + d1.y * d2.y + d1.z * d2.z;
        const denom = a * e - b * b;

        if (denom !== 0.0) {
          s = Math.max(0.0, Math.min(1.0, (b * f - c * e) / denom));
        } else {
          s = 0.0;
        }
        t = (b * s + f) / e;

        if (t < 0.0) {
          t = 0.0;
          s = Math.max(0.0, Math.min(1.0, -c / a));
        } else if (t > 1.0) {
          t = 1.0;
          s = Math.max(0.0, Math.min(1.0, (b - c) / a));
        }
      }
    }

    const pA: Point3D = {
      x: p1.x + d1.x * s,
      y: p1.y + d1.y * s,
      z: p1.z + d1.z * s
    };
    const pB: Point3D = {
      x: q1.x + d2.x * t,
      y: q1.y + d2.y * t,
      z: q1.z + d2.z * t
    };

    const dx = pB.x - pA.x;
    const dy = pB.y - pA.y;
    const dz = pB.z - pA.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

    return { pA, pB, dist };
  }

  public static normalizeVector(v: Vector3D): Vector3D {
    const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
    if (len < 1e-8) return { x: 0, y: 0, z: 1 };
    return { x: v.x / len, y: v.y / len, z: v.z / len };
  }
}
