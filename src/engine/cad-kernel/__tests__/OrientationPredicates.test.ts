import { describe, it, expect } from 'vitest';
import { OrientationPredicates } from '../predicates/OrientationPredicates';

describe('PATCH-018: OrientationPredicates', () => {
  it('should classify 2D orientation correctly', () => {
    const ccw = OrientationPredicates.orientation2D({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 });
    const cw = OrientationPredicates.orientation2D({ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 0 });
    const col = OrientationPredicates.orientation2D({ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 });

    expect(ccw.classification).toBe('COUNTERCLOCKWISE');
    expect(cw.classification).toBe('CLOCKWISE');
    expect(col.classification).toBe('COLLINEAR');
  });

  it('should classify 3D tetrahedral orientation correctly', () => {
    const a = { x: 0, y: 0, z: 0 };
    const b = { x: 1, y: 0, z: 0 };
    const c = { x: 0, y: 1, z: 0 };
    const d = { x: 0, y: 0, z: 1 };

    const pos = OrientationPredicates.orientation3D(a, b, c, d);
    const neg = OrientationPredicates.orientation3D(a, c, b, d);
    const coplanar = OrientationPredicates.orientation3D(a, b, c, { x: 1, y: 1, z: 0 });

    expect(pos.classification).toBe('POSITIVE');
    expect(neg.classification).toBe('NEGATIVE');
    expect(coplanar.classification).toBe('COPLANAR');
  });

  it('should handle non-finite points as INVALID', () => {
    const inv = OrientationPredicates.orientation2D({ x: NaN, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 });
    expect(inv.classification).toBe('INVALID');
  });
});
