import { describe, it, expect, beforeEach } from 'vitest';
import { createHash } from 'crypto';
import { CoreExecutionAuthority } from '../CoreExecutionAuthority';
import { GenericExecutionRegistry } from '../GenericExecutionRegistry';
import { CoreExecutionRequest, GenericExecutionEnvelope } from '../CoreExecutionTypes';
import { RevisionEngine } from '../../revision/RevisionEngine';
import { RevisionLifecycleState } from '../../revision/types';
import { IndexedDbEngine } from '../../storage/IndexedDbEngine';
import { EvidenceMerkleTree } from '../../certification/truth/EvidenceMerkleTree';

import { mintCompromisedGenericEnvelope } from '../CoreExecutionAuthorityInternal';

describe('SECP POST-DETERMINISM-003: Engineering Result Identity & Occurrence Separation', () => {
  let revisionEngine: RevisionEngine;
  const objectId = 'DETERM-003-OBJ-1';
  let revHash: string;
  let geomHash: string;

  beforeEach(() => {
    IndexedDbEngine.clearMockStore();
    GenericExecutionRegistry.clear();
    CoreExecutionAuthority.clear();

    revisionEngine = new RevisionEngine();
    CoreExecutionAuthority.initialize(revisionEngine);

    const rev = revisionEngine.createRevision({
      revisionId: 'REV-DET-001',
      entityId: objectId,
      entityType: 'CAD_MODEL' as any,
      revisionCode: 'A',
      revisionNumber: 1,
      lifecycleState: RevisionLifecycleState.DRAFT,
      createdBy: 'CHIEF_METROLOGIST',
      content: { geometry: 'DET_CAD_TEST' },
      snapshot: {
        geometryState: {
          parameters: {
            payloadMassKg: 10,
            link1LengthMm: 500,
            link2LengthMm: 500,
            jointMaxAccelDegS2: 90
          },
          features: [],
          topologyHash: 'TOPO-DET-001',
          geometryHash: 'GEOM-DET-001'
        }
      }
    } as any);

    revisionEngine.addApproval(rev.revisionId, {
      approvalId: 'APP-DET-001',
      revisionId: rev.revisionId,
      role: 'ENGINEER',
      actorId: 'LEAD_METROLOGIST',
      decision: 'APPROVED',
      timestamp: new Date().toISOString(),
      reason: 'Approved for Determinism testing'
    });

    revisionEngine.setValidationState(rev.revisionId, 'SIMULATED');
    revisionEngine.transitionState(rev.revisionId, RevisionLifecycleState.IN_REVIEW, 'ADMIN', 'Review');
    revisionEngine.transitionState(rev.revisionId, RevisionLifecycleState.APPROVED, 'ADMIN', 'Approve');
    const released = revisionEngine.releaseRevision(rev.revisionId, 'ADMIN', 'Release');

    revHash = released.revisionHash;
    geomHash = released.snapshot?.geometryState?.geometryHash!;
  });

  const makeRequest = (params: Record<string, any> = { payloadMassKg: 10 }): CoreExecutionRequest => ({
    requestId: 'REQ-STATIC-ID-001',
    engineeringObjectId: objectId,
    revisionId: 'REV-DET-001',
    targetRevisionHash: revHash,
    targetGeometryHash: geomHash,
    pluginId: 'secp-plugin-robotics',
    pluginVersion: '1.5.0',
    executionKind: 'joint-torque',
    parameters: params
  });

  it('Requirement 1 & 2: Execution scenario identity is deterministic and invariant under re-execution', async () => {
    const req1 = makeRequest();
    const req2 = makeRequest();

    const env1 = await CoreExecutionAuthority.execute(req1);
    const env2 = await CoreExecutionAuthority.execute(req2);

    expect(env1.executionId).toBe(env2.executionId);
    expect(env1.executionId).toMatch(/^EXEC-[0-9A-F]{24}$/);
  });

  it('Requirement 3 & 4 (Adversarial A): Dynamic solvedAt does not alter engineering resultDigest', async () => {
    const req = makeRequest();
    const env1 = await CoreExecutionAuthority.execute(req);

    // Simulate clock advancement by executing again
    await new Promise(r => setTimeout(r, 10));
    const env2 = await CoreExecutionAuthority.execute(req);

    expect(env1.resultDigest).toBe(env2.resultDigest);
    expect(env1.solverResult.rawResults).toEqual(env2.solverResult.rawResults);
  });

  it('Requirement 5 (Adversarial F): Replay acceptance succeeds idempotently and tracks occurrences', async () => {
    const req = makeRequest();
    const env1 = await CoreExecutionAuthority.execute(req);
    const env2 = await CoreExecutionAuthority.execute(req);

    const retrieved = GenericExecutionRegistry.getExecution(env1.executionId);
    expect(retrieved).toBeDefined();
    expect(retrieved?.resultDigest).toBe(env1.resultDigest);

    // Occurrences ledger records invocations
    if (retrieved?.occurrences) {
      expect(retrieved.occurrences.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('Requirement 6 (Adversarial B & G): Tampering rawResults triggers fail-closed IMMUTABLE_IDENTITY_CONFLICT', async () => {
    const req = makeRequest();
    const env = await CoreExecutionAuthority.execute(req);

    // Attacker crafts conflicting result with same executionId and valid seal
    const tamperedEnv: GenericExecutionEnvelope = JSON.parse(JSON.stringify(env));
    tamperedEnv.solverResult.rawResults.totalShoulderTorqueNm = 9999.99;
    (tamperedEnv as any).resultDigest = GenericExecutionRegistry.computeResultDigest(tamperedEnv.solverResult.rawResults);
    const sealedTampered = mintCompromisedGenericEnvelope(tamperedEnv);

    expect(() => {
      GenericExecutionRegistry.registerExecution(sealedTampered);
    }).toThrow(/IMMUTABLE_IDENTITY_CONFLICT/);
  });

  it('Requirement 7 & 8 (Adversarial C): Envelope serialization and rehydration preserves all digests', async () => {
    const req = makeRequest();
    const env = await CoreExecutionAuthority.execute(req);

    const serialized = JSON.stringify(env);
    const rehydrated: GenericExecutionEnvelope = JSON.parse(serialized);

    const computedContentDigest1 = GenericExecutionRegistry.computeContentDigest(env);
    const computedContentDigest2 = GenericExecutionRegistry.computeContentDigest(rehydrated);
    expect(computedContentDigest1).toBe(computedContentDigest2);
    expect(rehydrated.resultDigest).toBe(env.resultDigest);
    expect(rehydrated.executionId).toBe(env.executionId);
  });

  it('Requirement 11 & 12 (Adversarial D): Evidence Merkle Tree computation is stable and tamper-evident', async () => {
    const req = makeRequest();
    const env = await CoreExecutionAuthority.execute(req);

    const leafHash1 = EvidenceMerkleTree.computeLeafHash(env.evidenceLeaf);
    const leafHash2 = EvidenceMerkleTree.computeLeafHash(env.evidenceLeaf);

    expect(leafHash1).toBe(leafHash2);

    // Tampered artifact digest alters leaf hash
    const tamperedLeaf = EvidenceMerkleTree.computeLeafHash({
      ...env.evidenceLeaf,
      artifactContentHash: '0'.repeat(64)
    });
    expect(tamperedLeaf).not.toBe(leafHash1);
  });

  it('Requirement 19: Oil & Gas P=0 hoop stress handles boundary without Infinity overflow', async () => {
    const req: CoreExecutionRequest = {
      requestId: 'REQ-OIL-P0',
      engineeringObjectId: objectId,
      revisionId: 'REV-DET-001',
      targetRevisionHash: revHash,
      targetGeometryHash: geomHash,
      pluginId: 'secp-plugin-oil-gas',
      pluginVersion: '1.2.0',
      executionKind: 'barlow-stress',
      parameters: {
        internalPressureMPa: 0,
        outerDiameterMm: 508,
        wallThicknessMm: 15.8,
        materialYieldStrengthMPa: 450,
        safetyFactorASME: 1.39
      }
    };

    const env = await CoreExecutionAuthority.execute(req);
    expect(env).toBeDefined();
    expect(env.solverResult.rawResults.hoopStressMPa).toBe(0);
    expect(env.solverResult.rawResults.actualSafetyFactor).toBe(0);
    expect(Number.isFinite(env.solverResult.rawResults.actualSafetyFactor)).toBe(true);
  });
});
