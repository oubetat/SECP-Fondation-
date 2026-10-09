import { describe, it, expect } from 'vitest';
import { GeometricTolerance } from '../predicates/GeometricTolerance';

describe('PATCH-018: GeometricTolerance', () => {
  it('should define immutable default tolerance models', () => {
    const def = GeometricTolerance.DEFAULT;
    expect(def.absoluteLength).toBe(1e-7);
    expect(def.relativeLength).toBe(1e-6);
    expect(def.angularRad).toBe(1e-6);
    expect(def.area).toBe(1e-14);
    expect(def.volume).toBe(1e-21);
    expect(def.parameter).toBe(1e-7);
    expect(def.determinant).toBe(1e-12);
  });

  it('should validate finite numbers accurately', () => {
    expect(GeometricTolerance.isFiniteNumber(1, 2.5, -100, 0)).toBe(true);
    expect(GeometricTolerance.isFiniteNumber(1, NaN, 2)).toBe(false);
    expect(GeometricTolerance.isFiniteNumber(1, Infinity, 2)).toBe(false);
    expect(GeometricTolerance.isFiniteNumber(1, -Infinity, 2)).toBe(false);
  });

  it('should compute scale-aware tolerances correctly', () => {
    const unitScale = GeometricTolerance.getScaleAwareLengthTolerance(1.0);
    expect(unitScale).toBe(1e-6);

    const largeScale = GeometricTolerance.getScaleAwareLengthTolerance(1000.0);
    expect(largeScale).toBe(1e-3);

    const smallScale = GeometricTolerance.getScaleAwareLengthTolerance(1e-9);
    expect(smallScale).toBe(1e-7);
  });
});
