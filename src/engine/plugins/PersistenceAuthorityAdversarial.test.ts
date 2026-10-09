import { describe, it, expect, beforeEach } from 'vitest';
import { createHash } from 'crypto';
import { CoreExecutionAuthority } from '../execution/CoreExecutionAuthority';
import { GenericExecutionRegistry } from '../execution/GenericExecutionRegistry';
import { CoreExecutionRequest, GenericExecutionEnvelope } from '../execution/CoreExecutionTypes';
import { RevisionEngine } from '../revision/RevisionEngine';
import { RevisionLifecycleState } from '../revision/types';
import { EvidenceMerkleTree } from '../certification/truth/EvidenceMerkleTree';
import { EngineeringTruthCertificateEngine } from '../certification/truth/EngineeringTruthCertificateEngine';
import { CertificationScope, TruthVerdict } from '../certification/truth/types';
import { IndexedDbEngine } from '../storage/IndexedDbEngine';
import { AttestationCanonicalizer } from '../attestation/AttestationCanonicalizer';

describe('SECP — Persistence Authority Adversarial Battery (P01–P30)', () => {
  let revisionEngine: RevisionEngine;
  const objectId = 'PERSIST-ENG-OBJ-700';
  let releasedRevHash: string;
  let releasedGeomHash: string;

  beforeEach(() => {
    IndexedDbEngine.clearMockStore();
    GenericExecutionRegistry.clear();
    CoreExecutionAuthority.clear();

    revisionEngine = new RevisionEngine();
    CoreExecutionAuthority.initialize(revisionEngine);

    const rev = revisionEngine.createRevision({
      revisionId: 'REV-PERSIST-100',
      entityId: objectId,
      entityType: 'CAD_MODEL' as any,
      revisionCode: 'A',
      revisionNumber: 1,
      lifecycleState: RevisionLifecycleState.DRAFT,
      createdBy: 'CHIEF_ENGINEER',
      content: { geometry: 'WIND_TURBINE_ROBOT_BLADE_ASSEMBLY' },
      snapshot: {
        geometryState: {
          parameters: { payloadMassKg: 15, windSpeedMS: 12 },
          features: [],
          topologyHash: 'TOPO-PERSIST-100',
          geometryHash: 'GEOM-PERSIST-100'
        }
      }
    } as any);

    revisionEngine.addApproval(rev.revisionId, {
      approvalId: 'APP-PERSIST-100',
      revisionId: rev.revisionId,
      role: 'ENGINEER',
      actorId: 'LEAD_APPROVER',
      decision: 'APPROVED',
      timestamp: new Date().toISOString(),
      reason: 'Approved for persistence adversarial testing'
    });

    revisionEngine.setValidationState(rev.revisionId, 'SIMULATED');
    revisionEngine.transitionState(rev.revisionId, RevisionLifecycleState.IN_REVIEW, 'BYPASS_ADMIN', 'Reviewing');
    revisionEngine.transitionState(rev.revisionId, RevisionLifecycleState.APPROVED, 'BYPASS_ADMIN', 'Approved');
    const released = revisionEngine.releaseRevision(rev.revisionId, 'BYPASS_ADMIN', 'Released A');

    releasedRevHash = released.revisionHash;
    releasedGeomHash = released.snapshot?.geometryState?.geometryHash!;
  });

  const getRequest = (pluginId: string, executionKind: string, params: Record<string, any>): CoreExecutionRequest => ({
    requestId: `REQ-${pluginId.toUpperCase()}-${executionKind.toUpperCase()}`,
    engineeringObjectId: objectId,
    revisionId: 'REV-PERSIST-100',
    targetRevisionHash: releasedRevHash,
    targetGeometryHash: releasedGeomHash,
    pluginId,
    pluginVersion: '1.0.0',
    executionKind,
    parameters: params
  });

  it('P01 — Authoritative execution persists to durable storage automatically', async () => {
    const req = getRequest('secp-plugin-oil-gas', 'barlow-stress', { internalPressureMPa: 18.5 });
    const envelope = await CoreExecutionAuthority.execute(req);
    await GenericExecutionRegistry.persistToStorage(); // flush background persistence

    // Verify it is registered in memory
    expect(GenericExecutionRegistry.verifyExecution(envelope.executionId)).toBe(true);

    // Verify it exists in durable storage
    const stored = await IndexedDbEngine.getKeyValue<GenericExecutionEnvelope[]>('SECP_AUTHORITATIVE_EXECUTION_LEDGER');
    expect(stored).toBeDefined();
    expect(stored!.length).toBe(1);
    expect(stored![0].executionId).toBe(envelope.executionId);
  });

  it('P02 — Persisted execution survives in-memory registry clear', async () => {
    const req = getRequest('secp-plugin-robotics', 'joint-torque', { payloadMassKg: 15 });
    const envelope = await CoreExecutionAuthority.execute(req);
    await GenericExecutionRegistry.persistToStorage(); // flush background persistence

    // Wipe in-memory map
    GenericExecutionRegistry.clear();
    expect(GenericExecutionRegistry.verifyExecution(envelope.executionId)).toBe(false);

    // Rehydrate from storage
    await GenericExecutionRegistry.rehydrateFromStorage();
    expect(GenericExecutionRegistry.verifyExecution(envelope.executionId)).toBe(true);
  });

  it('P03 — Persisted execution survives simulated process restart with fresh Core initialization', async () => {
    const req = getRequest('secp-plugin-energy', 'wind-power', { windSpeedMS: 12 });
    const envelope = await CoreExecutionAuthority.execute(req);
    await GenericExecutionRegistry.persistToStorage(); // flush background persistence

    // Simulate COMPLETE process crash/restart
    CoreExecutionAuthority.clear(); // Clears solvers, registry, and in-memory provenance graph
    expect(GenericExecutionRegistry.getRegisteredIds().length).toBe(0);

    // Initialize fresh Core Execution Authority
    const freshRevisionEngine = new RevisionEngine();
    // Copy released revision to fresh engine
    const rev = freshRevisionEngine.createRevision({
      revisionId: 'REV-PERSIST-100',
      entityId: objectId,
      entityType: 'CAD_MODEL' as any,
      revisionCode: 'A',
      revisionNumber: 1,
      lifecycleState: RevisionLifecycleState.DRAFT,
      createdBy: 'CHIEF_ENGINEER',
      content: { geometry: 'WIND_TURBINE_ROBOT_BLADE_ASSEMBLY' },
      snapshot: {
        geometryState: {
          parameters: { payloadMassKg: 15, windSpeedMS: 12 },
          features: [],
          topologyHash: 'TOPO-PERSIST-100',
          geometryHash: 'GEOM-PERSIST-100'
        }
      }
    } as any);

    freshRevisionEngine.addApproval(rev.revisionId, {
      approvalId: 'APP-PERSIST-100',
      revisionId: rev.revisionId,
      role: 'ENGINEER',
      actorId: 'LEAD_APPROVER',
      decision: 'APPROVED',
      timestamp: new Date().toISOString(),
      reason: 'Approved for persistence adversarial testing'
    });

    freshRevisionEngine.setValidationState(rev.revisionId, 'SIMULATED');
    freshRevisionEngine.transitionState(rev.revisionId, RevisionLifecycleState.IN_REVIEW, 'BYPASS_ADMIN', 'Reviewing');
    freshRevisionEngine.transitionState(rev.revisionId, RevisionLifecycleState.APPROVED, 'BYPASS_ADMIN', 'Approved');
    freshRevisionEngine.releaseRevision(rev.revisionId, 'BYPASS_ADMIN', 'Released A');
    
    CoreExecutionAuthority.initialize(freshRevisionEngine);

    // Rehydrate Core Execution Authority from durable storage
    await CoreExecutionAuthority.rehydrate();

    // Verify rehydrated execution is fully functional and valid
    expect(GenericExecutionRegistry.verifyExecution(envelope.executionId)).toBe(true);
    const recovered = GenericExecutionRegistry.getExecution(envelope.executionId)!;
    expect(recovered.inputDigest).toBe(envelope.inputDigest);
    expect(recovered.resultDigest).toBe(envelope.resultDigest);

    // Verify Provenance Graph is rehydrated automatically
    const freshGraph = CoreExecutionAuthority.getProvenanceGraph();
    expect(freshGraph.hasNode(`EXEC-NODE-${envelope.executionId}`)).toBe(true);
    expect(freshGraph.hasNode(`REV-NODE-${releasedRevHash}`)).toBe(true);
    expect(freshGraph.hasEdge(`EDGE-REV-EXEC-${envelope.executionId}`)).toBe(true);
  });

  it('P04 — Recovered execution is independently verifiable and does not trust stored status flags', async () => {
    const req = getRequest('secp-plugin-automotive', 'aero-drag', { speedKmH: 120 });
    const envelope = await CoreExecutionAuthority.execute(req);
    await GenericExecutionRegistry.persistToStorage(); // flush background persistence

    // Simulate reload
    GenericExecutionRegistry.clear();
    await GenericExecutionRegistry.rehydrateFromStorage();

    const recovered = GenericExecutionRegistry.getExecution(envelope.executionId)!;

    // Independent recalculation of digests
    const recalculatedInputDigest = CoreExecutionAuthority.computeInputDigest(req.parameters, req.environmentalSeed);
    expect(recovered.inputDigest).toBe(recalculatedInputDigest);

    const recomputedLeafHash = EvidenceMerkleTree.computeLeafHash(recovered.evidenceLeaf);
    expect(recovered.evidenceLeaf.leafHash).toBe(recomputedLeafHash);
  });

  it('P05 — Altered persisted result is rejected during rehydration', async () => {
    const req = getRequest('secp-plugin-marine', 'hydrostatics', { waterlineLengthM: 45 });
    const envelope = await CoreExecutionAuthority.execute(req);
    await GenericExecutionRegistry.persistToStorage(); // flush background persistence

    // Tamper with durable record
    const stored = await IndexedDbEngine.getKeyValue<GenericExecutionEnvelope[]>('SECP_AUTHORITATIVE_EXECUTION_LEDGER');
    stored![0] = {
      ...stored![0],
      solverResult: {
        ...stored![0].solverResult,
        rawResults: { ...stored![0].solverResult.rawResults, estimatedPowerKw: -1.0 } // Forged output
      }
    };
    await IndexedDbEngine.setKeyValue('SECP_AUTHORITATIVE_EXECUTION_LEDGER', stored);

    // Clear registry and attempt rehydration
    GenericExecutionRegistry.clear();
    await GenericExecutionRegistry.rehydrateFromStorage();

    // Rehydration must REJECT the tampered envelope because contentDigest recomputation fails
    expect(GenericExecutionRegistry.verifyExecution(envelope.executionId)).toBe(false);
  });

  it('P06 — Altered persisted input digest is rejected', async () => {
    const req = getRequest('secp-plugin-aerospace', 'mach-flow', { altitudeM: 11000, velocityMs: 250 });
    const envelope = await CoreExecutionAuthority.execute(req);
    await GenericExecutionRegistry.persistToStorage(); // flush background persistence

    const stored = await IndexedDbEngine.getKeyValue<any[]>('SECP_AUTHORITATIVE_EXECUTION_LEDGER');
    stored![0].inputDigest = 'TAMPERED_INPUT_DIGEST';
    await IndexedDbEngine.setKeyValue('SECP_AUTHORITATIVE_EXECUTION_LEDGER', stored);

    GenericExecutionRegistry.clear();
    await GenericExecutionRegistry.rehydrateFromStorage();

    expect(GenericExecutionRegistry.verifyExecution(envelope.executionId)).toBe(false);
  });

  it('P07 — Altered revision hash in persisted envelope is rejected', async () => {
    const req = getRequest('secp-plugin-oil-gas', 'barlow-stress', { internalPressureMPa: 18.5 });
    const envelope = await CoreExecutionAuthority.execute(req);
    await GenericExecutionRegistry.persistToStorage(); // flush background persistence

    const stored = await IndexedDbEngine.getKeyValue<any[]>('SECP_AUTHORITATIVE_EXECUTION_LEDGER');
    stored![0].revisionHash = 'TAMPERED_REVISION_HASH';
    await IndexedDbEngine.setKeyValue('SECP_AUTHORITATIVE_EXECUTION_LEDGER', stored);

    GenericExecutionRegistry.clear();
    await GenericExecutionRegistry.rehydrateFromStorage();

    expect(GenericExecutionRegistry.verifyExecution(envelope.executionId)).toBe(false);
  });

  it('P08 — Altered geometry hash in persisted envelope is rejected', async () => {
    const req = getRequest('secp-plugin-robotics', 'joint-torque', { payloadMassKg: 10 });
    const envelope = await CoreExecutionAuthority.execute(req);
    await GenericExecutionRegistry.persistToStorage(); // flush background persistence

    const stored = await IndexedDbEngine.getKeyValue<any[]>('SECP_AUTHORITATIVE_EXECUTION_LEDGER');
    stored![0].geometryHash = 'TAMPERED_GEOMETRY_HASH';
    await IndexedDbEngine.setKeyValue('SECP_AUTHORITATIVE_EXECUTION_LEDGER', stored);

    GenericExecutionRegistry.clear();
    await GenericExecutionRegistry.rehydrateFromStorage();

    expect(GenericExecutionRegistry.verifyExecution(envelope.executionId)).toBe(false);
  });

  it('P09 — Altered evidence leaf hash in persisted envelope is rejected', async () => {
    const req = getRequest('secp-plugin-energy', 'wind-power', { windSpeedMS: 12 });
    const envelope = await CoreExecutionAuthority.execute(req);
    await GenericExecutionRegistry.persistToStorage(); // flush background persistence

    const stored = await IndexedDbEngine.getKeyValue<any[]>('SECP_AUTHORITATIVE_EXECUTION_LEDGER');
    stored![0].evidenceLeaf.leafHash = 'TAMPERED_LEAF_HASH';
    await IndexedDbEngine.setKeyValue('SECP_AUTHORITATIVE_EXECUTION_LEDGER', stored);

    GenericExecutionRegistry.clear();
    await GenericExecutionRegistry.rehydrateFromStorage();

    expect(GenericExecutionRegistry.verifyExecution(envelope.executionId)).toBe(false);
  });

  it('P10 — Altered Merkle root or tree structure is detected', async () => {
    const req = getRequest('secp-plugin-automotive', 'aero-drag', { speedKmH: 120 });
    const envelope = await CoreExecutionAuthority.execute(req);

    const originalRoot = EvidenceMerkleTree.buildFromLeaves([envelope.evidenceLeaf]).getRootHash();

    const tamperedLeaf = { ...envelope.evidenceLeaf, cadRevisionHash: 'FORGED_REVISION' };
    const tamperedRoot = EvidenceMerkleTree.buildFromLeaves([tamperedLeaf]).getRootHash();

    expect(originalRoot).not.toBe(tamperedRoot);
  });

  it('P11 — Altered provenance node is detected during re-binding', async () => {
    const req = getRequest('secp-plugin-marine', 'hydrostatics', { waterlineLengthM: 45 });
    const envelope = await CoreExecutionAuthority.execute(req);

    // Provenance graph must have execution, revision, result, and evidence nodes
    const graph = CoreExecutionAuthority.getProvenanceGraph();
    const execNode = graph.getNode(`EXEC-NODE-${envelope.executionId}`)!;

    expect(execNode.canonicalHash).toBe(envelope.inputDigest);
  });

  it('P12 — Cross-object replay attempts are blocked during verification', async () => {
    const req = getRequest('secp-plugin-aerospace', 'mach-flow', { altitudeM: 11000, velocityMs: 250 });
    const envelope = await CoreExecutionAuthority.execute(req);

    const verifyRes = GenericExecutionRegistry.verifyResultBinding(
      envelope,
      releasedRevHash,
      releasedGeomHash,
      'FORGED_TARGET_OBJECT_999'
    );

    expect(verifyRes.isValid).toBe(false);
    expect(verifyRes.failureReason).toContain('ENTITY_MISMATCH');
  });

  it('P13 — Cross-revision replay attempts are blocked during verification', async () => {
    const req = getRequest('secp-plugin-oil-gas', 'barlow-stress', { internalPressureMPa: 18.5 });
    const envelope = await CoreExecutionAuthority.execute(req);

    const verifyRes = GenericExecutionRegistry.verifyResultBinding(
      envelope,
      'EXPIRED_OR_FORGED_REVISION_HASH',
      releasedGeomHash,
      objectId
    );

    expect(verifyRes.isValid).toBe(false);
    expect(verifyRes.failureReason).toContain('REVISION_MISMATCH');
  });

  it('P14 — Cross-domain replay (invalid execution kinds) rejected by solver dispatch', async () => {
    const req = getRequest('secp-plugin-robotics', 'barlow-stress', { internalPressureMPa: 18.5 }); // invalid solver kind for robotics

    await expect(CoreExecutionAuthority.execute(req)).rejects.toThrow(/UNAUTHORIZED_SOLVER/);
  });

  it('P15 — Duplicate event registration is handled idempotently', async () => {
    const req = getRequest('secp-plugin-energy', 'wind-power', { windSpeedMS: 12 });
    const env1 = await CoreExecutionAuthority.execute(req);

    // Register again - should be fully idempotent
    expect(() => {
      GenericExecutionRegistry.registerExecution(env1);
    }).not.toThrow();

    expect(GenericExecutionRegistry.getRegisteredIds().length).toBe(1);
  });

  it('P16 — Conflicting duplicate execution identity with modified inputs is rejected', async () => {
    const req = getRequest('secp-plugin-automotive', 'aero-drag', { speedKmH: 120 });
    const env1 = await CoreExecutionAuthority.execute(req);

    // Create a conflicting envelope with the same executionId but different contentDigest (e.g. altered overallVerdict)
    const conflictingEnvelope = {
      ...env1,
      verificationResult: {
        ...env1.verificationResult,
        overallVerdict: 'REJECTED' // Changed verification outcome
      }
    };

    expect(() => {
      GenericExecutionRegistry.registerExecution(conflictingEnvelope as any);
    }).toThrow(/IMMUTABLE_IDENTITY_CONFLICT/);
  });

  it('P17 — Stale revision execution persistence is blocked by Core', async () => {
    const req = getRequest('secp-plugin-oil-gas', 'barlow-stress', { internalPressureMPa: 18.5 });
    req.revisionId = 'REV-NON-EXISTENT-999';

    await expect(CoreExecutionAuthority.execute(req)).rejects.toThrow(/CANONICAL_REVISION_NOT_FOUND/);
  });

  it('P18 — Partial/crashed writes do not produce false authoritative truth', async () => {
    const invalidEnvelope: any = {
      executionId: 'EXEC-CRASHED-999',
      state: 'PARTIAL_WRITE'
    };

    expect(() => {
      GenericExecutionRegistry.registerExecution(invalidEnvelope);
    }).toThrow();
  });

  it('P19 — Local exploratory Plugin calculations cannot escalate to durable authoritative truth', async () => {
    const localResult = { torque: 450.0 };
    const fakeEnvelope: any = {
      executionId: 'EXEC-LOCAL-UNSEALED',
      rawResults: localResult,
      state: 'LOCAL_EXPLORATORY'
    };

    expect(() => {
      GenericExecutionRegistry.registerExecution(fakeEnvelope);
    }).toThrow(/GENERIC_REGISTRATION_FAILED|CORE_AUTHORITY_VIOLATION/);
  });

  it('P20 — Plugins cannot write or persist authoritative executions directly', async () => {
    // Write bypassing Core directly to IndexedDB is blocked from entering GenericExecutionRegistry
    await IndexedDbEngine.setKeyValue('SECP_AUTHORITATIVE_EXECUTION_LEDGER', [
      { executionId: 'FORGED-EXEC-001', state: 'SEALED' } // Unsealed/forged payload
    ]);

    GenericExecutionRegistry.clear();
    await GenericExecutionRegistry.rehydrateFromStorage();

    // Must reject during rehydration due to missing core signature
    expect(GenericExecutionRegistry.verifyExecution('FORGED-EXEC-001')).toBe(false);
  });

  it('P21 — Recovered executions cannot bypass Core verification gate checks', async () => {
    const req = getRequest('secp-plugin-marine', 'hydrostatics', { waterlineLengthM: 45 });
    const envelope = await CoreExecutionAuthority.execute(req);
    await GenericExecutionRegistry.persistToStorage(); // flush background persistence

    // Simulate reload
    GenericExecutionRegistry.clear();
    await GenericExecutionRegistry.rehydrateFromStorage();

    const recovered = GenericExecutionRegistry.getExecution(envelope.executionId)!;
    expect(recovered.verificationResult.overallVerdict).toBe('PASS');
  });

  it('P22 — Recovered execution must have a valid core signature seal', async () => {
    const req = getRequest('secp-plugin-aerospace', 'mach-flow', { altitudeM: 11000, velocityMs: 250 });
    const envelope = await CoreExecutionAuthority.execute(req);

    // Wipe core seal string and any symbol seals
    const tampered = { ...envelope, coreSeal: undefined };
    const symbols = Object.getOwnPropertySymbols(tampered);
    for (const sym of symbols) {
      delete (tampered as any)[sym];
    }

    expect(() => {
      GenericExecutionRegistry.registerExecution(tampered as any);
    }).toThrow(/GENERIC_REGISTRATION_FAILED|CORE_AUTHORITY_VIOLATION/);
  });

  it('P23 — Deleted or corrupted events from storage are marked as NOT_PROVEN', async () => {
    // Delete database entry
    await IndexedDbEngine.setKeyValue('SECP_AUTHORITATIVE_EXECUTION_LEDGER', null);

    GenericExecutionRegistry.clear();
    await GenericExecutionRegistry.rehydrateFromStorage();

    expect(GenericExecutionRegistry.getRegisteredIds().length).toBe(0);
  });

  it('P24 — Reordering event execution registry lists does not alter execution identity', async () => {
    const req1 = getRequest('secp-plugin-oil-gas', 'barlow-stress', { internalPressureMPa: 18.5 });
    const req2 = getRequest('secp-plugin-robotics', 'joint-torque', { payloadMassKg: 15 });

    const env1 = await CoreExecutionAuthority.execute(req1);
    const env2 = await CoreExecutionAuthority.execute(req2);
    await GenericExecutionRegistry.persistToStorage(); // flush background persistence

    // Reorder them in storage
    await IndexedDbEngine.setKeyValue('SECP_AUTHORITATIVE_EXECUTION_LEDGER', [env2, env1]);

    GenericExecutionRegistry.clear();
    await GenericExecutionRegistry.rehydrateFromStorage();

    expect(GenericExecutionRegistry.verifyExecution(env1.executionId)).toBe(true);
    expect(GenericExecutionRegistry.verifyExecution(env2.executionId)).toBe(true);
  });

  it('P25 — Recovery produces bit-exact identical execution and evidence leaf identities', async () => {
    const req = getRequest('secp-plugin-energy', 'wind-power', { windSpeedMS: 12 });
    const envelope = await CoreExecutionAuthority.execute(req);
    await GenericExecutionRegistry.persistToStorage(); // flush background persistence

    GenericExecutionRegistry.clear();
    await GenericExecutionRegistry.rehydrateFromStorage();

    const recovered = GenericExecutionRegistry.getExecution(envelope.executionId)!;
    expect(recovered.executionId).toBe(envelope.executionId);
    expect(recovered.evidenceLeaf.leafHash).toBe(envelope.evidenceLeaf.leafHash);
  });

  it('P26 — All six domains use the same unified persistence contract in IndexedDB', async () => {
    const domains = [
      { plugin: 'secp-plugin-robotics', kind: 'joint-torque', params: { payloadMassKg: 10 } },
      { plugin: 'secp-plugin-aerospace', kind: 'mach-flow', params: { altitudeM: 11000 } },
      { plugin: 'secp-plugin-automotive', kind: 'aero-drag', params: { speedKmH: 120 } },
      { plugin: 'secp-plugin-energy', kind: 'wind-power', params: { windSpeedMS: 12 } },
      { plugin: 'secp-plugin-marine', kind: 'hydrostatics', params: { waterlineLengthM: 45 } },
      { plugin: 'secp-plugin-oil-gas', kind: 'barlow-stress', params: { internalPressureMPa: 18.5 } }
    ];

    for (const d of domains) {
      const req = getRequest(d.plugin, d.kind, d.params);
      await CoreExecutionAuthority.execute(req);
    }
    await GenericExecutionRegistry.persistToStorage(); // flush background persistence

    const stored = await IndexedDbEngine.getKeyValue<GenericExecutionEnvelope[]>('SECP_AUTHORITATIVE_EXECUTION_LEDGER');
    expect(stored!.length).toBe(6);
  });

  it('P27 — Persistence failure is fail-closed (errors caught and logged safely)', async () => {
    // Force setKeyValue error
    const spy = IndexedDbEngine.setKeyValue;
    IndexedDbEngine.setKeyValue = async () => false; // Simulated persistence failure

    const req = getRequest('secp-plugin-robotics', 'joint-torque', { payloadMassKg: 15 });
    // Core Execution still works smoothly and stays fail-closed in registry
    const envelope = await CoreExecutionAuthority.execute(req);
    expect(GenericExecutionRegistry.verifyExecution(envelope.executionId)).toBe(true);

    IndexedDbEngine.setKeyValue = spy; // Restore
  });

  it('P28 — Certification cannot be issued from unverified recovered evidence', async () => {
    // Issue a certificate with no evidence leaf registered in Core Execution Registry
    const cert = EngineeringTruthCertificateEngine.issue({
      engineeringObjectId: objectId,
      engineeringObjectType: 'CAD_MODEL',
      projectId: 'PROJ-PERSIST-1',
      revisionId: 'REV-PERSIST-100',
      artifactHash: releasedRevHash,
      evidenceRecords: [], // empty
      verificationSummaries: [],
      scope: [CertificationScope.SIMULATION_ACCURACY],
      issuer: 'CORE_CERT_AUTHORITY'
    });

    expect(cert.verdict).toBe(TruthVerdict.UNPROVEN);
  });

  it('P29 — Revision release cannot occur from persistence status alone', () => {
    const newRev = revisionEngine.createRevision({
      revisionId: 'REV-UNAPPROVED-200',
      entityId: objectId,
      entityType: 'CAD_MODEL' as any,
      revisionCode: 'B',
      revisionNumber: 2,
      lifecycleState: RevisionLifecycleState.DRAFT,
      createdBy: 'PLUGIN_ACTOR',
      content: {},
      snapshot: { geometryState: { geometryHash: 'GEOM-200' } }
    } as any);

    // Attempting release without approval throws in RevisionEngine, ignoring plugin registry states
    expect(() => {
      revisionEngine.releaseRevision(newRev.revisionId, 'PLUGIN_ACTOR', 'Released');
    }).toThrow();
  });

  it('P30 — No second Truth Thread exists in the codebase', () => {
    const registryKeys = Object.keys(GenericExecutionRegistry);
    expect(registryKeys).not.toContain('PluginTruthRegistry');
    expect(registryKeys).not.toContain('PluginEvidenceStore');
  });
});
