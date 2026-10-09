/**
 * SECP CAD Kernel — GCS 3D Model Tests
 * Phase 2 (PATCH-026)
 */

import { describe, it, expect } from 'vitest';
import { Model3D, Geometry3DEntity } from '../Constraint3DTypes';
import { Constraint3D } from '../Constraint3DModel';
import { Constraint3DValidator } from '../Constraint3DValidator';
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

describe('3D GCS Model and Validator Verification', () => {
  it('should pass validation on a correct model with Point, Line, and Plane', () => {
    const p1: Geometry3DEntity = {
      id: createIdentity('point-1'),
      type: 'POINT_3D',
      geometry: {
        type: 'POINT_3D',
        data: { x: 10, y: 20, z: 30 },
      },
      provenance: createProvenance('point-1'),
    };

    const l1: Geometry3DEntity = {
      id: createIdentity('line-1'),
      type: 'LINE_3D',
      geometry: {
        type: 'LINE_3D',
        data: {
          origin: { x: 0, y: 0, z: 0 },
          direction: { x: 0, y: 0, z: 1 },
        },
      },
      provenance: createProvenance('line-1'),
    };

    const plane1: Geometry3DEntity = {
      id: createIdentity('plane-1'),
      type: 'PLANE',
      geometry: {
        type: 'PLANE',
        data: {
          origin: { x: 0, y: 0, z: 0 },
          normal: { x: 0, y: 1, z: 0 },
          xDir: { x: 1, y: 0, z: 0 },
        },
      },
      provenance: createProvenance('plane-1'),
    };

    const model: Model3D = {
      id: createIdentity('model-1'),
      entities: [p1, l1, plane1],
      version: 1,
    };

    const c1: Constraint3D = {
      id: createIdentity('constraint-1'),
      type: 'COINCIDENT_3D',
      modelId: createIdentity('model-1'),
      references: [
        { entityId: createIdentity('point-1'), target: 'ENTITY' },
        { entityId: createIdentity('line-1'), target: 'ORIGIN' },
      ],
      parameters: {},
      driving: true,
      provenance: createProvenance('constraint-1'),
    };

    const res = Constraint3DValidator.validate(model, [c1]);
    expect(res.valid).toBe(true);
    expect(res.diagnostics.length).toBe(0);
  });

  it('should detect duplicate constraint IDs', () => {
    const model: Model3D = {
      id: createIdentity('model-1'),
      entities: [],
      version: 1,
    };

    const c1: Constraint3D = {
      id: createIdentity('c1'),
      type: 'DISTANCE_3D',
      modelId: createIdentity('model-1'),
      references: [],
      parameters: { value: 10 },
      driving: true,
      provenance: createProvenance('c1'),
    };

    const c2: Constraint3D = {
      id: createIdentity('c1'), // Duplicate ID
      type: 'DISTANCE_3D',
      modelId: createIdentity('model-1'),
      references: [],
      parameters: { value: 20 },
      driving: true,
      provenance: createProvenance('c1'),
    };

    const res = Constraint3DValidator.validate(model, [c1, c2]);
    expect(res.valid).toBe(false);
    expect(res.diagnostics.some(d => d.code === 'DUPLICATE_CONSTRAINT_ID')).toBe(true);
  });

  it('should detect negative radius on Circles, Cylinders, and Spheres', () => {
    const circle: Geometry3DEntity = {
      id: createIdentity('circle-bad'),
      type: 'CIRCLE_3D',
      geometry: {
        type: 'CIRCLE_3D',
        data: {
          center: { x: 0, y: 0, z: 0 },
          normal: { x: 0, y: 0, z: 1 },
          radius: -5, // Invalid!
        },
      },
      provenance: createProvenance('circle-bad'),
    };

    const model: Model3D = {
      id: createIdentity('model-1'),
      entities: [circle],
      version: 1,
    };

    const res = Constraint3DValidator.validate(model, []);
    expect(res.valid).toBe(false);
    expect(res.diagnostics.some(d => d.code === 'NEGATIVE_RADIUS')).toBe(true);
  });

  it('should detect non-finite geometric values', () => {
    const badPoint: Geometry3DEntity = {
      id: createIdentity('point-bad'),
      type: 'POINT_3D',
      geometry: {
        type: 'POINT_3D',
        data: { x: NaN, y: 0, z: 0 }, // Invalid!
      },
      provenance: createProvenance('point-bad'),
    };

    const model: Model3D = {
      id: createIdentity('model-1'),
      entities: [badPoint],
      version: 1,
    };

    const res = Constraint3DValidator.validate(model, []);
    expect(res.valid).toBe(false);
    expect(res.diagnostics.some(d => d.code === 'NON_FINITE_PARAMETER')).toBe(true);
  });
});
