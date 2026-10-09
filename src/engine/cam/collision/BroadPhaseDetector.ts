/**
 * SECP Industrial OS v3 — Real CAM Kernel
 * PATCH-259 — Broad Phase Collision Detector (Spatial Acceleration & BVH)
 */

import { Vector3D } from '../../cadKernel';
import { AABB3D, CollisionGeometryType, Triangle3D, CollisionMesh } from './CollisionTypes';
import { CollisionMathUtils } from './CollisionMathUtils';

export interface SpatialBVHNode {
  aabb: AABB3D;
  left?: SpatialBVHNode;
  right?: SpatialBVHNode;
  triangles?: Triangle3D[];
  isLeaf: boolean;
}

export interface CandidateCollisionPair {
  bodyA: CollisionGeometryType;
  bodyB: CollisionGeometryType;
  bodyAName: string;
  bodyBName: string;
  aabbA: AABB3D;
  aabbB: AABB3D;
  estimatedMinDistanceMm: number;
}

export class BroadPhaseDetector {
  public static buildBVH(triangles: Triangle3D[], maxLeafSize: number = 8): SpatialBVHNode {
    if (triangles.length === 0) {
      return {
        aabb: { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } },
        isLeaf: true,
        triangles: []
      };
    }

    const allPts: Vector3D[] = [];
    triangles.forEach(t => {
      allPts.push(t.v0, t.v1, t.v2);
    });
    const aabb = CollisionMathUtils.createAABB(allPts);

    if (triangles.length <= maxLeafSize) {
      return {
        aabb,
        isLeaf: true,
        triangles
      };
    }

    // Split along the longest axis of the AABB
    const dx = aabb.max.x - aabb.min.x;
    const dy = aabb.max.y - aabb.min.y;
    const dz = aabb.max.z - aabb.min.z;
    const splitAxis = (dx >= dy && dx >= dz) ? 'x' : (dy >= dz ? 'y' : 'z');

    // Sort by triangle centroid along split axis
    const sorted = [...triangles].sort((a, b) => {
      const cA = (a.v0[splitAxis] + a.v1[splitAxis] + a.v2[splitAxis]) / 3;
      const cB = (b.v0[splitAxis] + b.v1[splitAxis] + b.v2[splitAxis]) / 3;
      return cA - cB;
    });

    const mid = Math.floor(sorted.length / 2);
    const leftTris = sorted.slice(0, mid);
    const rightTris = sorted.slice(mid);

    return {
      aabb,
      isLeaf: false,
      left: this.buildBVH(leftTris, maxLeafSize),
      right: this.buildBVH(rightTris, maxLeafSize)
    };
  }

  public static queryBVH(
    node: SpatialBVHNode,
    queryAABB: AABB3D,
    resultTriangles: Triangle3D[]
  ): void {
    if (!CollisionMathUtils.intersectAABB(node.aabb, queryAABB)) {
      return;
    }

    if (node.isLeaf && node.triangles) {
      resultTriangles.push(...node.triangles);
      return;
    }

    if (node.left) this.queryBVH(node.left, queryAABB, resultTriangles);
    if (node.right) this.queryBVH(node.right, queryAABB, resultTriangles);
  }

  public static filterPotentialPairs(
    bodies: { type: CollisionGeometryType; name: string; aabb: AABB3D }[],
    clearanceMarginMm: number = 2.0
  ): CandidateCollisionPair[] {
    const candidatePairs: CandidateCollisionPair[] = [];

    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        const bA = bodies[i];
        const bB = bodies[j];

        // Expand one AABB by clearance margin to catch close proximity
        const expandedA = CollisionMathUtils.expandAABB(bA.aabb, clearanceMarginMm);

        if (CollisionMathUtils.intersectAABB(expandedA, bB.aabb)) {
          const dist = CollisionMathUtils.distanceAABBToAABB(bA.aabb, bB.aabb);
          candidatePairs.push({
            bodyA: bA.type,
            bodyB: bB.type,
            bodyAName: bA.name,
            bodyBName: bB.name,
            aabbA: bA.aabb,
            aabbB: bB.aabb,
            estimatedMinDistanceMm: dist
          });
        }
      }
    }

    return candidatePairs;
  }
}
