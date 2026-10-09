
import { describe, it, expect, beforeEach } from 'vitest';
import { CollisionAuthority } from '../CollisionAuthority';
import { 
  CollisionStatus, 
  CanonicalCollisionInput 
} from '../types';
import { DocumentEvaluator } from '../../cad-kernel/document/DocumentEvaluator';
import { EngineeringDocument } from '../../cad-kernel/document/CADDocument';
import { CollisionPersistenceEngine } from '../persistence/CollisionPersistenceEngine';
import { CollisionTruthThread } from '../persistence/CollisionTruthThread';
import { CollisionReExecutionEngine } from '../persistence/CollisionReExecutionEngine';

describe('Physical Truth Path Integration Proof', () => {
  beforeEach(() => {
    CollisionPersistenceEngine.clearStorage();
    CollisionAuthority.clearProviders();
    CollisionAuthority.ensureDefaultProviders();
  });

  it('should prove a full path: Canonical Geometry -> Physical Collision -> Evidence -> Persistence -> Re-execution', async () => {
    // 1. Create a Canonical Geometry with a real mesh (a single triangle for simplicity)
    const docId = 'PHYSICAL_DOC_001';
    const revId = 'REV_1';
    
    const doc: EngineeringDocument = {
      documentId: docId,
      revision: revId,
      units: { length: 'mm', angle: 'deg' },
      derived: {
        geometryHash: 'TRIANGLE_HASH_001',
        mesh: {
          vertices: [
            0, 0, 0,
            10, 0, 0,
            0, 10, 0
          ],
          indices: [0, 1, 2]
        }
      }
    };

    // Register document in the authority's resolver
    CollisionAuthority.getResolver().register(doc);

    // 2. Define a motion segment that COLLIDES with the triangle
    // Tool is a capsule with radius 5mm
    // Triangle is at Z=0. Segment goes from Z=2 to Z=-2 (passes through triangle)
    const input: CanonicalCollisionInput = {
      domain: 'CAM_MULTI_AXIS',
      coordinateFrame: 'WCS',
      units: 'MILLIMETERS',
      toleranceProfile: {
        linearToleranceMm: 0.1,
        angularToleranceDeg: 0.5,
        clearanceWarningMarginMm: 2.0,
        safeClearanceMarginMm: 1.0
      },
      geometry: {
        documentId: docId,
        revisionId: revId,
        geometryId: 'GEOM_01',
        geometryRevision: 1,
        snapshotId: 'SNAP_01',
        topologyIdentity: 'TOP_01',
        geometrySource: 'CAD',
        provenance: 'PHYSICAL_PROOF',
        coordinateFrame: 'WCS',
        units: 'MILLIMETERS',
        bounds: { min: { x: 0, y: 0, z: 0 }, max: { x: 10, y: 10, z: 0 } },
        geometryHash: 'TRIANGLE_HASH_001'
      },
      toolAssembly: {
        cutterDiameterMm: 10, // radius = 5mm
        fluteLengthMm: 30,
        stickoutMm: 50,
        shankDiameterMm: 10
      },
      motionSegment: {
        startTcp: { x: 2, y: 2, z: 2 },
        startOrientation: { x: 0, y: 0, z: 1 },
        endTcp: { x: 2, y: 2, z: -2 },
        endOrientation: { x: 0, y: 0, z: 1 },
        motionType: 'FEED'
      }
    };

    // 3. Evaluate - Should return PENETRATION because of our new physical math
    const result = await CollisionAuthority.evaluate(input, 'EXACT_NARROW_PHASE_PROVIDER_P1');
    
    expect(result.status).toBe(CollisionStatus.PENETRATION);
    expect(result.metrics.maxPenetrationDepthMm).toBeGreaterThan(0);
    expect(result.contactManifold.length).toBeGreaterThan(0);
    expect(result.provenSafe).toBe(false);

    // 4. Persistence - Store the physical truth result
    const record = await CollisionPersistenceEngine.persist(input, result);
    expect(record.executionId).toBe(result.executionId);

    // 5. Re-execution - Prove that the physical result is deterministic
    const replayReport = await CollisionReExecutionEngine.replay(record.executionId);
    
    expect(replayReport.verdict).toBe('REEXECUTION_MATCH');
    expect(replayReport.isMatch).toBe(true);
    expect(replayReport.verificationStatus).toBe('AUTHORITATIVE');
    
    // 6. Evidence - Check that evidence contains physical metadata
    expect(replayReport.evidence?.historicalEngineeringHash).toBe(
      CollisionTruthThread.computeCanonicalEngineeringResultHash(result)
    );
  });

  it('should prove NO_COLLISION when tool is far from geometry', async () => {
    const docId = 'PHYSICAL_DOC_002';
    const revId = 'REV_1';
    
    const doc: EngineeringDocument = {
      documentId: docId,
      revision: revId,
      units: { length: 'mm', angle: 'deg' },
      derived: {
        geometryHash: 'TRIANGLE_HASH_002',
        mesh: {
          vertices: [0, 0, 0, 10, 0, 0, 0, 10, 0],
          indices: [0, 1, 2]
        }
      }
    };

    CollisionAuthority.getResolver().register(doc);

    const input: CanonicalCollisionInput = {
      domain: 'CAM_MULTI_AXIS',
      coordinateFrame: 'WCS',
      units: 'MILLIMETERS',
      toleranceProfile: { linearToleranceMm: 0.1, angularToleranceDeg: 0.5, clearanceWarningMarginMm: 2, safeClearanceMarginMm: 1 },
      geometry: {
        documentId: docId,
        revisionId: revId,
        geometryId: 'GEOM_02',
        geometryRevision: 1,
        snapshotId: 'SNAP_02',
        topologyIdentity: 'TOP_02',
        geometrySource: 'CAD',
        provenance: 'PHYSICAL_PROOF',
        coordinateFrame: 'WCS',
        units: 'MILLIMETERS',
        bounds: { min: { x: 0, y: 0, z: 0 }, max: { x: 10, y: 10, z: 0 } },
        geometryHash: 'TRIANGLE_HASH_002'
      },
      toolAssembly: { cutterDiameterMm: 10, fluteLengthMm: 30, stickoutMm: 50, shankDiameterMm: 10 },
      motionSegment: {
        startTcp: { x: 2, y: 2, z: 10 }, // 10mm away from Z=0 plane
        startOrientation: { x: 0, y: 0, z: 1 },
        endTcp: { x: 2, y: 2, z: 8 },    // 8mm away
        endOrientation: { x: 0, y: 0, z: 1 },
        motionType: 'FEED'
      }
    };

    const result = await CollisionAuthority.evaluate(input, 'EXACT_NARROW_PHASE_PROVIDER_P1');
    
    // Distance from Z=10/8 to Z=0 is 10/8. Radius is 5. 10-5 = 5mm clearance. 8-5 = 3mm clearance.
    expect(result.status).toBe(CollisionStatus.NO_COLLISION);
    expect(result.metrics.minClearanceMm).toBeCloseTo(3, 1);
    expect(result.provenSafe).toBe(true);
  });
});
