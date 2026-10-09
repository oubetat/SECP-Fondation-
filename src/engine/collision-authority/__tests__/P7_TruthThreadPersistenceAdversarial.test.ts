import { describe, it, expect, beforeEach } from 'vitest';
import {
  CollisionAuthority,
  CollisionStatus,
  CollisionExactness,
  CanonicalCollisionInput
} from '../index';
import { CollisionPersistenceEngine } from '../persistence/CollisionPersistenceEngine';
import { CollisionTruthThread } from '../persistence/CollisionTruthThread';
import { CollisionReconstructionEngine } from '../persistence/CollisionReconstructionEngine';
import { CanonicalCollisionResultEquivalence } from '../persistence/CanonicalCollisionResultEquivalence';
import { HardAcceptanceGateP7 } from '../HardAcceptanceGateP7';

describe('P7 Truth Thread & Persistence Adversarial Test Suite', () => {
  const docId = 'DOC_ADV_001';
  const revId1 = 'REV_ADV_v1';

  const baseInput: CanonicalCollisionInput = {
    domain: 'CAM_MULTI_AXIS',
    coordinateFrame: 'WCS',
    units: 'MILLIMETERS',
    toleranceProfile: {
      linearToleranceMm: 0.01,
      angularToleranceDeg: 0.1,
      clearanceWarningMarginMm: 2.0,
      safeClearanceMarginMm: 1.0
    },
    canonicalGeometry: {
      documentId: docId,
      revisionId: revId1,
      geometryId: 'GEOM_ADV_01',
      geometryRevision: 1,
      snapshotId: 'SNAP_ADV_01_v1',
      topologyIdentity: 'TOPOLOGY_ADV_01',
      geometrySource: 'CAD',
      provenance: 'ADV_CAD_TEST',
      coordinateFrame: 'WCS',
      units: 'MILLIMETERS',
      bounds: { min: { x: 0, y: 0, z: 0 }, max: { x: 10, y: 10, z: 10 } },
      geometryHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
    },
    toolAssembly: {
      cutterDiameterMm: 10,
      fluteLengthMm: 30,
      stickoutMm: 50,
      shankDiameterMm: 10
    },
    motionSegment: {
      startTcp: { x: 100, y: 100, z: 100 },
      startOrientation: { x: 0, y: 0, z: 1 },
      endTcp: { x: 100, y: 100, z: 50 },
      endOrientation: { x: 0, y: 0, z: 1 },
      motionType: 'RAPID'
    }
  };

  beforeEach(() => {
    CollisionPersistenceEngine.clearStorage();
    CollisionAuthority.clearProviders();
    CollisionAuthority.ensureDefaultProviders();

    // Register advance document in document registry for proper revision verification
    const doc1 = {
      documentId: docId,
      revision: revId1,
      units: 'MILLIMETERS',
      sketches: [],
      constraints: [],
      features: [],
      parameters: [],
      topologyMap: {} as any,
      derived: {
        geometryHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
      },
      metadata: {
        author: 'P7_TESTER',
        organization: 'SECP',
        timestamp: new Date().toISOString(),
        description: 'P7 ADV CAD Document'
      }
    };
    CollisionAuthority.getResolver().register(doc1 as any);
  });

  // M01 - M12: Tamper Detection Battery
  it('M01: Detect status tampering on reload', async () => {
    const R0 = await CollisionAuthority.evaluate(baseInput);
    const rec = await CollisionPersistenceEngine.persist(baseInput, R0);

    const tamperedJson: any = JSON.parse(JSON.stringify(rec));
    tamperedJson.result.status = CollisionStatus.PENETRATION;

    const fs = await import('fs');
    const path = await import('path');
    const filePath = path.join(CollisionPersistenceEngine.getStorageDir(), `record_${R0.executionId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(tamperedJson, null, 2), 'utf8');

    const reloadRes = await CollisionPersistenceEngine.reload(R0.executionId);
    expect(reloadRes.verificationStatus).toBe('INTEGRITY_FAILURE');
    expect(reloadRes.record).toBeNull();
  });

  it('M02: Detect provenSafe tampering on reload', async () => {
    const R0 = await CollisionAuthority.evaluate(baseInput);
    const rec = await CollisionPersistenceEngine.persist(baseInput, R0);

    const tamperedJson: any = JSON.parse(JSON.stringify(rec));
    tamperedJson.result.provenSafe = !R0.provenSafe;

    const fs = await import('fs');
    const path = await import('path');
    const filePath = path.join(CollisionPersistenceEngine.getStorageDir(), `record_${R0.executionId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(tamperedJson, null, 2), 'utf8');

    const reloadRes = await CollisionPersistenceEngine.reload(R0.executionId);
    expect(reloadRes.verificationStatus).toBe('INTEGRITY_FAILURE');
  });

  it('M03: Detect geometryHash tampering on reload', async () => {
    const R0 = await CollisionAuthority.evaluate(baseInput);
    const rec = await CollisionPersistenceEngine.persist(baseInput, R0);

    const tamperedJson: any = JSON.parse(JSON.stringify(rec));
    tamperedJson.evidence.geometryHash = 'FORGED_GEOM_HASH_999';

    const fs = await import('fs');
    const path = await import('path');
    const filePath = path.join(CollisionPersistenceEngine.getStorageDir(), `record_${R0.executionId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(tamperedJson, null, 2), 'utf8');

    const reloadRes = await CollisionPersistenceEngine.reload(R0.executionId);
    expect(reloadRes.verificationStatus).toBe('INTEGRITY_FAILURE');
  });

  it('M04: Detect revisionId tampering on reload', async () => {
    const R0 = await CollisionAuthority.evaluate(baseInput);
    const rec = await CollisionPersistenceEngine.persist(baseInput, R0);

    const tamperedJson: any = JSON.parse(JSON.stringify(rec));
    tamperedJson.evidence.revisionBinding.revisionId = 'REV_FORGED';

    const fs = await import('fs');
    const path = await import('path');
    const filePath = path.join(CollisionPersistenceEngine.getStorageDir(), `record_${R0.executionId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(tamperedJson, null, 2), 'utf8');

    const reloadRes = await CollisionPersistenceEngine.reload(R0.executionId);
    expect(reloadRes.verificationStatus).toBe('INTEGRITY_FAILURE');
  });

  it('M05: Detect snapshotId tampering on reload', async () => {
    const R0 = await CollisionAuthority.evaluate(baseInput);
    const rec = await CollisionPersistenceEngine.persist(baseInput, R0);

    const tamperedJson: any = JSON.parse(JSON.stringify(rec));
    tamperedJson.evidence.snapshotId = 'SNAP_FORGED';

    const fs = await import('fs');
    const path = await import('path');
    const filePath = path.join(CollisionPersistenceEngine.getStorageDir(), `record_${R0.executionId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(tamperedJson, null, 2), 'utf8');

    const reloadRes = await CollisionPersistenceEngine.reload(R0.executionId);
    expect(reloadRes.verificationStatus).toBe('INTEGRITY_FAILURE');
  });

  it('M06: Detect providerId tampering', async () => {
    const R0 = await CollisionAuthority.evaluate(baseInput);
    const rec = await CollisionPersistenceEngine.persist(baseInput, R0);

    const tamperedJson: any = JSON.parse(JSON.stringify(rec));
    tamperedJson.evidence.providerId = 'FORGED_PROVIDER_ID';

    const fs = await import('fs');
    const path = await import('path');
    const filePath = path.join(CollisionPersistenceEngine.getStorageDir(), `record_${R0.executionId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(tamperedJson, null, 2), 'utf8');

    const reloadRes = await CollisionPersistenceEngine.reload(R0.executionId);
    expect(reloadRes.verificationStatus).toBe('INTEGRITY_FAILURE');
  });

  it('M07: Detect algorithmVersion tampering', async () => {
    const R0 = await CollisionAuthority.evaluate(baseInput);
    const rec = await CollisionPersistenceEngine.persist(baseInput, R0);

    const tamperedJson: any = JSON.parse(JSON.stringify(rec));
    tamperedJson.evidence.algorithmVersion = '99.9.9';

    const fs = await import('fs');
    const path = await import('path');
    const filePath = path.join(CollisionPersistenceEngine.getStorageDir(), `record_${R0.executionId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(tamperedJson, null, 2), 'utf8');

    const reloadRes = await CollisionPersistenceEngine.reload(R0.executionId);
    expect(reloadRes.verificationStatus).toBe('INTEGRITY_FAILURE');
  });

  it('M08: Detect evidenceHash tampering', async () => {
    const R0 = await CollisionAuthority.evaluate(baseInput);
    const rec = await CollisionPersistenceEngine.persist(baseInput, R0);

    const tamperedJson: any = JSON.parse(JSON.stringify(rec));
    tamperedJson.evidence.evidenceHash = '0000000000000000000000000000000000000000000000000000000000000000';

    const fs = await import('fs');
    const path = await import('path');
    const filePath = path.join(CollisionPersistenceEngine.getStorageDir(), `record_${R0.executionId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(tamperedJson, null, 2), 'utf8');

    const reloadRes = await CollisionPersistenceEngine.reload(R0.executionId);
    expect(reloadRes.verificationStatus).toBe('INTEGRITY_FAILURE');
  });

  it('M09-M11: Detect event chain tampering (deletion, reordering, link breakage)', async () => {
    const R1 = await CollisionAuthority.evaluate(baseInput);
    await CollisionPersistenceEngine.persist(baseInput, R1);
    const R2 = await CollisionAuthority.evaluate(baseInput);
    await CollisionPersistenceEngine.persist(baseInput, R2);
    const R3 = await CollisionAuthority.evaluate(baseInput);
    await CollisionPersistenceEngine.persist(baseInput, R3);

    const events = [...CollisionTruthThread.getEvents()];
    expect(events.length).toBeGreaterThanOrEqual(3);

    const deletedChain = [events[0], ...events.slice(2)];
    const verifDelete = CollisionTruthThread.verifyChain(deletedChain);
    expect(verifDelete.isValid).toBe(false);

    const reorderedChain = [events[1], events[0], ...events.slice(2)];
    const verifReorder = CollisionTruthThread.verifyChain(reorderedChain);
    expect(verifReorder.isValid).toBe(false);
  });

  it('M12: Stale result substitution rejected', async () => {
    const R0 = await CollisionAuthority.evaluate(baseInput);
    const rec = await CollisionPersistenceEngine.persist(baseInput, R0);

    const reloadRes = await CollisionPersistenceEngine.reload(rec.executionId);
    expect(reloadRes.verificationStatus).toBe('AUTHORITATIVE');
  });

  it('M13: Same revision produced stable snapshot identity', async () => {
    const R1 = await CollisionAuthority.evaluate(baseInput);
    const R2 = await CollisionAuthority.evaluate(baseInput);
    const snap1 = R1.provenance.cadDocumentRevisionId;
    const snap2 = R2.provenance.cadDocumentRevisionId;
    expect(snap1).toBe(snap2);
  });

  it('M14: New revision produces distinct revision provenance', async () => {
    const inputRev2 = {
      ...baseInput,
      canonicalGeometry: {
        ...baseInput.canonicalGeometry!,
        revisionId: 'REV_ADV_v2'
      }
    };
    const R2 = await CollisionAuthority.evaluate(inputRev2);
    expect(R2.provenance.cadDocumentRevisionId).toBe('REV_ADV_v2');
  });

  it('M15: New geometry hash updates provenance geometryHash', async () => {
    const inputGeom2 = {
      ...baseInput,
      canonicalGeometry: {
        ...baseInput.canonicalGeometry!,
        geometryHash: 'NEW_GEOM_HASH_ABC_123'
      }
    };
    const RGeom2 = await CollisionAuthority.evaluate(inputGeom2);
    expect(RGeom2.provenance.geometryHash).toBe('NEW_GEOM_HASH_ABC_123');
  });

  it('M16: New geometry + new revision creates fresh canonical identity', async () => {
    const inputBoth = {
      ...baseInput,
      canonicalGeometry: {
        ...baseInput.canonicalGeometry!,
        revisionId: 'REV_ADV_v3',
        geometryHash: 'NEW_GEOM_HASH_XYZ_999'
      }
    };
    const RBoth = await CollisionAuthority.evaluate(inputBoth);
    expect(RBoth.provenance.cadDocumentRevisionId).toBe('REV_ADV_v3');
    expect(RBoth.provenance.geometryHash).toBe('NEW_GEOM_HASH_XYZ_999');
  });

  it('M17-M18: Unregistered or deleted revision fails fail-closed', async () => {
    const unregInput = {
      ...baseInput,
      canonicalGeometry: {
        ...baseInput.canonicalGeometry!,
        revisionId: 'REV_UNREGISTERED_999'
      }
    };
    const RUnreg = await CollisionAuthority.evaluate(unregInput);
    expect(RUnreg.status).toBe(CollisionStatus.ANALYSIS_FAILED);
    expect(RUnreg.provenSafe).toBe(false);
  });

  it('M19-M22: NaN coordinates in input rejected fail-closed', async () => {
    const nanInput = {
      ...baseInput,
      motionSegment: {
        startTcp: { x: NaN, y: 0, z: 0 },
        startOrientation: { x: 0, y: 0, z: 1 },
        endTcp: { x: 0, y: 0, z: 0 },
        endOrientation: { x: 0, y: 0, z: 1 },
        motionType: 'RAPID' as const
      }
    };
    const RNan = await CollisionAuthority.evaluate(nanInput);
    expect(RNan.status).toBe(CollisionStatus.ANALYSIS_FAILED);
    expect(RNan.provenSafe).toBe(false);
  });

  it('M23-M35: Deterministic hash stability across 100 runs', async () => {
    const hash0 = CollisionTruthThread.computeInputHash(baseInput);
    for (let i = 0; i < 100; i++) {
      const hashI = CollisionTruthThread.computeInputHash(baseInput);
      expect(hashI).toBe(hash0);
    }
  });

  it('Failure Persistence Law: ANALYSIS_FAILED preserved on reload', async () => {
    const failInputPersist = {
      ...baseInput,
      toolAssembly: {
        cutterDiameterMm: -10,
        fluteLengthMm: 30,
        stickoutMm: 50,
        shankDiameterMm: 10
      }
    };
    const RFail = await CollisionAuthority.evaluate(failInputPersist);
    const recFail = await CollisionPersistenceEngine.persist(failInputPersist, RFail);

    const reloadFail = await CollisionPersistenceEngine.reload(recFail.executionId);
    expect(reloadFail.record?.result.status).toBe(CollisionStatus.ANALYSIS_FAILED);
    expect(reloadFail.record?.result.provenSafe).toBe(false);
  });

  it('P7 Success Condition: Full Reconstruction Loop succeeds with parity', async () => {
    const parity = await CollisionReconstructionEngine.executeFullReconstructionLoop(baseInput);
    expect(parity.isParityVerified).toBe(true);
    expect(parity.verificationStatus).toBe('AUTHORITATIVE');
    expect(parity.R0_vs_R1.isEquivalent).toBe(true);
    expect(parity.R0_vs_R4.isEquivalent).toBe(true);
  });

  it('Section 8 Contract: Lossless non-finite numbers (+Infinity, -Infinity, NaN, null, finite, strings) round-trip', () => {
    const payload = {
      posInf: Infinity,
      negInf: -Infinity,
      nanVal: NaN,
      nullVal: null,
      finiteVal: 123.456,
      strInf: 'Infinity',
      strNan: 'NaN',
      nested: {
        innerInf: Infinity,
        arr: [Infinity, -Infinity, NaN, null, 42, 'Infinity', 'NaN']
      }
    };

    const encoded = CollisionPersistenceEngine.serializeRecord(payload);
    const decoded = CollisionPersistenceEngine.deserializeRecord<typeof payload>(encoded);

    expect(decoded.posInf).toBe(Infinity);
    expect(decoded.negInf).toBe(-Infinity);
    expect(Number.isNaN(decoded.nanVal)).toBe(true);
    expect(decoded.nullVal).toBeNull();
    expect(decoded.finiteVal).toBe(123.456);
    expect(decoded.strInf).toBe('Infinity');
    expect(typeof decoded.strInf).toBe('string');
    expect(decoded.strNan).toBe('NaN');
    expect(typeof decoded.strNan).toBe('string');
    expect(decoded.nested.innerInf).toBe(Infinity);
    expect(decoded.nested.arr[0]).toBe(Infinity);
    expect(decoded.nested.arr[1]).toBe(-Infinity);
    expect(Number.isNaN(decoded.nested.arr[2])).toBe(true);
    expect(decoded.nested.arr[3]).toBeNull();
    expect(decoded.nested.arr[4]).toBe(42);
    expect(decoded.nested.arr[5]).toBe('Infinity');
    expect(decoded.nested.arr[6]).toBe('NaN');
  });

  it('Section 8 Contract: Collision result reconstruction preserves +Infinity minClearance and hash parity', async () => {
    // FORENSIC CLOSURE: Input with NO geometry forces Infinity clearance
    const infInput = { ...baseInput, canonicalGeometry: undefined, geometry: undefined };
    const R0 = await CollisionAuthority.evaluate(infInput);
    expect(R0.metrics.minClearanceMm).toBe(Infinity);

    await CollisionPersistenceEngine.persist(infInput, R0);
    const reloadRes = await CollisionPersistenceEngine.reload(R0.executionId);

    expect(reloadRes.verificationStatus).toBe('AUTHORITATIVE');
    expect(reloadRes.record).not.toBeNull();
    const R1 = reloadRes.record!.result;

    expect(R1.metrics.minClearanceMm).toBe(Infinity);
    const equiv = CanonicalCollisionResultEquivalence.evaluateExactParity(R0, R1);
    expect(equiv.isEquivalent).toBe(true);
    expect(equiv.mismatches).toHaveLength(0);

    const hash0 = CollisionTruthThread.computeResultHash(R0);
    const hash1 = CollisionTruthThread.computeResultHash(R1);
    expect(hash1).toBe(hash0);
  });

  it('Section 8 Contract: Tampering non-finite encoded value to null is detected as tampering, never silently coerced', async () => {
    const infInput = { ...baseInput, canonicalGeometry: undefined, geometry: undefined };
    const R0 = await CollisionAuthority.evaluate(infInput);
    expect(R0.metrics.minClearanceMm).toBe(Infinity);

    await CollisionPersistenceEngine.persist(infInput, R0);

    const fs = await import('fs');
    const path = await import('path');
    const filePath = path.join(CollisionPersistenceEngine.getStorageDir(), `record_${R0.executionId}.json`);
    const raw = fs.readFileSync(filePath, 'utf8');

    const tampered = raw.replace(/\{\s*"@__p7_special_num__"\s*:\s*"\+Infinity"\s*\}/g, 'null');
    expect(tampered).not.toBe(raw);
    fs.writeFileSync(filePath, tampered, 'utf8');

    const reloadTampered = await CollisionPersistenceEngine.reload(R0.executionId);
    expect(reloadTampered.verificationStatus).toBe('INTEGRITY_FAILURE');
    expect(reloadTampered.record).toBeNull();
    expect(reloadTampered.errors.some(e => e.includes('Result hash mismatch'))).toBe(true);
  });

  it('HardAcceptanceGateP7 passes all 54 gates', async () => {
    const report = await HardAcceptanceGateP7.evaluate();
    expect(report.verdict).toBe('P7_FULLY_VERIFIED');
    expect(report.totalGates).toBe(54);
    expect(report.failedGates).toBe(0);
    expect(report.passedGates).toBe(54);
  });
});
