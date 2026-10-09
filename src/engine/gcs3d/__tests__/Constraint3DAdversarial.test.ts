/**
 * SECP CAD Kernel — GCS 3D Adversarial and Robustness Tests
 * Phase 2 (PATCH-026)
 */

import { describe, it, expect } from 'vitest';
import { Model3D, Geometry3DEntity } from '../Constraint3DTypes';
import { Constraint3D } from '../Constraint3DModel';
import { Constraint3DSolver } from '../Constraint3DSolver';
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

describe('3D GCS Solver Robustness & Adversarial Checks', () => {
  it('should gracefully handle contradictory distance constraints without crashing', () => {
    // Fixed point 1
    const p1: Geometry3DEntity = {
      id: createIdentity('p1'),
      type: 'POINT_3D',
      geometry: { type: 'POINT_3D', data: { x: 0, y: 0, z: 0 } },
      provenance: createProvenance('p1'),
    };

    // Free point 2
    const p2: Geometry3DEntity = {
      id: createIdentity('p2'),
      type: 'POINT_3D',
      geometry: { type: 'POINT_3D', data: { x: 2, y: 0, z: 0 } },
      provenance: createProvenance('p2'),
    };

    const model: Model3D = {
      id: createIdentity('model-1'),
      entities: [p1, p2],
      version: 1,
    };

    const cFix: Constraint3D = {
      id: createIdentity('c-fix'),
      type: 'FIX_3D',
      modelId: createIdentity('model-1'),
      references: [{ entityId: createIdentity('p1'), target: 'ENTITY' }],
      parameters: { value: 0 },
      driving: true,
      provenance: createProvenance('c-fix'),
    };
    (cFix.parameters as any).valueY = 0;
    (cFix.parameters as any).valueZ = 0;

    // Constraint: distance = 5
    const cDist1: Constraint3D = {
      id: createIdentity('c-dist-1'),
      type: 'DISTANCE_3D',
      modelId: createIdentity('model-1'),
      references: [
        { entityId: createIdentity('p2'), target: 'ENTITY' },
        { entityId: createIdentity('p1'), target: 'ENTITY' },
      ],
      parameters: { value: 5 },
      driving: true,
      provenance: createProvenance('c-dist-1'),
    };

    // Contradictory Constraint: distance = 10
    const cDist2: Constraint3D = {
      id: createIdentity('c-dist-2'),
      type: 'DISTANCE_3D',
      modelId: createIdentity('model-1'),
      references: [
        { entityId: createIdentity('p2'), target: 'ENTITY' },
        { entityId: createIdentity('p1'), target: 'ENTITY' },
      ],
      parameters: { value: 10 },
      driving: true,
      provenance: createProvenance('c-dist-2'),
    };

    const result = Constraint3DSolver.solve(model, [cFix, cDist1, cDist2], { maxIterations: 10 });

    // Should fail convergence but complete execution without a fatal crash
    expect(result.converged).toBe(false);
    expect(result.diagnostics.some(d => d.code === 'NOT_CONVERGED')).toBe(true);
  });

  it('should reject degenerate direction vectors in lines during validation', () => {
    const badLine: Geometry3DEntity = {
      id: createIdentity('line-degenerate'),
      type: 'LINE_3D',
      geometry: {
        type: 'LINE_3D',
        data: {
          origin: { x: 0, y: 0, z: 0 },
          direction: { x: 0, y: 0, z: 0 }, // Degenerate / zero length direction
        },
      },
      provenance: createProvenance('line-degenerate'),
    };

    const model: Model3D = {
      id: createIdentity('model-2'),
      entities: [badLine],
      version: 1,
    };

    const result = Constraint3DSolver.solve(model, []);
    expect(result.success).toBe(false);
    expect(result.diagnostics.some(d => d.code === 'ZERO_DIRECTION_VECTOR')).toBe(true);
  });

  it('should reject non-finite parameters in geometry during validation', () => {
    const badPoint: Geometry3DEntity = {
      id: createIdentity('point-nan'),
      type: 'POINT_3D',
      geometry: {
        type: 'POINT_3D',
        data: { x: NaN, y: 0, z: 0 },
      },
      provenance: createProvenance('point-nan'),
    };

    const model: Model3D = {
      id: createIdentity('model-3'),
      entities: [badPoint],
      version: 1,
    };

    const result = Constraint3DSolver.solve(model, []);
    expect(result.success).toBe(false);
    expect(result.diagnostics.some(d => d.code === 'NON_FINITE_PARAMETER')).toBe(true);
  });
});
