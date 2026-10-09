import { describe, it, expect } from 'vitest';
import { ClearanceAnalyzer } from '../ClearanceAnalyzer';
import { ClashComponentDefinition } from '../ClashTypes';
import { createIdentityTransform } from '../../kinematics/KinematicBody';

describe('ClearanceAnalyzer Unit Tests', () => {
  it('correctly reports CLEARANCE_VIOLATION when distance is below threshold', () => {
    const compA: ClashComponentDefinition = {
      componentId: 'A',
      geometryId: 'GA',
      geometry: { id: 'GA', type: 'SPHERE', dimensions: { radius: 10 } },
      worldTransform: createIdentityTransform(),
    };
    const compB: ClashComponentDefinition = {
      componentId: 'B',
      geometryId: 'GB',
      geometry: { id: 'GB', type: 'SPHERE', dimensions: { radius: 10 } },
      worldTransform: [
        [1, 0, 0, 23],
        [0, 1, 0, 0],
        [0, 0, 1, 0],
        [0, 0, 0, 1],
      ], // Centers at 0 and 23. Surface distance = 23 - (10+10) = 3mm.
    };

    const res = ClearanceAnalyzer.analyzePair(compA, compB, {
      requiredClearance: 5.0,
      tolerance: 1e-4,
    });

    expect(res.verdict).toBe('CLEARANCE_VIOLATION');
    expect(res.severity).toBe('WARNING');
    expect(res.minimumClearance).toBeCloseTo(3.0, 4);
    expect(res.diagnostics[0]).toContain('Clearance violation');
  });

  it('correctly reports NO_CLASH when clearance satisfies threshold', () => {
    const compA: ClashComponentDefinition = {
      componentId: 'A',
      geometryId: 'GA',
      geometry: { id: 'GA', type: 'SPHERE', dimensions: { radius: 10 } },
      worldTransform: createIdentityTransform(),
    };
    const compB: ClashComponentDefinition = {
      componentId: 'B',
      geometryId: 'GB',
      geometry: { id: 'GB', type: 'SPHERE', dimensions: { radius: 10 } },
      worldTransform: [
        [1, 0, 0, 28],
        [0, 1, 0, 0],
        [0, 0, 1, 0],
        [0, 0, 0, 1],
      ], // Centers at 0 and 28. Surface distance = 28 - (10+10) = 8mm.
    };

    const res = ClearanceAnalyzer.analyzePair(compA, compB, {
      requiredClearance: 5.0,
      tolerance: 1e-4,
    });

    expect(res.verdict).toBe('NO_CLASH');
    expect(res.severity).toBe('NONE');
    expect(res.minimumClearance).toBeCloseTo(8.0, 4);
  });
});
