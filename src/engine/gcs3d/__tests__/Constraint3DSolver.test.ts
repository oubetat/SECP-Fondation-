/**
 * SECP CAD Kernel — GCS 3D Solver Numerical Tests
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

describe('3D GCS Solver Core Convergence Mappings', () => {
  it('should solve a simple COINCIDENT_3D constraint between a free point and a fixed point', () => {
    // Fixed point at (10, 20, 30)
    const pFixed: Geometry3DEntity = {
      id: createIdentity('p-fixed'),
      type: 'POINT_3D',
      geometry: { type: 'POINT_3D', data: { x: 10, y: 20, z: 30 } },
      provenance: createProvenance('p-fixed'),
    };

    // Free point starting at (0, 0, 0)
    const pFree: Geometry3DEntity = {
      id: createIdentity('p-free'),
      type: 'POINT_3D',
      geometry: { type: 'POINT_3D', data: { x: 0, y: 0, z: 0 } },
      provenance: createProvenance('p-free'),
    };

    const model: Model3D = {
      id: createIdentity('model-1'),
      entities: [pFixed, pFree],
      version: 1,
    };

    const cFix: Constraint3D = {
      id: createIdentity('c-fix'),
      type: 'FIX_3D',
      modelId: createIdentity('model-1'),
      references: [{ entityId: createIdentity('p-fixed'), target: 'ENTITY' }],
      parameters: { value: 10 }, // fix valueX
      driving: true,
      provenance: createProvenance('c-fix'),
    };
    // Let's also attach additional parameter properties to fully bind the FIX constraint
    (cFix.parameters as any).valueY = 20;
    (cFix.parameters as any).valueZ = 30;

    const cCoin: Constraint3D = {
      id: createIdentity('c-coin'),
      type: 'COINCIDENT_3D',
      modelId: createIdentity('model-1'),
      references: [
        { entityId: createIdentity('p-free'), target: 'ENTITY' },
        { entityId: createIdentity('p-fixed'), target: 'ENTITY' },
      ],
      parameters: {},
      driving: true,
      provenance: createProvenance('c-coin'),
    };

    const result = Constraint3DSolver.solve(model, [cFix, cCoin]);

    expect(result.success).toBe(true);
    expect(result.converged).toBe(true);

    const solvedFree = result.model.entities.find(e => e.id.identityId === 'p-free')!;
    const solvedFreeData = solvedFree.geometry.data as any;

    expect(solvedFreeData.x).toBeCloseTo(10, 5);
    expect(solvedFreeData.y).toBeCloseTo(20, 5);
    expect(solvedFreeData.z).toBeCloseTo(30, 5);
  });

  it('should solve a DISTANCE_3D constraint between a fixed point and a free point', () => {
    // Fixed point at origin
    const pOrigin: Geometry3DEntity = {
      id: createIdentity('p-origin'),
      type: 'POINT_3D',
      geometry: { type: 'POINT_3D', data: { x: 0, y: 0, z: 0 } },
      provenance: createProvenance('p-origin'),
    };

    // Free point starting at (3, 0, 0)
    const pFree: Geometry3DEntity = {
      id: createIdentity('p-free'),
      type: 'POINT_3D',
      geometry: { type: 'POINT_3D', data: { x: 3, y: 0, z: 0 } },
      provenance: createProvenance('p-free'),
    };

    const model: Model3D = {
      id: createIdentity('model-2'),
      entities: [pOrigin, pFree],
      version: 1,
    };

    const cFix: Constraint3D = {
      id: createIdentity('c-fix'),
      type: 'FIX_3D',
      modelId: createIdentity('model-2'),
      references: [{ entityId: createIdentity('p-origin'), target: 'ENTITY' }],
      parameters: { value: 0 },
      driving: true,
      provenance: createProvenance('c-fix'),
    };
    (cFix.parameters as any).valueY = 0;
    (cFix.parameters as any).valueZ = 0;

    // Constrain distance to be exactly 10
    const cDist: Constraint3D = {
      id: createIdentity('c-dist'),
      type: 'DISTANCE_3D',
      modelId: createIdentity('model-2'),
      references: [
        { entityId: createIdentity('p-free'), target: 'ENTITY' },
        { entityId: createIdentity('p-origin'), target: 'ENTITY' },
      ],
      parameters: { value: 10 },
      driving: true,
      provenance: createProvenance('c-dist'),
    };

    const result = Constraint3DSolver.solve(model, [cFix, cDist]);

    expect(result.success).toBe(true);
    expect(result.converged).toBe(true);

    const solvedFree = result.model.entities.find(e => e.id.identityId === 'p-free')!;
    const solvedFreeData = solvedFree.geometry.data as any;

    const actualDist = Math.sqrt(solvedFreeData.x ** 2 + solvedFreeData.y ** 2 + solvedFreeData.z ** 2);
    expect(actualDist).toBeCloseTo(10, 5);
  });

  it('should solve a POINT_ON_LINE_3D constraint', () => {
    // Fixed Line along X axis
    const lineX: Geometry3DEntity = {
      id: createIdentity('line-x'),
      type: 'LINE_3D',
      geometry: {
        type: 'LINE_3D',
        data: {
          origin: { x: 0, y: 0, z: 0 },
          direction: { x: 1, y: 0, z: 0 },
        },
      },
      provenance: createProvenance('line-x'),
    };

    // Free point starting off the line at (5, 3, -4)
    const pFree: Geometry3DEntity = {
      id: createIdentity('p-free'),
      type: 'POINT_3D',
      geometry: { type: 'POINT_3D', data: { x: 5, y: 3, z: -4 } },
      provenance: createProvenance('p-free'),
    };

    const model: Model3D = {
      id: createIdentity('model-3'),
      entities: [lineX, pFree],
      version: 1,
    };

    const cFixLineOrigin: Constraint3D = {
      id: createIdentity('c-fix-line-origin'),
      type: 'FIX_3D',
      modelId: createIdentity('model-3'),
      references: [{ entityId: createIdentity('line-x'), target: 'ORIGIN' }],
      parameters: { value: 0 },
      driving: true,
      provenance: createProvenance('c-fix-line-origin'),
    };
    (cFixLineOrigin.parameters as any).valueY = 0;
    (cFixLineOrigin.parameters as any).valueZ = 0;

    const cFixLineDir: Constraint3D = {
      id: createIdentity('c-fix-line-dir'),
      type: 'FIX_3D',
      modelId: createIdentity('model-3'),
      references: [{ entityId: createIdentity('line-x'), target: 'DIRECTION' }],
      parameters: { value: 1 },
      driving: true,
      provenance: createProvenance('c-fix-line-dir'),
    };
    (cFixLineDir.parameters as any).valueY = 0;
    (cFixLineDir.parameters as any).valueZ = 0;

    const cLine: Constraint3D = {
      id: createIdentity('c-line'),
      type: 'POINT_ON_LINE_3D',
      modelId: createIdentity('model-3'),
      references: [
        { entityId: createIdentity('p-free'), target: 'ENTITY' },
        { entityId: createIdentity('line-x'), target: 'ENTITY' },
      ],
      parameters: {},
      driving: true,
      provenance: createProvenance('c-line'),
    };

    const result = Constraint3DSolver.solve(model, [cFixLineOrigin, cFixLineDir, cLine]);

    expect(result.success).toBe(true);

    const solvedFree = result.model.entities.find(e => e.id.identityId === 'p-free')!;
    const solvedFreeData = solvedFree.geometry.data as any;

    // Point should end up on the X axis (Y and Z both 0)
    expect(solvedFreeData.y).toBeCloseTo(0, 5);
    expect(solvedFreeData.z).toBeCloseTo(0, 5);
  });

  it('should solve a POINT_ON_PLANE_3D constraint', () => {
    // Fixed Plane at Z = 0 (XY plane)
    const planeXY: Geometry3DEntity = {
      id: createIdentity('plane-xy'),
      type: 'PLANE',
      geometry: {
        type: 'PLANE',
        data: {
          origin: { x: 0, y: 0, z: 0 },
          normal: { x: 0, y: 0, z: 1 },
          xDir: { x: 1, y: 0, z: 0 },
        },
      },
      provenance: createProvenance('plane-xy'),
    };

    // Free point starting off the plane at (12, -4, 9.5)
    const pFree: Geometry3DEntity = {
      id: createIdentity('p-free'),
      type: 'POINT_3D',
      geometry: { type: 'POINT_3D', data: { x: 12, y: -4, z: 9.5 } },
      provenance: createProvenance('p-free'),
    };

    const model: Model3D = {
      id: createIdentity('model-4'),
      entities: [planeXY, pFree],
      version: 1,
    };

    const cFixPlaneOrigin: Constraint3D = {
      id: createIdentity('c-fix-plane-origin'),
      type: 'FIX_3D',
      modelId: createIdentity('model-4'),
      references: [{ entityId: createIdentity('plane-xy'), target: 'ORIGIN' }],
      parameters: { value: 0 },
      driving: true,
      provenance: createProvenance('c-fix-plane-origin'),
    };
    (cFixPlaneOrigin.parameters as any).valueY = 0;
    (cFixPlaneOrigin.parameters as any).valueZ = 0;

    const cFixPlaneNormal: Constraint3D = {
      id: createIdentity('c-fix-plane-normal'),
      type: 'FIX_3D',
      modelId: createIdentity('model-4'),
      references: [{ entityId: createIdentity('plane-xy'), target: 'NORMAL' }],
      parameters: { value: 0 },
      driving: true,
      provenance: createProvenance('c-fix-plane-normal'),
    };
    (cFixPlaneNormal.parameters as any).valueY = 0;
    (cFixPlaneNormal.parameters as any).valueZ = 1;

    const cPlane: Constraint3D = {
      id: createIdentity('c-plane'),
      type: 'POINT_ON_PLANE_3D',
      modelId: createIdentity('model-4'),
      references: [
        { entityId: createIdentity('p-free'), target: 'ENTITY' },
        { entityId: createIdentity('plane-xy'), target: 'ENTITY' },
      ],
      parameters: {},
      driving: true,
      provenance: createProvenance('c-plane'),
    };

    const result = Constraint3DSolver.solve(model, [cFixPlaneOrigin, cFixPlaneNormal, cPlane]);

    expect(result.success).toBe(true);

    const solvedFree = result.model.entities.find(e => e.id.identityId === 'p-free')!;
    const solvedFreeData = solvedFree.geometry.data as any;

    // Z coordinate must become 0
    expect(solvedFreeData.z).toBeCloseTo(0, 5);
  });
});
