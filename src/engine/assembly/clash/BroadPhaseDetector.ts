import { Vector3D } from '../../cadKernel';
import {
  ClashComponentDefinition,
  AxisAlignedBoundingBox,
  ClashPair,
  ClashDetectionOptions,
} from './ClashTypes';

export interface BroadPhaseCandidate {
  pair: ClashPair;
  bboxA: AxisAlignedBoundingBox;
  bboxB: AxisAlignedBoundingBox;
  overlapMin: Vector3D;
  overlapMax: Vector3D;
}

export class BroadPhaseDetector {
  /**
   * Transforms a 3D local point by a 4x4 matrix
   */
  public static transformPoint(p: Vector3D, T: number[][]): Vector3D {
    return {
      x: T[0][0] * p.x + T[0][1] * p.y + T[0][2] * p.z + T[0][3],
      y: T[1][0] * p.x + T[1][1] * p.y + T[1][2] * p.z + T[1][3],
      z: T[2][0] * p.x + T[2][1] * p.y + T[2][2] * p.z + T[2][3],
    };
  }

  /**
   * Computes the World AABB of a component based on its geometry and 4x4 world transform
   */
  public static computeWorldAABB(comp: ClashComponentDefinition): AxisAlignedBoundingBox {
    const T = comp.worldTransform;
    const geom = comp.geometry;

    let localCorners: Vector3D[] = [];

    if (geom.type === 'BOX' && geom.dimensions) {
      const dx = geom.dimensions.dx ?? 10;
      const dy = geom.dimensions.dy ?? 10;
      const dz = geom.dimensions.dz ?? 10;
      // Box centered at origin or [0..dx, 0..dy, 0..dz]
      // Support standard symmetric bounds [-dx/2..dx/2] or [0..dx]
      const hx = dx / 2;
      const hy = dy / 2;
      const hz = dz / 2;
      localCorners = [
        { x: -hx, y: -hy, z: -hz },
        { x: hx, y: -hy, z: -hz },
        { x: hx, y: hy, z: -hz },
        { x: -hx, y: hy, z: -hz },
        { x: -hx, y: -hy, z: hz },
        { x: hx, y: -hy, z: hz },
        { x: hx, y: hy, z: hz },
        { x: -hx, y: hy, z: hz },
      ];
    } else if (geom.type === 'CYLINDER' && geom.dimensions) {
      const r = geom.dimensions.radius ?? 5;
      const h = geom.dimensions.height ?? 10;
      const hz = h / 2;
      // Approximate cylinder bounding vertices
      const angles = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];
      for (const ang of angles) {
        const x = r * Math.cos(ang);
        const y = r * Math.sin(ang);
        localCorners.push({ x, y, z: -hz });
        localCorners.push({ x, y, z: hz });
      }
    } else if (geom.type === 'SPHERE' && geom.dimensions) {
      const r = geom.dimensions.radius ?? 5;
      localCorners = [
        { x: -r, y: 0, z: 0 },
        { x: r, y: 0, z: 0 },
        { x: 0, y: -r, z: 0 },
        { x: 0, y: r, z: 0 },
        { x: 0, y: 0, z: -r },
        { x: 0, y: 0, z: r },
      ];
    } else if (geom.vertices && geom.vertices.length >= 3) {
      for (let i = 0; i < geom.vertices.length; i += 3) {
        localCorners.push({
          x: geom.vertices[i],
          y: geom.vertices[i + 1],
          z: geom.vertices[i + 2],
        });
      }
    } else {
      throw new Error("UNAVAILABLE: Cannot determine bounding box for empty or degenerate geometry without fabricating a synthetic box.");
    }

    let minX = Infinity;
    let minY = Infinity;
    let minZ = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let maxZ = -Infinity;

    for (const pt of localCorners) {
      const wPt = this.transformPoint(pt, T);
      if (wPt.x < minX) minX = wPt.x;
      if (wPt.y < minY) minY = wPt.y;
      if (wPt.z < minZ) minZ = wPt.z;
      if (wPt.x > maxX) maxX = wPt.x;
      if (wPt.y > maxY) maxY = wPt.y;
      if (wPt.z > maxZ) maxZ = wPt.z;
    }

    return {
      min: { x: minX, y: minY, z: minZ },
      max: { x: maxX, y: maxY, z: maxZ },
    };
  }

  /**
   * Tests whether two AABBs overlap, accounting for optional clearance expansion
   */
  public static testAABBOverlap(
    boxA: AxisAlignedBoundingBox,
    boxB: AxisAlignedBoundingBox,
    expansion: number = 0
  ): { overlaps: boolean; overlapMin?: Vector3D; overlapMax?: Vector3D } {
    const minAx = boxA.min.x - expansion;
    const minAy = boxA.min.y - expansion;
    const minAz = boxA.min.z - expansion;
    const maxAx = boxA.max.x + expansion;
    const maxAy = boxA.max.y + expansion;
    const maxAz = boxA.max.z + expansion;

    const minBx = boxB.min.x;
    const minBy = boxB.min.y;
    const minBz = boxB.min.z;
    const maxBx = boxB.max.x;
    const maxBy = boxB.max.y;
    const maxBz = boxB.max.z;

    const overlapX = minAx <= maxBx && maxAx >= minBx;
    const overlapY = minAy <= maxBy && maxAy >= minBy;
    const overlapZ = minAz <= maxBz && maxAz >= minBz;

    if (!overlapX || !overlapY || !overlapZ) {
      return { overlaps: false };
    }

    const overlapMin: Vector3D = {
      x: Math.max(minAx, minBx),
      y: Math.max(minAy, minBy),
      z: Math.max(minAz, minBz),
    };
    const overlapMax: Vector3D = {
      x: Math.min(maxAx, maxBx),
      y: Math.min(maxAy, maxBy),
      z: Math.min(maxAz, maxBz),
    };

    return { overlaps: true, overlapMin, overlapMax };
  }

  /**
   * Generates deterministically ordered candidate clash pairs using Broad Phase AABB tests
   */
  public static findCandidatePairs(
    components: ClashComponentDefinition[],
    options: ClashDetectionOptions = {}
  ): BroadPhaseCandidate[] {
    const active = components.filter(c => !c.suppressed && c.visible !== false);
    const clearance = options.requiredClearance ?? 0;
    const candidates: BroadPhaseCandidate[] = [];

    // Precompute AABBs
    const bboxes: Map<string, AxisAlignedBoundingBox> = new Map();
    for (const comp of active) {
      bboxes.set(comp.componentId, this.computeWorldAABB(comp));
    }

    const allowedPairsSet = new Set<string>();
    if (options.allowedPairs) {
      for (const [id1, id2] of options.allowedPairs) {
        const sortedPairKey = id1 < id2 ? `${id1}::${id2}` : `${id2}::${id1}`;
        allowedPairsSet.add(sortedPairKey);
      }
    }

    // Sort components deterministically by ID
    const sortedComps = [...active].sort((a, b) => a.componentId.localeCompare(b.componentId));

    for (let i = 0; i < sortedComps.length; i++) {
      for (let j = i + 1; j < sortedComps.length; j++) {
        const compA = sortedComps[i];
        const compB = sortedComps[j];

        // Self-pair exclusion guaranteed by j = i + 1 and distinct IDs
        if (compA.componentId === compB.componentId) continue;

        const pairKey = `${compA.componentId}::${compB.componentId}`;
        if (allowedPairsSet.has(pairKey)) {
          // Explicitly allowed pair excluded from clash detection candidates
          continue;
        }

        const bboxA = bboxes.get(compA.componentId)!;
        const bboxB = bboxes.get(compB.componentId)!;

        const overlap = this.testAABBOverlap(bboxA, bboxB, clearance);
        if (overlap.overlaps && overlap.overlapMin && overlap.overlapMax) {
          candidates.push({
            pair: {
              componentAId: compA.componentId,
              componentBId: compB.componentId,
            },
            bboxA,
            bboxB,
            overlapMin: overlap.overlapMin,
            overlapMax: overlap.overlapMax,
          });
        }
      }
    }

    // Sort candidate pairs deterministically
    candidates.sort((a, b) => {
      const cmpA = a.pair.componentAId.localeCompare(b.pair.componentAId);
      if (cmpA !== 0) return cmpA;
      return a.pair.componentBId.localeCompare(b.pair.componentBId);
    });

    return candidates;
  }
}
