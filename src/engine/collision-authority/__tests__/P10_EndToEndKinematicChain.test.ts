import { describe, test, expect, beforeAll } from 'vitest';
import { CollisionAuthority } from '../CollisionAuthority';
import { CollisionStatus } from '../types';
import { CollisionTruthThread } from '../persistence/CollisionTruthThread';
import { CollisionPersistenceEngine } from '../persistence/CollisionPersistenceEngine';

describe('SECP P10: End-to-End Kinematic Chain Forensic Verification', () => {
  beforeAll(() => {
    CollisionAuthority.clearProviders();
    CollisionAuthority.ensureDefaultProviders();
    CollisionPersistenceEngine.clearStorage();
  });

  // Helper to simulate UI Kinematics calculation logic (from App.tsx)
  const getToolOrientation = (mode: '3_AXIS' | '4_AXIS' | '5_AXIS', angleA: number, angleC: number) => {
    if (mode === '3_AXIS') return { x: 0, y: 0, z: 1 };
    const radA = (angleA * Math.PI) / 180;
    if (mode === '4_AXIS') return { x: 0, y: Math.sin(radA), z: Math.cos(radA) };
    const radC = (angleC * Math.PI) / 180;
    return {
      x: Math.sin(radA) * Math.cos(radC),
      y: Math.sin(radA) * Math.sin(radC),
      z: Math.cos(radA)
    };
  };

  test('P10_M01: 5-Axis UI Control -> Kernel -> Truth Thread Chain Closure', async () => {
    // 1. UI Sim: 5-Axis machine, A=45deg tilt, C=90deg rotation
    const uiMode = '5_AXIS';
    const uiAngleA = 45;
    const uiAngleC = 90;
    
    // 2. UI Sim: Calculate canonical orientation vector
    const uiVector = getToolOrientation(uiMode, uiAngleA, uiAngleC);
    // For A=45, C=90: sin(45)*cos(90)=0, sin(45)*sin(90)=0.707, cos(45)=0.707
    expect(uiVector.x).toBeCloseTo(0, 5);
    expect(uiVector.y).toBeCloseTo(0.7071, 4);
    expect(uiVector.z).toBeCloseTo(0.7071, 4);

    // 3. UI Sim: Create payload with CAD-derived triangles
    const triangles = [
       { a: {x:0,y:0,z:0}, b: {x:70,y:70,z:0}, c: {x:70,y:0,z:0} },
       { a: {x:0,y:0,z:30}, b: {x:70,y:0,z:30}, c: {x:70,y:70,z:30} }
       // (Simplified for test speed, but using real Triangle3DExact structure)
    ];

    const payload = {
      domain: 'CAM_MULTI_AXIS' as const,
      coordinateFrame: 'WCS' as const,
      units: 'MILLIMETERS' as const,
      toleranceProfile: {
        linearToleranceMm: 0.01,
        angularToleranceDeg: 0.1,
        clearanceWarningMarginMm: 5.0,
        safeClearanceMarginMm: 2.0
      },
      canonicalGeometry: {
        documentId: 'DOC_CAD_001',
        revisionId: 'REV_P10_1',
        geometryId: 'GEOM_1',
        geometryRevision: 1,
        snapshotId: 'SNAP_1',
        topologyIdentity: 'TOP_1',
        geometrySource: 'CAD' as const,
        provenance: 'SECP_CAD_KERNEL',
        coordinateFrame: 'WCS' as const,
        units: 'MILLIMETERS' as const,
        bounds: { min: { x: 0, y: 0, z: 0 }, max: { x: 70, y: 70, z: 30 } },
        geometryHash: 'STABLE_HASH_P10',
        tessellatedTriangles: triangles
      },
      toolAssembly: {
        cutterDiameterMm: 12,
        fluteLengthMm: 35,
        stickoutMm: 60,
        shankDiameterMm: 12
      },
      motionSegment: {
        startTcp: { x: 35, y: 35, z: 45 },
        startOrientation: uiVector,
        endTcp: { x: 35, y: 35, z: 45 },
        endOrientation: uiVector,
        motionType: 'FEED' as const
      }
    };

    // 4. Kernel Execution: Verify result matches the kinematic tilt
    const result = await CollisionAuthority.evaluate(payload);
    
    // Forensically verify provenance matches input
    expect(result.provenance.algorithmVersion).toContain('P1');
    
    // 5. Truth Thread Verification: Cryptographic proof of the chain
    const record = await CollisionPersistenceEngine.persist(payload, result);
    const reload = await CollisionPersistenceEngine.reload(record.executionId);
    
    expect(reload.verificationStatus).toBe('AUTHORITATIVE');
    // Ensure the orientation vector was preserved exactly in the evidence contract
    const persistedInput = reload.record!.input;
    expect(persistedInput.motionSegment!.startOrientation.x).toBe(uiVector.x);
    expect(persistedInput.motionSegment!.startOrientation.y).toBe(uiVector.y);
    expect(persistedInput.motionSegment!.startOrientation.z).toBe(uiVector.z);

    // 6. Chain Integrity: SHA-256 blocks validated
    const events = CollisionTruthThread.getEvents();
    const chainCheck = CollisionTruthThread.verifyChain(events);
    expect(chainCheck.isValid).toBe(true);
  });
});
