/**
 * SECP CAD Kernel — GCS 3D Constraint Evaluation Tests
 * Phase 2 (PATCH-026)
 */

import { describe, it, expect } from 'vitest';
import { Constraint3DResidual } from '../Constraint3DResidual';
import { Model3D, Geometry3DEntity } from '../Constraint3DTypes';
import { Constraint3D } from '../Constraint3DModel';
import { Constraint3DSystem } from '../Constraint3DSystem';
import { Constraint3DEvaluator } from '../Constraint3DEvaluator';
import { EngineeringIdentity, EngineeringObjectType, IdentityClassification } from '../../identity/CanonicalEngineeringIdentity';
import { ProvenanceNode } from '../../provenance/ProvenanceGraphTypes';

function createIdentity(id: string): EngineeringIdentity {
  return {
    identityId: id,
    objectType: EngineeringObjectType.GEOMETRY,
    projectId: id,
    revisionId: 'r1',
    objectVersion: 1,
    contentHash: `hash-${id}`,
    timestamp: new Date().toISOString(),
    createdBy: 'test',
    classification: IdentityClassification.PUBLIC,
    tags: []
  };
}

function createProvenance(id: string): ProvenanceNode {
  return {
    id,
    type: 'GEOMETRY',
    engineeringIdentityId: id,
    canonicalHash: `HASH-${id}`,
    version: '1.0.0',
    createdAt: '2026-08-18T00:00:00Z',
    evidenceRefs: [],
  };
}

describe('3D GCS Residual Equations', () => {
  it('should evaluate point coincidence residual', () => {
    const p1 = { x: 10, y: 5, z: 2 };
    const p2 = { x: 10, y: 5, z: 2 };
    const p3 = { x: 12, y: 5, z: 1 };

    expect(Constraint3DResidual.coincident(p1, p2)).toEqual([0, 0, 0]);
    expect(Constraint3DResidual.coincident(p1, p3)).toEqual([-2, 0, 1]);
  });

  it('should evaluate point-on-line residual', () => {
    const pOn = { x: 0, y: 0, z: 5 };
    const pOff = { x: 2, y: 0, z: 5 };
    const origin = { x: 0, y: 0, z: 0 };
    const direction = { x: 0, y: 0, z: 1 };

    expect(Constraint3DResidual.pointOnLine(pOn, origin, direction)).toEqual([0, 0, 0]);
    expect(Constraint3DResidual.pointOnLine(pOff, origin, direction)).toEqual([0, -2, 0]);
  });

  it('should evaluate point-on-plane residual', () => {
    const pOn = { x: 10, y: 0, z: 10 };
    const pOff = { x: 10, y: 5, z: 10 };
    const origin = { x: 0, y: 0, z: 0 };
    const normal = { x: 0, y: 1, z: 0 };

    expect(Constraint3DResidual.pointOnPlane(pOn, origin, normal)).toBe(0);
    expect(Constraint3DResidual.pointOnPlane(pOff, origin, normal)).toBe(5);
  });

  it('should evaluate distance residual', () => {
    const p1 = { x: 0, y: 0, z: 0 };
    const p2 = { x: 0, y: 3, z: 4 }; // actual distance = 5

    expect(Constraint3DResidual.distance(p1, p2, 5)).toBeCloseTo(0, 7);
    expect(Constraint3DResidual.distance(p1, p2, 2)).toBeCloseTo(3, 7);
  });

  it('should evaluate parallel and perpendicular residuals', () => {
    const d1 = { x: 1, y: 0, z: 0 };
    const d2 = { x: 1, y: 0, z: 0 };
    const d3 = { x: 0, y: 1, z: 0 };

    // Parallel d1 and d2
    expect(Constraint3DResidual.parallel(d1, d2)).toEqual([0, 0, 0]);
    // Parallel d1 and d3 should not be zero
    const resPar = Constraint3DResidual.parallel(d1, d3);
    expect(resPar[2]).not.toBe(0);

    // Perpendicular d1 and d3
    expect(Constraint3DResidual.perpendicular(d1, d3)).toBe(0);
    // Perpendicular d1 and d2
    expect(Constraint3DResidual.perpendicular(d1, d2)).toBe(1);
  });

  it('should evaluate tangent sphere and plane residual', () => {
    const center = { x: 0, y: 5, z: 0 };
    const radius = 5;
    const planeOrigin = { x: 0, y: 0, z: 0 };
    const planeNormal = { x: 0, y: 1, z: 0 };

    // Distance from center to plane is 5. Radius is 5. Expect 0
    expect(Constraint3DResidual.tangentSpherePlane(center, radius, planeOrigin, planeNormal)).toBe(0);

    // Distance from center to plane is 5. Radius is 3. Expect 2
    expect(Constraint3DResidual.tangentSpherePlane(center, 3, planeOrigin, planeNormal)).toBe(2);
  });
});

describe('Composite 3D GCS Evaluator', () => {
  it('should evaluate list of multiple constraints successfully', () => {
    const p1: Geometry3DEntity = {
      id: createIdentity('p1'),
      type: 'POINT_3D',
      geometry: {
        type: 'POINT_3D',
        data: { x: 2, y: 3, z: 4 },
      },
      provenance: createProvenance('p1'),
    };

    const p2: Geometry3DEntity = {
      id: createIdentity('p2'),
      type: 'POINT_3D',
      geometry: {
        type: 'POINT_3D',
        data: { x: 5, y: 3, z: 4 },
      },
      provenance: createProvenance('p2'),
    };

    const model: Model3D = {
      id: createIdentity('model-1'),
      entities: [p1, p2],
      version: 1,
    };

    const system = new Constraint3DSystem(model);

    // Constraint 1: Coincident on Y and Z (implicitly distance X = 3)
    // Constraint 2: Distance constraint of 3
    const c1: Constraint3D = {
      id: createIdentity('c1'),
      type: 'COINCIDENT_3D',
      modelId: createIdentity('model-1'),
      references: [
        { entityId: createIdentity('p1'), target: 'ENTITY' },
        { entityId: createIdentity('p2'), target: 'ENTITY' },
      ],
      parameters: {},
      driving: true,
      provenance: createProvenance('c1'),
    };

    const c2: Constraint3D = {
      id: createIdentity('c2'),
      type: 'DISTANCE_3D',
      modelId: createIdentity('model-1'),
      references: [
        { entityId: createIdentity('p1'), target: 'ENTITY' },
        { entityId: createIdentity('p2'), target: 'ENTITY' },
      ],
      parameters: { value: 3 },
      driving: true,
      provenance: createProvenance('c2'),
    };

    const residuals = Constraint3DEvaluator.evaluate(system, [c1, c2]);
    // Coincident residuals: p1.x - p2.x = -3, p1.y - p2.y = 0, p1.z - p2.z = 0
    // Distance residual: 3 - 3 = 0
    expect(residuals).toEqual([-3, 0, 0, 0]);
  });
});
