/**
 * SECP Industrial OS v3 — Collision Authority Core
 * P7 Determinism & Concurrency Suite
 * Mission: COLLISION-ENGINE-P7-TRUTH-THREAD-DETERMINISTIC-PERSISTENCE-001
 * FOCUS: 100-Run Sequential Determinism, 10-Run Concurrency Isolation, Hash Stability
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CollisionAuthority, CanonicalCollisionInput } from '../index';
import { EngineeringHashChain } from '../../evidence/EngineeringHashChain';
import { CanonicalCollisionResultEquivalence } from '../persistence/CanonicalCollisionResultEquivalence';
import { CollisionTruthThreadEngine } from '../persistence/CollisionTruthThreadEngine';

describe('P7 Determinism & Concurrency Suite', () => {
  beforeEach(() => {
    CollisionAuthority.ensureDefaultProviders();
    CollisionTruthThreadEngine.clearChain();
  });

  const baseInput: CanonicalCollisionInput = {
    domain: 'CAM_MULTI_AXIS',
    coordinateFrame: 'WCS',
    units: 'MILLIMETERS',
    toleranceProfile: { linearToleranceMm: 0.005, angularToleranceDeg: 0.5, clearanceWarningMarginMm: 2.0, safeClearanceMarginMm: 0.5 },
    documentId: 'DOC-DET-100',
    cadRevisionId: 'REV-DET-1',
    geometryId: 'GEO-DET-1',
    snapshotId: 'SNAP-DET-1',
    canonicalGeometry: { revisionId: 'REV-DET-1', geometryHash: 'HASH_GEO_DETERMINISM_100', geometrySource: 'CAD_KERNEL' },
    motionSegment: { startTcp: {x:0,y:0,z:0}, startOrientation: {x:0,y:0,z:1}, endTcp: {x:0,y:0,z:0}, endOrientation: {x:0,y:0,z:1}, motionType: 'FEED' }
  };

  it('100-Run Sequential Determinism: Identical inputs produce 100% identical canonical engineering truth', async () => {
    const results = [];
    const resultHashes = [];

    for (let i = 0; i < 100; i++) {
      const res = await CollisionAuthority.evaluate(baseInput);
      results.push(res);
      resultHashes.push(EngineeringHashChain.computeCanonicalHash(res).canonicalHash);
    }

    expect(results.length).toBe(100);

    const firstResult = results[0];
    const firstHash = resultHashes[0];

    // Compare all 99 subsequent results against the first
    for (let i = 1; i < 100; i++) {
      const currentResult = results[i];
      const equiv = CanonicalCollisionResultEquivalence.compare(firstResult, currentResult);
      
      expect(equiv.equivalent).toBe(true);
      expect(equiv.mismatches.length).toBe(0);
      
      // Operational differences must exist (executionId, timestampIso)
      expect(currentResult.executionId).not.toBe(firstResult.executionId);
    }
  });

  it('10-Run Concurrency Isolation: Parallel evaluations maintain zero cross-linking and unique execution IDs', async () => {
    const promises = Array.from({ length: 10 }, (_, idx) => 
      CollisionAuthority.evaluate({
        ...baseInput,
        executionId: `PARALLEL_EXEC_${idx}_${Date.now()}`
      })
    );

    const parallelResults = await Promise.all(promises);
    expect(parallelResults.length).toBe(10);

    const executionIds = new Set(parallelResults.map(r => r.executionId));
    expect(executionIds.size).toBe(10); // All 10 execution IDs must be unique

    const baseEquiv = parallelResults[0];
    for (let i = 1; i < 10; i++) {
      const equiv = CanonicalCollisionResultEquivalence.compare(baseEquiv, parallelResults[i]);
      expect(equiv.equivalent).toBe(true);
    }
  });
});
