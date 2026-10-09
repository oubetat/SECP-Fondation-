import { describe, it, expect } from 'vitest';
import { ContainmentPredicates } from '../predicates/ContainmentPredicates';
import { Triangle2D, Triangle3D } from '../predicates/PredicateContracts';
import { BoundingBox } from '../geometry/GeometryContracts';

describe('PATCH-018: ContainmentPredicates', () => {
  it('should test 2D triangle containment', () => {
    const tri: Triangle2D = {
      a: { x: 0, y: 0 },
      b: { x: 10, y: 0 },
      c: { x: 0, y: 10 }
    };

    expect(ContainmentPredicates.pointInTriangle2D({ x: 2, y: 2 }, tri).classification).toBe('INSIDE');
    expect(ContainmentPredicates.pointInTriangle2D({ x: 0, y: 5 }, tri).classification).toBe('BOUNDARY');
    expect(ContainmentPredicates.pointInTriangle2D({ x: 0, y: 0 }, tri).classification).toBe('BOUNDARY');
    expect(ContainmentPredicates.pointInTriangle2D({ x: 10, y: 10 }, tri).classification).toBe('OUTSIDE');
    expect(ContainmentPredicates.pointInTriangle2D({ x: -1, y: 2 }, tri).classification).toBe('OUTSIDE');
  });

  it('should test 3D triangle containment', () => {
    const tri: Triangle3D = {
      a: { x: 0, y: 0, z: 0 },
      b: { x: 10, y: 0, z: 0 },
      c: { x: 0, y: 10, z: 0 }
    };

    expect(ContainmentPredicates.pointInTriangle3D({ x: 3, y: 3, z: 0 }, tri).classification).toBe('INSIDE');
    expect(ContainmentPredicates.pointInTriangle3D({ x: 3, y: 3, z: 1 }, tri).classification).toBe('OUTSIDE');
    expect(ContainmentPredicates.pointInTriangle3D({ x: 15, y: 0, z: 0 }, tri).classification).toBe('OUTSIDE');
  });

  it('should test AABB containment', () => {
    const box: BoundingBox = {
      min: { x: 0, y: 0, z: 0 },
      max: { x: 10, y: 20, z: 30 }
    };

    expect(ContainmentPredicates.classifyPointToAABB({ x: 5, y: 10, z: 15 }, box).classification).toBe('INSIDE');
    expect(ContainmentPredicates.classifyPointToAABB({ x: 0, y: 10, z: 15 }, box).classification).toBe('BOUNDARY');
    expect(ContainmentPredicates.classifyPointToAABB({ x: 15, y: 10, z: 15 }, box).classification).toBe('OUTSIDE');
  });

  it('should reject degenerate or inverted shapes', () => {
    const degenerateTri: Triangle2D = {
      a: { x: 0, y: 0 },
      b: { x: 5, y: 5 },
      c: { x: 10, y: 10 }
    };
    expect(ContainmentPredicates.pointInTriangle2D({ x: 2, y: 2 }, degenerateTri).classification).toBe('INVALID');

    const invertedBox: BoundingBox = {
      min: { x: 10, y: 0, z: 0 },
      max: { x: 0, y: 10, z: 10 }
    };
    expect(ContainmentPredicates.classifyPointToAABB({ x: 5, y: 5, z: 5 }, invertedBox).classification).toBe('INVALID');
  });
});
