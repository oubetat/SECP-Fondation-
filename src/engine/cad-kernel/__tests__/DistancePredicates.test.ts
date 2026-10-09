import { describe, it, expect } from 'vitest';
import { DistancePredicates } from '../predicates/DistancePredicates';
import { Plane, Point } from '../geometry/GeometryContracts';

describe('PATCH-018: DistancePredicates', () => {
  it('should calculate point-point distance and squared distance', () => {
    const p1: Point = { x: 1, y: 2, z: 3 };
    const p2: Point = { x: 4, y: 6, z: 3 };
    const res = DistancePredicates.pointPointDistance(p1, p2);
    expect(res.value?.distance).toBe(5);
    expect(res.value?.squaredDistance).toBe(25);
  });

  it('should calculate point-line and point-segment distance', () => {
    const seg = { start: { x: 0, y: 0, z: 0 }, end: { x: 10, y: 0, z: 0 } };
    const line = { origin: seg.start, direction: { x: 1, y: 0, z: 0 } };

    // Point above middle of segment
    const ptMid = { x: 5, y: 4, z: 0 };
    expect(DistancePredicates.pointLineDistance(ptMid, line).value?.distance).toBe(4);
    expect(DistancePredicates.pointSegmentDistance(ptMid, seg).value?.distance).toBe(4);

    // Point beyond end of segment (clamped to end)
    const ptBeyond = { x: 13, y: 4, z: 0 };
    expect(DistancePredicates.pointLineDistance(ptBeyond, line).value?.distance).toBe(4);
    expect(DistancePredicates.pointSegmentDistance(ptBeyond, seg).value?.distance).toBe(5); // sqrt((13-10)^2 + 4^2) = 5
  });

  it('should calculate point-plane distance', () => {
    const plane: Plane = {
      origin: { x: 0, y: 0, z: 0 },
      normal: { x: 0, y: 0, z: 1 },
      xDir: { x: 1, y: 0, z: 0 }
    };
    expect(DistancePredicates.pointPlaneDistance({ x: 5, y: 5, z: 12 }, plane).value).toBe(12);
    expect(DistancePredicates.pointPlaneDistance({ x: 5, y: 5, z: -12 }, plane).value).toBe(12);
  });
});
