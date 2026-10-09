import { describe, it, expect } from 'vitest';
import { OrientationPredicates } from '../predicates/OrientationPredicates';

describe('PATCH-018: Collinearity and Coplanarity Predicates', () => {
  it('should test 3D collinearity', () => {
    const a = { x: 0, y: 0, z: 0 };
    const b = { x: 2, y: 4, z: 6 };
    const c = { x: 3, y: 6, z: 9 };
    const d = { x: 3, y: 6, z: 10 };

    expect(OrientationPredicates.areCollinear(a, b, c).classification).toBe('TRUE_COLLINEAR');
    expect(OrientationPredicates.areCollinear(a, b, d).classification).toBe('NOT_COLLINEAR');
  });

  it('should test 3D coplanarity', () => {
    const p1 = { x: 0, y: 0, z: 0 };
    const p2 = { x: 10, y: 0, z: 0 };
    const p3 = { x: 0, y: 10, z: 0 };
    const p4OnPlane = { x: 5, y: 5, z: 0 };
    const p4OffPlane = { x: 5, y: 5, z: 1 };

    expect(OrientationPredicates.areCoplanar(p1, p2, p3, p4OnPlane).classification).toBe('COPLANAR');
    expect(OrientationPredicates.areCoplanar(p1, p2, p3, p4OffPlane).classification).toBe('NOT_COPLANAR');
  });

  it('should handle coincident or degenerate collinear points in coplanarity', () => {
    const p1 = { x: 0, y: 0, z: 0 };
    const p2 = { x: 1, y: 1, z: 1 };
    const p3 = { x: 2, y: 2, z: 2 };
    const p4 = { x: 3, y: 3, z: 3 };

    expect(OrientationPredicates.areCoplanar(p1, p2, p3, p4).classification).toBe('COPLANAR');
  });
});
