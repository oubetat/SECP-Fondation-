import { describe, it, expect } from 'vitest';
import { GeometricRelations } from '../predicates/GeometricRelations';
import { Plane, Point } from '../geometry/GeometryContracts';

describe('PATCH-018: Parallelism and Incidence Predicates', () => {
  it('should classify point relative to plane', () => {
    const plane: Plane = {
      origin: { x: 0, y: 0, z: 0 },
      normal: { x: 0, y: 0, z: 1 },
      xDir: { x: 1, y: 0, z: 0 }
    };

    expect(GeometricRelations.classifyPointToPlane({ x: 1, y: 2, z: 3 }, plane).classification).toBe('POSITIVE_SIDE');
    expect(GeometricRelations.classifyPointToPlane({ x: 1, y: 2, z: -3 }, plane).classification).toBe('NEGATIVE_SIDE');
    expect(GeometricRelations.classifyPointToPlane({ x: 1, y: 2, z: 0 }, plane).classification).toBe('ON_PLANE');
  });

  it('should classify line-line relations in 3D', () => {
    const l1 = { origin: { x: 0, y: 0, z: 0 }, direction: { x: 1, y: 0, z: 0 } };
    const l2Coincident = { origin: { x: 5, y: 0, z: 0 }, direction: { x: 2, y: 0, z: 0 } };
    const l2Parallel = { origin: { x: 0, y: 3, z: 0 }, direction: { x: 1, y: 0, z: 0 } };
    const l2Intersect = { origin: { x: 5, y: -5, z: 0 }, direction: { x: 0, y: 1, z: 0 } };
    const l2Skew = { origin: { x: 5, y: -5, z: 2 }, direction: { x: 0, y: 1, z: 0 } };

    expect(GeometricRelations.lineLineRelation3D(l1, l2Coincident).classification).toBe('COINCIDENT');
    expect(GeometricRelations.lineLineRelation3D(l1, l2Parallel).classification).toBe('PARALLEL');
    expect(GeometricRelations.lineLineRelation3D(l1, l2Intersect).classification).toBe('INTERSECTING');
    expect(GeometricRelations.lineLineRelation3D(l1, l2Skew).classification).toBe('SKEW');
  });

  it('should classify line-plane relations', () => {
    const plane: Plane = { origin: { x: 0, y: 0, z: 0 }, normal: { x: 0, y: 0, z: 1 }, xDir: { x: 1, y: 0, z: 0 } };
    const lineIntersects = { origin: { x: 0, y: 0, z: 5 }, direction: { x: 0, y: 0, z: 1 } };
    const lineParallel = { origin: { x: 0, y: 0, z: 5 }, direction: { x: 1, y: 0, z: 0 } };
    const lineCoplanar = { origin: { x: 2, y: 3, z: 0 }, direction: { x: 1, y: 0, z: 0 } };

    expect(GeometricRelations.linePlaneRelation(lineIntersects, plane).classification).toBe('INTERSECTS');
    expect(GeometricRelations.linePlaneRelation(lineParallel, plane).classification).toBe('PARALLEL');
    expect(GeometricRelations.linePlaneRelation(lineCoplanar, plane).classification).toBe('COPLANAR');
  });
});
