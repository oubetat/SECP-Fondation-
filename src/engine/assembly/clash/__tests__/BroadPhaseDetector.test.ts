import { describe, it, expect } from 'vitest';
import { BroadPhaseDetector } from '../BroadPhaseDetector';
import { ClashComponentDefinition } from '../ClashTypes';
import { createIdentityTransform } from '../../kinematics/KinematicBody';

describe('BroadPhaseDetector Unit Tests', () => {
  it('computes world AABBs accurately with rotation', () => {
    const cos45 = Math.cos(Math.PI / 4);
    const sin45 = Math.sin(Math.PI / 4);

    const comp: ClashComponentDefinition = {
      componentId: 'ROT_BOX',
      geometryId: 'G1',
      geometry: { id: 'G1', type: 'BOX', dimensions: { dx: 10, dy: 10, dz: 10 } },
      worldTransform: [
        [cos45, -sin45, 0, 0],
        [sin45, cos45, 0, 0],
        [0, 0, 1, 0],
        [0, 0, 0, 1],
      ],
    };

    const aabb = BroadPhaseDetector.computeWorldAABB(comp);
    // Extents: 5 * sqrt(2) approx 7.071
    expect(aabb.min.x).toBeCloseTo(-7.071, 2);
    expect(aabb.max.x).toBeCloseTo(7.071, 2);
    expect(aabb.min.y).toBeCloseTo(-7.071, 2);
    expect(aabb.max.y).toBeCloseTo(7.071, 2);
    expect(aabb.min.z).toBeCloseTo(-5, 4);
    expect(aabb.max.z).toBeCloseTo(5, 4);
  });

  it('filters out non-overlapping pairs cleanly with clearance expansion', () => {
    const compA: ClashComponentDefinition = {
      componentId: 'A',
      geometryId: 'GA',
      geometry: { id: 'GA', type: 'BOX', dimensions: { dx: 10, dy: 10, dz: 10 } },
      worldTransform: createIdentityTransform(),
    };
    const compB: ClashComponentDefinition = {
      componentId: 'B',
      geometryId: 'GB',
      geometry: { id: 'GB', type: 'BOX', dimensions: { dx: 10, dy: 10, dz: 10 } },
      worldTransform: [
        [1, 0, 0, 14],
        [0, 1, 0, 0],
        [0, 0, 1, 0],
        [0, 0, 0, 1],
      ], // Gap is 4mm (14 - 10)
    };

    // Without clearance, gap=4mm does NOT overlap in broad phase
    const cNoClearance = BroadPhaseDetector.findCandidatePairs([compA, compB], {
      requiredClearance: 0,
    });
    expect(cNoClearance.length).toBe(0);

    // With required clearance 5mm, gap=4mm DOES overlap the expanded AABBs!
    const cWithClearance = BroadPhaseDetector.findCandidatePairs([compA, compB], {
      requiredClearance: 5.0,
    });
    expect(cWithClearance.length).toBe(1);
  });
});
