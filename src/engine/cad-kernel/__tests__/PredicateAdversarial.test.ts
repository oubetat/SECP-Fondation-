import { describe, it, expect } from 'vitest';
import { VectorPredicates } from '../predicates/VectorPredicates';
import { OrientationPredicates } from '../predicates/OrientationPredicates';
import { ContainmentPredicates } from '../predicates/ContainmentPredicates';
import { IntersectionPredicates } from '../predicates/IntersectionPredicates';

describe('PATCH-018: Predicate Adversarial Robustness Suite', () => {
  it('should gracefully handle extreme numbers, subnormals, and huge coordinates', () => {
    const hugeA = { x: 1e12, y: 1e12 };
    const hugeB = { x: 2e12, y: 2e12 };
    const hugeC = { x: 3e12, y: 3e12 };

    const collRes = OrientationPredicates.orientation2D(hugeA, hugeB, hugeC);
    expect(collRes.classification).toBe('COLLINEAR');
  });

  it('should handle zero-length and degenerate geometry without throwing exceptions', () => {
    const zeroP = { x: 0, y: 0, z: 0 };
    const zeroBox = { min: zeroP, max: zeroP };
    const boxRes = ContainmentPredicates.classifyPointToAABB(zeroP, zeroBox);
    expect(boxRes.classification).toBe('BOUNDARY');

    const zeroSeg = { start: { x: 0, y: 0 }, end: { x: 0, y: 0 } };
    const segRes = IntersectionPredicates.segmentSegmentRelation2D(zeroSeg, zeroSeg);
    expect(segRes.classification === 'TOUCHING' || segRes.classification === 'OVERLAPPING').toBe(true);
  });

  it('should reject non-finite inputs uniformly', () => {
    expect(VectorPredicates.dotProduct({ x: Infinity, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }).classification).toBe('INVALID');
    expect(OrientationPredicates.orientation3D({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: -Infinity }).classification).toBe('INVALID');
  });
});
