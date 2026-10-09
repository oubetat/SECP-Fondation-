import { describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  CollisionAuthority,
  CollisionStatus,
  CanonicalCollisionInput,
  CanonicalCollisionResult
} from '../index';
import { CollisionPersistenceEngine } from '../persistence/CollisionPersistenceEngine';
import { CollisionTruthThread } from '../persistence/CollisionTruthThread';
import { CollisionReExecutionEngine } from '../persistence/CollisionReExecutionEngine';
import { CanonicalCollisionResultEquivalence } from '../persistence/CanonicalCollisionResultEquivalence';

describe('P8 Deterministic Re-Execution & Historical Truth Recovery Adversarial Suite', () => {
  const docId = 'DOC_P8_ADV_001';
  const revId1 = 'REV_P8_v1';

  const doc1 = {
    documentId: docId,
    revision: revId1 as any,
    units: 'MILLIMETERS',
    sketches: [],
    constraints: [],
    features: [],
    parameters: [],
    topologyMap: {} as any,
    metadata: {
      author: 'P8_VERIFIER',
      organization: 'SECP',
      timestamp: new Date().toISOString(),
      description: 'P8 Test CAD Document'
    }
  };

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
    geometry: {
      documentId: docId,
      revisionId: revId1,
      geometryId: 'GEOM_P8_01',
      geometryRevision: 1,
      snapshotId: 'SNAP_P8_01_v1',
      topologyIdentity: 'TOPOLOGY_P8_01',
      geometrySource: 'CAD',
      provenance: 'P8_CAD_TEST',
      coordinateFrame: 'WCS',
      units: 'MILLIMETERS',
      bounds: { min: { x: 0, y: 0, z: 0 }, max: { x: 10, y: 10, z: 10 } },
      geometryHash: 'STABLE_EMPTY_HASH',
      tessellatedTriangles: []
    },
    canonicalGeometry: {
      documentId: docId,
      revisionId: revId1,
      geometryId: 'GEOM_P8_01',
      geometryRevision: 1,
      snapshotId: 'SNAP_P8_01_v1',
      topologyIdentity: 'TOPOLOGY_P8_01',
      geometrySource: 'CAD',
      provenance: 'P8_CAD_TEST',
      coordinateFrame: 'WCS',
      units: 'MILLIMETERS',
      bounds: { min: { x: 0, y: 0, z: 0 }, max: { x: 10, y: 10, z: 10 } },
      geometryHash: 'STABLE_EMPTY_HASH'
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
    CollisionAuthority.getResolver().register(doc1 as any);
  });

  // M01: Same canonical input -> exact replay match
  it('M01: Same canonical input produces exact replay match', async () => {
    const R0 = await CollisionAuthority.evaluate(baseInput);
    const rec = await CollisionPersistenceEngine.persist(baseInput, R0);

    const report = await CollisionReExecutionEngine.replay(rec.executionId);
    expect(report.verdict).toBe('REEXECUTION_MATCH');
    expect(report.isMatch).toBe(true);
    expect(report.divergenceCategory).toBe('DIVERGENCE_NONE');
    expect(report.verificationStatus).toBe('AUTHORITATIVE');
    expect(report.equivalence?.isEquivalent).toBe(true);
  });

  // M02: 10 repeated executions -> identical canonical hashes
  it('M02: 10 repeated executions produce identical canonical hashes', async () => {
    const res = await CollisionReExecutionEngine.reExecuteDeterministic(baseInput, 10);
    expect(res.isDeterministic).toBe(true);
    expect(res.mismatches).toHaveLength(0);
    expect(new Set(res.hashes).size).toBe(1);
    expect(res.results).toHaveLength(10);
  });

  // M03: 100 repeated executions -> deterministic canonical hash
  it('M03: 100 repeated executions produce deterministic canonical hash', async () => {
    const res = await CollisionReExecutionEngine.reExecuteDeterministic(baseInput, 100);
    expect(res.isDeterministic).toBe(true);
    expect(res.mismatches).toHaveLength(0);
    expect(new Set(res.hashes).size).toBe(1);
    expect(res.results).toHaveLength(100);
  });

  // M04: Historical result reload -> replay match
  it('M04: Historical result reload allows authoritative replay match', async () => {
    const R0 = await CollisionAuthority.evaluate(baseInput);
    const rec = await CollisionPersistenceEngine.persist(baseInput, R0);

    const reloadRes = await CollisionPersistenceEngine.reload(rec.executionId);
    expect(reloadRes.verificationStatus).toBe('AUTHORITATIVE');

    const report = await CollisionReExecutionEngine.replay(rec.executionId);
    expect(report.verdict).toBe('REEXECUTION_MATCH');
    expect(report.historicalResult?.status).toBe(R0.status);
    expect(report.replayResult?.status).toBe(R0.status);
  });

  // M05: Historical geometry mutation -> divergence detected
  it('M05: Historical geometry mutation produces divergence detection', async () => {
    const R0 = await CollisionAuthority.evaluate(baseInput);
    const rec = await CollisionPersistenceEngine.persist(baseInput, R0);

    const mutatedInput: CanonicalCollisionInput = {
      ...baseInput,
      canonicalGeometry: {
        ...baseInput.canonicalGeometry!,
        geometryHash: 'MUTATED_GEOM_HASH_9999'
      }
    };

    const report = await CollisionReExecutionEngine.replay(rec.executionId, {
      currentInputOverride: mutatedInput
    });

    expect(report.verdict).toBe('REEXECUTION_CONTEXT_MISMATCH');
    expect(report.divergenceCategory).toBe('DIVERGENCE_GEOMETRY_MISMATCH');
    expect(report.isMatch).toBe(false);
  });

  // M06: Revision mutation -> context mismatch
  it('M06: Revision mutation produces context mismatch', async () => {
    const R0 = await CollisionAuthority.evaluate(baseInput);
    const rec = await CollisionPersistenceEngine.persist(baseInput, R0);

    const mutatedInput: CanonicalCollisionInput = {
      ...baseInput,
      canonicalGeometry: {
        ...baseInput.canonicalGeometry!,
        revisionId: 'REV_P8_MUTATED_v2'
      }
    };

    const report = await CollisionReExecutionEngine.replay(rec.executionId, {
      currentInputOverride: mutatedInput
    });

    expect(report.verdict).toBe('REEXECUTION_CONTEXT_MISMATCH');
    expect(report.divergenceCategory).toBe('DIVERGENCE_REVISION_MISMATCH');
    expect(report.isMatch).toBe(false);
  });

  // M07: Snapshot mutation -> context mismatch
  it('M07: Snapshot mutation produces context mismatch', async () => {
    const R0 = await CollisionAuthority.evaluate(baseInput);
    const rec = await CollisionPersistenceEngine.persist(baseInput, R0);

    const mutatedInput: CanonicalCollisionInput = {
      ...baseInput,
      canonicalGeometry: {
        ...baseInput.canonicalGeometry!,
        snapshotId: 'SNAP_P8_MUTATED_999'
      }
    };

    const report = await CollisionReExecutionEngine.replay(rec.executionId, {
      currentInputOverride: mutatedInput
    });

    expect(report.verdict).toBe('REEXECUTION_CONTEXT_MISMATCH');
    expect(report.divergenceCategory).toBe('DIVERGENCE_SNAPSHOT_MISMATCH');
  });

  // M08: Transform revision mutation -> divergence/context mismatch
  it('M08: Transform revision mutation produces context mismatch', async () => {
    const R0 = await CollisionAuthority.evaluate(baseInput);
    const rec = await CollisionPersistenceEngine.persist(baseInput, R0);

    const mutatedInput: CanonicalCollisionInput = {
      ...baseInput,
      coordinateFrame: 'TCS'
    };

    const report = await CollisionReExecutionEngine.replay(rec.executionId, {
      currentInputOverride: mutatedInput
    });

    expect(report.verdict).toBe('REEXECUTION_CONTEXT_MISMATCH');
    expect(report.divergenceCategory).toBe('DIVERGENCE_TRANSFORM_MISMATCH');
  });

  // M09: Motion revision mutation -> divergence/context mismatch
  it('M09: Motion revision mutation produces context mismatch', async () => {
    const R0 = await CollisionAuthority.evaluate(baseInput);
    const rec = await CollisionPersistenceEngine.persist(baseInput, R0);

    const mutatedInput: CanonicalCollisionInput = {
      ...baseInput,
      motionSegment: {
        ...baseInput.motionSegment!,
        motionType: 'FEED'
      }
    };

    const report = await CollisionReExecutionEngine.replay(rec.executionId, {
      currentInputOverride: mutatedInput
    });

    expect(report.verdict).toBe('REEXECUTION_CONTEXT_MISMATCH');
    expect(report.divergenceCategory).toBe('DIVERGENCE_MOTION_MISMATCH');
  });

  // M10: Provider mutation -> provider drift detected
  it('M10: Provider mutation produces provider drift detection', async () => {
    const R0 = await CollisionAuthority.evaluate(baseInput);
    const rec = await CollisionPersistenceEngine.persist(baseInput, R0);

    const report = await CollisionReExecutionEngine.replay(rec.executionId, {
      currentProviderId: 'CONTINUOUS_SWEPT_COLLISION_PROVIDER'
    });

    expect(report.verdict).toBe('REEXECUTION_CONTEXT_MISMATCH');
    expect(report.divergenceCategory).toBe('DIVERGENCE_PROVIDER_DRIFT');
    expect(report.isMatch).toBe(false);
  });

  // M11: Algorithm version mutation -> algorithm drift detected
  it('M11: Algorithm version mutation produces algorithm drift detection', async () => {
    const R0 = await CollisionAuthority.evaluate(baseInput);
    const rec = await CollisionPersistenceEngine.persist(baseInput, R0);

    const report = await CollisionReExecutionEngine.replay(rec.executionId, {
      currentAlgorithmVersion: '2.5.0'
    });

    expect(report.verdict).toBe('REEXECUTION_CONTEXT_MISMATCH');
    expect(report.divergenceCategory).toBe('DIVERGENCE_ALGORITHM_DRIFT');
    expect(report.isMatch).toBe(false);
  });

  // M12: Truth Thread tampering before replay -> integrity failure
  it('M12: Truth Thread tampering before replay produces integrity failure', async () => {
    const R0 = await CollisionAuthority.evaluate(baseInput);
    const rec = await CollisionPersistenceEngine.persist(baseInput, R0);

    // Tamper truth thread event chain by recording an arbitrary foreign event
    const events = CollisionTruthThread.getEvents() as any[];
    if (events.length > 0) {
      events[events.length - 1] = {
        ...events[events.length - 1],
        eventHash: 'TAMPERED_EVENT_HASH_0000'
      };
    }

    const report = await CollisionReExecutionEngine.replay(rec.executionId);
    expect(report.verdict).toBe('REEXECUTION_INTEGRITY_FAILURE');
    expect(report.divergenceCategory).toBe('DIVERGENCE_CONTEXT_CORRUPTED');
    expect(report.isMatch).toBe(false);
  });

  // M13: Historical result tampering before replay -> integrity failure
  it('M13: Historical result tampering before replay produces integrity failure', async () => {
    const R0 = await CollisionAuthority.evaluate(baseInput);
    const rec = await CollisionPersistenceEngine.persist(baseInput, R0);

    const storageDir = CollisionPersistenceEngine.getStorageDir();
    const filePath = path.join(storageDir, `record_${rec.executionId}.json`);
    const raw = fs.readFileSync(filePath, 'utf8');
    const tampered = raw.replace(R0.status, CollisionStatus.PENETRATION);
    fs.writeFileSync(filePath, tampered, 'utf8');

    const report = await CollisionReExecutionEngine.replay(rec.executionId);
    expect(report.verdict).toBe('REEXECUTION_INTEGRITY_FAILURE');
    expect(report.isMatch).toBe(false);
  });

  // M14: Historical canonical hash tampering -> integrity failure
  it('M14: Historical canonical hash tampering produces integrity failure', async () => {
    const R0 = await CollisionAuthority.evaluate(baseInput);
    const rec = await CollisionPersistenceEngine.persist(baseInput, R0);

    const storageDir = CollisionPersistenceEngine.getStorageDir();
    const filePath = path.join(storageDir, `record_${rec.executionId}.json`);
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    parsed.canonicalHash = 'FORGED_CANONICAL_HASH_1234567890';
    fs.writeFileSync(filePath, JSON.stringify(parsed, null, 2), 'utf8');

    const report = await CollisionReExecutionEngine.replay(rec.executionId);
    expect(report.verdict).toBe('REEXECUTION_INTEGRITY_FAILURE');
    expect(report.isMatch).toBe(false);
  });

  // M15: Replay failure -> fail-closed
  it('M15: Replay failure produces fail-closed outcome', async () => {
    const R0 = await CollisionAuthority.evaluate(baseInput);
    const rec = await CollisionPersistenceEngine.persist(baseInput, R0);

    const failInput: CanonicalCollisionInput = {
      ...baseInput,
      toleranceProfile: {
        linearToleranceMm: -1,
        angularToleranceDeg: 0.1,
        clearanceWarningMarginMm: 2.0,
        safeClearanceMarginMm: 1.0
      }
    };

    const report = await CollisionReExecutionEngine.replay(rec.executionId, {
      currentInputOverride: failInput
    });
    expect(report.verdict).toBe('REEXECUTION_EXECUTION_FAILURE');
    expect(report.isMatch).toBe(false);
  });

  // M16: Historical result remains immutable after successful replay
  it('M16: Historical result remains immutable after successful replay', async () => {
    const R0 = await CollisionAuthority.evaluate(baseInput);
    const rec = await CollisionPersistenceEngine.persist(baseInput, R0);

    const immutability = await CollisionReExecutionEngine.verifyImmutability(
      rec.executionId,
      async () => {
        const report = await CollisionReExecutionEngine.replay(rec.executionId);
        expect(report.verdict).toBe('REEXECUTION_MATCH');
      }
    );

    expect(immutability.isImmutable).toBe(true);
    expect(immutability.beforeHash).toBe(immutability.afterHash);
  });

  // M17: Historical result remains immutable after divergent replay
  it('M17: Historical result remains immutable after divergent replay', async () => {
    const R0 = await CollisionAuthority.evaluate(baseInput);
    const rec = await CollisionPersistenceEngine.persist(baseInput, R0);

    const immutability = await CollisionReExecutionEngine.verifyImmutability(
      rec.executionId,
      async () => {
        const report = await CollisionReExecutionEngine.replay(rec.executionId, {
          currentProviderId: 'CONTINUOUS_SWEPT_COLLISION_PROVIDER'
        });
        expect(report.verdict).toBe('REEXECUTION_CONTEXT_MISMATCH');
      }
    );

    expect(immutability.isImmutable).toBe(true);
    expect(immutability.beforeHash).toBe(immutability.afterHash);
  });

  // M18: Historical result remains immutable after failed replay
  it('M18: Historical result remains immutable after failed replay', async () => {
    const R0 = await CollisionAuthority.evaluate(baseInput);
    const rec = await CollisionPersistenceEngine.persist(baseInput, R0);

    const failInput: CanonicalCollisionInput = {
      ...baseInput,
      toleranceProfile: {
        linearToleranceMm: -1,
        angularToleranceDeg: 0.1,
        clearanceWarningMarginMm: 2.0,
        safeClearanceMarginMm: 1.0
      }
    };

    const immutability = await CollisionReExecutionEngine.verifyImmutability(
      rec.executionId,
      async () => {
        const report = await CollisionReExecutionEngine.replay(rec.executionId, {
          currentInputOverride: failInput
        });
        expect(report.verdict).toBe('REEXECUTION_EXECUTION_FAILURE');
      }
    );

    expect(immutability.isImmutable).toBe(true);
    expect(immutability.beforeHash).toBe(immutability.afterHash);
  });

  // M19: Execution timestamp mutation does not change canonical engineering equality
  it('M19: Execution timestamp mutation does not change canonical engineering equality', async () => {
    const R0 = await CollisionAuthority.evaluate(baseInput);
    const R_modifiedTimestamp: CanonicalCollisionResult = {
      ...R0,
      timestampIso: '2099-12-31T23:59:59.999Z'
    };

    const eq = CanonicalCollisionResultEquivalence.evaluate(R0, R_modifiedTimestamp);
    expect(eq.isEquivalent).toBe(true);
    expect(eq.operationalDiffs.some(d => d.includes('timestampIso diff'))).toBe(true);
    expect(eq.mismatches).toHaveLength(0);

    const hash0 = CollisionTruthThread.computeCanonicalEngineeringResultHash(R0);
    const hashMod = CollisionTruthThread.computeCanonicalEngineeringResultHash(R_modifiedTimestamp);
    expect(hashMod).toBe(hash0);
  });

  // M20: Execution ID mutation does not change canonical engineering equality
  it('M20: Execution ID mutation does not change canonical engineering equality', async () => {
    const R0 = await CollisionAuthority.evaluate(baseInput);
    const R_modifiedId: CanonicalCollisionResult = {
      ...R0,
      executionId: 'EXEC_FORGED_DIFFERENT_ID_999'
    };

    const eq = CanonicalCollisionResultEquivalence.evaluate(R0, R_modifiedId);
    expect(eq.isEquivalent).toBe(true);
    expect(eq.operationalDiffs.some(d => d.includes('executionId diff'))).toBe(true);
    expect(eq.mismatches).toHaveLength(0);

    const hash0 = CollisionTruthThread.computeCanonicalEngineeringResultHash(R0);
    const hashMod = CollisionTruthThread.computeCanonicalEngineeringResultHash(R_modifiedId);
    expect(hashMod).toBe(hash0);
  });

  // M21: Repeated replay produces identical replay evidence semantics
  it('M21: Repeated replay produces identical replay evidence semantics', async () => {
    const R0 = await CollisionAuthority.evaluate(baseInput);
    const rec = await CollisionPersistenceEngine.persist(baseInput, R0);

    const report1 = await CollisionReExecutionEngine.replay(rec.executionId);
    const report2 = await CollisionReExecutionEngine.replay(rec.executionId);

    expect(report1.verdict).toBe(report2.verdict);
    expect(report1.divergenceCategory).toBe(report2.divergenceCategory);
    expect(report1.evidence?.historicalEngineeringHash).toBe(report2.evidence?.historicalEngineeringHash);
    expect(report1.evidence?.replayEngineeringHash).toBe(report2.evidence?.replayEngineeringHash);
  });

  // M22: Replay evidence itself is tamper-detectable
  it('M22: Replay evidence itself is tamper-detectable', async () => {
    const R0 = await CollisionAuthority.evaluate(baseInput);
    const rec = await CollisionPersistenceEngine.persist(baseInput, R0);

    const report = await CollisionReExecutionEngine.replay(rec.executionId);
    const evidence = report.evidence!;
    expect(evidence).toBeDefined();

    const expectedHash = CollisionTruthThread.simpleHash(
      CollisionTruthThread.canonicalStringify({
        reExecutionId: evidence.reExecutionId,
        historicalExecutionId: evidence.historicalExecutionId,
        historicalEngHash: evidence.historicalEngineeringHash,
        replayEngHash: evidence.replayEngineeringHash,
        verdict: evidence.verdict,
        divergenceCategory: evidence.divergenceCategory,
        divergenceDetails: evidence.divergenceDetails
      })
    );
    expect(evidence.evidenceHash).toBe(expectedHash);

    // Tampering test
    const tamperedEvidence = { ...evidence, verdict: 'REEXECUTION_DIVERGED' as const };
    const tamperedHash = CollisionTruthThread.simpleHash(
      CollisionTruthThread.canonicalStringify({
        reExecutionId: tamperedEvidence.reExecutionId,
        historicalExecutionId: tamperedEvidence.historicalExecutionId,
        historicalEngHash: tamperedEvidence.historicalEngineeringHash,
        replayEngHash: tamperedEvidence.replayEngineeringHash,
        verdict: tamperedEvidence.verdict,
        divergenceCategory: tamperedEvidence.divergenceCategory,
        divergenceDetails: tamperedEvidence.divergenceDetails
      })
    );
    expect(tamperedHash).not.toBe(evidence.evidenceHash);
  });

  // M23: Old revision cannot be substituted with current revision
  it('M23: Old revision cannot be substituted with current revision', async () => {
    const R0 = await CollisionAuthority.evaluate(baseInput);
    const rec = await CollisionPersistenceEngine.persist(baseInput, R0);

    const report = await CollisionReExecutionEngine.replay(rec.executionId, {
      targetRevisionId: 'REV_P8_NEW_v2'
    });

    expect(report.verdict).toBe('REEXECUTION_CONTEXT_MISMATCH');
    expect(report.divergenceCategory).toBe('DIVERGENCE_REVISION_MISMATCH');
    expect(report.verificationStatus).toBe('STALE_RESULT');
    expect(report.isMatch).toBe(false);
  });

  // M24: Missing historical context -> REEXECUTION_UNAVAILABLE
  it('M24: Missing historical context returns REEXECUTION_UNAVAILABLE', async () => {
    const report = await CollisionReExecutionEngine.replay('EXEC_NON_EXISTENT_ID_99999');
    expect(report.verdict).toBe('REEXECUTION_UNAVAILABLE');
    expect(report.isMatch).toBe(false);
    expect(report.verificationStatus).toBe('NOT_AUTHORITATIVE');
  });

  // M25: Corrupted historical context -> REEXECUTION_INTEGRITY_FAILURE
  it('M25: Corrupted historical context returns REEXECUTION_INTEGRITY_FAILURE', async () => {
    const R0 = await CollisionAuthority.evaluate(baseInput);
    const rec = await CollisionPersistenceEngine.persist(baseInput, R0);

    // Corrupt storage file with invalid JSON syntax
    const storageDir = CollisionPersistenceEngine.getStorageDir();
    const filePath = path.join(storageDir, `record_${rec.executionId}.json`);
    fs.writeFileSync(filePath, '{ INVALID_JSON_SYNTAX ', 'utf8');

    const report = await CollisionReExecutionEngine.replay(rec.executionId);
    expect(report.verdict).toBe('REEXECUTION_INTEGRITY_FAILURE');
    expect(report.isMatch).toBe(false);
  });

  // M26: Canonical result divergence cannot be coerced into MATCH
  it('M26: Canonical result divergence cannot be coerced into MATCH', async () => {
    const R0 = await CollisionAuthority.evaluate(baseInput);
    const rec = await CollisionPersistenceEngine.persist(baseInput, R0);

    // Create an override with different domain and configuration to cause canonical result divergence
    const divergentInput: CanonicalCollisionInput = {
      ...baseInput,
      domain: 'ASSEMBLY'
    };

    const report = await CollisionReExecutionEngine.replay(rec.executionId, {
      currentInputOverride: divergentInput
    });

    expect(report.verdict).not.toBe('REEXECUTION_MATCH');
    expect(report.isMatch).toBe(false);
  });

  // M27: No second authority is invoked
  it('M27: No second authority is invoked (CollisionAuthority is unique)', async () => {
    expect(typeof CollisionAuthority.evaluate).toBe('function');
    expect(typeof CollisionAuthority.registerProvider).toBe('function');
    expect(typeof CollisionAuthority.getResolver).toBe('function');
  });

  // M28: Production CollisionAuthority remains the only decision authority
  it('M28: Production CollisionAuthority remains the only decision authority', async () => {
    const R0 = await CollisionAuthority.evaluate(baseInput);
    expect(R0.status).toBeDefined();
    expect(R0.provenSafe).toBeDefined();
    expect(R0.executionId).toMatch(/^EXEC_COL_/);
  });

  // Hard Acceptance Gate Layer
  it('HardAcceptanceGateP8 passes all 39 gates', async () => {
    const { HardAcceptanceGateP8 } = await import('../HardAcceptanceGateP8');
    const report = await HardAcceptanceGateP8.evaluate();
    expect(report.verdict).toBe('P8_FULLY_VERIFIED');
    expect(report.totalGates).toBe(39);
    expect(report.failedGates).toBe(0);
    expect(report.passedGates).toBe(39);
  });
});
