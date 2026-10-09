/**
 * SECP Industrial OS v3 — Collision Authority Core
 * Hard Acceptance Gate P6 — P7 Truth Thread Identity Compatibility Test
 */

import { describe, it, expect } from 'vitest';
import { CollisionAuthority, CollisionStatus } from '../index';
import { CanonicalGeometryAdapter } from '../adapters/CanonicalGeometryAdapter';
import { CamFiveAxisCollisionProvider } from '../adapters/CanonicalDomainProviders';
import { ProductionCollisionManager } from '../production/ProductionCollisionManager';
import { ProductionCollisionCommand } from '../production/ProductionCollisionTypes';
import { DEFAULT_UNIT_SYSTEM_MM, EngineeringDocument } from '../../cad-kernel/document/CADDocument';

describe('Hard Acceptance Gate P6 — P7 Truth Thread Identity Compatibility', () => {
  it('P6 runtime trace produces complete identity record compatible with P7 Truth Thread', () => {
    CollisionAuthority.ensureDefaultProviders();
    const resolver = CollisionAuthority.getResolver();

    const docP7: EngineeringDocument = {
      documentId: 'DOC_P7_COMPAT_01',
      revision: 1,
      name: 'P7 Identity Test Part',
      units: DEFAULT_UNIT_SYSTEM_MM,
      sketches: [],
      constraints: [],
      features: [],
      parameters: [],
      topologyMap: { version: 1 },
      derived: {
        geometryHash: 'HASH_P7_COMPAT_999',
        topologyHash: 'TOPO_P7_COMPAT_999',
        mesh: {
          vertices: new Float32Array([-10, -10, -10, 10, 10, 10]),
          indices: new Uint32Array([0, 1, 2]),
          boundingBox: { min: { x: -10, y: -10, z: -10 }, max: { x: 10, y: 10, z: 10 } }
        }
      },
      evidence: []
    };

    resolver.register(docP7);
    const geo = CanonicalGeometryAdapter.adapt(docP7);

    const cmd: ProductionCollisionCommand = {
      commandId: 'CMD_P7_COMPAT_001',
      executionId: 'EXEC_P7_COMPAT_001',
      documentId: 'DOC_P7_COMPAT_01',
      revisionId: '1',
      geometryIds: [geo.geometryId],
      snapshotIds: [geo.snapshotId],
      transformRevision: 'TR_REV_1',
      motionId: 'MOTION_P7_001',
      coordinateFrame: 'WCS',
      units: 'MILLIMETERS',
      requestedAnalysis: 'CAM_MULTI_AXIS',
      caller: {
        componentId: 'ProductionEngine::CAMPipeline',
        componentName: 'CAM Toolpath Engine',
        sessionId: 'SESSION_P7_001',
        role: 'ENGINEER'
      },
      requestedAt: new Date().toISOString(),
      authorityVersion: '3.0.0'
    };

    const result = ProductionCollisionManager.executeProductionCommand(cmd, CamFiveAxisCollisionProvider.PROVIDER_ID);

    // Verify all 15 P7 Truth Thread Identity fields exist and are non-empty
    expect(result.executionId).toBeTruthy();
    expect(result.commandId).toBe('CMD_P7_COMPAT_001');
    expect(result.resultId).toBeTruthy();
    expect(result.documentId).toBe('DOC_P7_COMPAT_01');
    expect(result.revisionId).toBe('1');
    expect(result.geometryId).toBe(geo.geometryId);
    expect(result.snapshotId).toBe(geo.snapshotId);
    expect(result.geometryHash).toBe(geo.geometryHash);
    expect(result.transformRevision).toBe('TR_REV_1');
    expect(result.motionId).toBe('MOTION_P7_001');
    expect(result.authorityId).toBe('CollisionAuthority@3.0.0-SECP');
    expect(result.providerId).toBe('CAM_FIVE_AXIS_COLLISION_PROVIDER');
    expect(result.algorithmVersion).toBeTruthy();
    expect(result.verificationState).toBe('PROVEN_SAFE');
    expect(result.timestampIso).toBeTruthy();
  });
});
