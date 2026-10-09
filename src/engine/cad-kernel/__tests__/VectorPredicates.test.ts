import { describe, it, expect } from 'vitest';
import { VectorPredicates } from '../predicates/VectorPredicates';
import { Vector } from '../geometry/GeometryContracts';

describe('PATCH-018: VectorPredicates', () => {
  it('should compute dot products and cross products accurately', () => {
    const v1: Vector = { x: 1, y: 0, z: 0 };
    const v2: Vector = { x: 0, y: 1, z: 0 };
    const dot = VectorPredicates.dotProduct(v1, v2);
    const cross = VectorPredicates.crossProduct(v1, v2);

    expect(dot.classification).toBe('TRUE');
    expect(dot.value).toBe(0);

    expect(cross.classification).toBe('TRUE');
    expect(cross.value).toEqual({ x: 0, y: 0, z: 1 });
  });

  it('should calculate vector length and squared length', () => {
    const v: Vector = { x: 3, y: 4, z: 0 };
    expect(VectorPredicates.squaredLength(v).value).toBe(25);
    expect(VectorPredicates.vectorLength(v).value).toBe(5);
  });

  it('should safely normalize vectors and reject zero vectors', () => {
    const zeroV: Vector = { x: 0, y: 0, z: 0 };
    const normZero = VectorPredicates.normalize(zeroV);
    expect(normZero.classification).toBe('INVALID');
    expect(Number.isNaN(normZero.value!.x)).toBe(false);

    const v: Vector = { x: 0, y: 10, z: 0 };
    const normV = VectorPredicates.normalize(v);
    expect(normV.classification).toBe('TRUE');
    expect(normV.value).toEqual({ x: 0, y: 1, z: 0 });
  });

  it('should evaluate parallelism and perpendicularity', () => {
    const a: Vector = { x: 1, y: 0, z: 0 };
    const b: Vector = { x: 2, y: 0, z: 0 };
    const c: Vector = { x: -3, y: 0, z: 0 };
    const d: Vector = { x: 0, y: 5, z: 0 };

    expect(VectorPredicates.parallel(a, b).classification).toBe('TRUE');
    expect(VectorPredicates.sameDirection(a, b).classification).toBe('TRUE');
    expect(VectorPredicates.oppositeDirection(a, c).classification).toBe('TRUE');
    expect(VectorPredicates.perpendicular(a, d).classification).toBe('TRUE');
    expect(VectorPredicates.perpendicular(a, b).classification).toBe('FALSE');
  });

  it('should reject invalid non-finite vectors', () => {
    const bad: Vector = { x: NaN, y: 1, z: 0 };
    expect(VectorPredicates.dotProduct(bad, { x: 1, y: 0, z: 0 }).classification).toBe('INVALID');
    expect(VectorPredicates.vectorLength(bad).classification).toBe('INVALID');
  });
});
