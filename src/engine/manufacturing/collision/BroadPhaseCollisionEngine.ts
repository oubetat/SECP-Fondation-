import {
  AABB3D,
  BroadPhaseVerdict,
  CollisionObject,
  Point3D,
  Vector3D
} from "./types";

export class BroadPhaseCollisionEngine {
  /**
   * Evaluates whether two collision objects could potentially intersect based on their AABBs.
   */
  public static evaluatePairAABB(
    objA: CollisionObject,
    objB: CollisionObject,
    expansionMargin: number = 0.0
  ): BroadPhaseVerdict {
    if (!objA.isActive || !objB.isActive) {
      return BroadPhaseVerdict.DISJOINT;
    }

    const aabbA = objA.aabb;
    const aabbB = objB.aabb;

    const overlapX = (aabbA.min.x - expansionMargin) <= (aabbB.max.x + expansionMargin) &&
                     (aabbA.max.x + expansionMargin) >= (aabbB.min.x - expansionMargin);
    const overlapY = (aabbA.min.y - expansionMargin) <= (aabbB.max.y + expansionMargin) &&
                     (aabbA.max.y + expansionMargin) >= (aabbB.min.y - expansionMargin);
    const overlapZ = (aabbA.min.z - expansionMargin) <= (aabbB.max.z + expansionMargin) &&
                     (aabbA.max.z + expansionMargin) >= (aabbB.min.z - expansionMargin);

    if (overlapX && overlapY && overlapZ) {
      return BroadPhaseVerdict.CANDIDATE;
    }

    return BroadPhaseVerdict.DISJOINT;
  }

  /**
   * Filters a list of object pairs down to candidates that require narrow-phase investigation.
   */
  public static filterCandidatePairs(
    objectsA: CollisionObject[],
    objectsB: CollisionObject[],
    margin: number = 0.0
  ): Array<{ objectA: CollisionObject; objectB: CollisionObject }> {
    const candidatePairs: Array<{ objectA: CollisionObject; objectB: CollisionObject }> = [];

    for (const a of objectsA) {
      for (const b of objectsB) {
        if (a.objectId === b.objectId) continue;
        const verdict = this.evaluatePairAABB(a, b, margin);
        if (verdict === BroadPhaseVerdict.CANDIDATE || verdict === BroadPhaseVerdict.POSSIBLE_INTERSECTION) {
          candidatePairs.push({ objectA: a, objectB: b });
        }
      }
    }

    return candidatePairs;
  }

  /**
   * Expands an AABB by a scalar delta.
   */
  public static expandAABB(box: AABB3D, delta: number): AABB3D {
    return {
      min: { x: box.min.x - delta, y: box.min.y - delta, z: box.min.z - delta },
      max: { x: box.max.x + delta, y: box.max.y + delta, z: box.max.z + delta }
    };
  }

  /**
   * Computes the bounding box of a point set.
   */
  public static computeAABBFromPoints(points: Point3D[]): AABB3D {
    if (points.length === 0) {
      return { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } };
    }
    let minX = points[0].x, minY = points[0].y, minZ = points[0].z;
    let maxX = points[0].x, maxY = points[0].y, maxZ = points[0].z;

    for (let i = 1; i < points.length; i++) {
      const p = points[i];
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.z < minZ) minZ = p.z;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
      if (p.z > maxZ) maxZ = p.z;
    }

    return {
      min: { x: minX, y: minY, z: minZ },
      max: { x: maxX, y: maxY, z: maxZ }
    };
  }
}
