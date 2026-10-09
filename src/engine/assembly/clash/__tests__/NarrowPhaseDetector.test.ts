import { describe, it, expect } from 'vitest';
import { NarrowPhaseDetector } from '../NarrowPhaseDetector';
import { ClashComponentDefinition } from '../ClashTypes';
import { createIdentityTransform } from '../../kinematics/KinematicBody';

describe('NarrowPhaseDetector Unit & Edge Case Tests', () => {
  it('detects Sphere vs Sphere collision accurately with contact normals', () => {
    const sphereA: ClashComponentDefinition = {
      componentId: 'S1',
      geometryId: 'GS1',
      geometry: { id: 'GS1', type: 'SPHERE', dimensions: { radius: 10 } },
      worldTransform: createIdentityTransform(),
    };
    const sphereB: ClashComponentDefinition = {
      componentId: 'S2',
      geometryId: 'GS2',
      geometry: { id: 'GS2', type: 'SPHERE', dimensions: { radius: 10 } },
      worldTransform: [
        [1, 0, 0, 15],
        [0, 1, 0, 0],
        [0, 0, 1, 0],
        [0, 0, 0, 1],
      ],
    };

    const res = NarrowPhaseDetector.evaluatePair(sphereA, sphereB, { tolerance: 1e-4 });
    expect(res.verdict).toBe('CLASH');
    expect(res.penetrationDepth).toBeCloseTo(5.0, 4);
    expect(res.contacts.length).toBe(1);
    expect(res.contacts[0].normal).toEqual([1, 0, 0]);
  });

  it('detects Box vs Sphere collision and calculates penetration depth', () => {
    const box: ClashComponentDefinition = {
      componentId: 'BOX1',
      geometryId: 'GB1',
      geometry: { id: 'GB1', type: 'BOX', dimensions: { dx: 10, dy: 10, dz: 10 } },
      worldTransform: createIdentityTransform(),
    };
    const sphere: ClashComponentDefinition = {
      componentId: 'SPH1',
      geometryId: 'GS1',
      geometry: { id: 'GS1', type: 'SPHERE', dimensions: { radius: 5 } },
      worldTransform: [
        [1, 0, 0, 8],
        [0, 1, 0, 0],
        [0, 0, 1, 0],
        [0, 0, 0, 1],
      ], // Sphere center at x=8. Box extents [-5, 5]. Closest point x=5. Distance=3. Radius=5 -> overlap = 2.
    };

    const res = NarrowPhaseDetector.evaluatePair(box, sphere, { tolerance: 1e-4 });
    expect(res.verdict).toBe('CLASH');
    expect(res.penetrationDepth).toBeCloseTo(2.0, 4);
  });

  it('evaluates Cylinder vs Cylinder overlap correctly', () => {
    const cylA: ClashComponentDefinition = {
      componentId: 'CYL_A',
      geometryId: 'GC1',
      geometry: { id: 'GC1', type: 'CYLINDER', dimensions: { radius: 5, height: 20 } },
      worldTransform: createIdentityTransform(),
    };
    const cylB: ClashComponentDefinition = {
      componentId: 'CYL_B',
      geometryId: 'GC2',
      geometry: { id: 'GC2', type: 'CYLINDER', dimensions: { radius: 5, height: 20 } },
      worldTransform: [
        [1, 0, 0, 8],
        [0, 1, 0, 0],
        [0, 0, 1, 0],
        [0, 0, 0, 1],
      ], // Radii sum = 10, distance = 8 -> 2mm overlap
    };

    const res = NarrowPhaseDetector.evaluatePair(cylA, cylB, { tolerance: 1e-4 });
    expect(res.verdict).toBe('CLASH');
    expect(res.penetrationDepth).toBeCloseTo(2.0, 4);
  });

  it('rejects degenerate/unsupported geometry gracefully as INVALID or INCONCLUSIVE', () => {
    const unrecogGeom: ClashComponentDefinition = {
      componentId: 'UNREC',
      geometryId: 'G_U',
      geometry: { id: 'G_U', type: 'NURBS_BREP' as any },
      worldTransform: createIdentityTransform(),
    };
    const box: ClashComponentDefinition = {
      componentId: 'BOX1',
      geometryId: 'GB1',
      geometry: { id: 'GB1', type: 'BOX', dimensions: { dx: 10, dy: 10, dz: 10 } },
      worldTransform: createIdentityTransform(),
    };

    const res = NarrowPhaseDetector.evaluatePair(unrecogGeom, box);
    expect(res.verdict).toBe('INCONCLUSIVE');
  });
});
