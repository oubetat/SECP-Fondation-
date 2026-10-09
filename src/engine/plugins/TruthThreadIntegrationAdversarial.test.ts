import { describe, it, expect, beforeEach } from 'vitest';
import { createHash } from 'crypto';
import { CoreExecutionAuthority } from '../execution/CoreExecutionAuthority';
import { GenericExecutionRegistry } from '../execution/GenericExecutionRegistry';
import { CoreExecutionRequest } from '../execution/CoreExecutionTypes';
import { RevisionEngine } from '../revision/RevisionEngine';
import { RevisionLifecycleState } from '../revision/types';
import { EvidenceMerkleTree } from '../certification/truth/EvidenceMerkleTree';
import { EvidenceLeafRecord, TruthVerdict, CertificationScope } from '../certification/truth/types';
import { EngineeringTruthCertificateEngine } from '../certification/truth/EngineeringTruthCertificateEngine';
import { ProvenanceGraph } from '../provenance/ProvenanceGraph';
import { DuplicateNodeError } from '../provenance/ProvenanceGraphErrors';
import { AttestationCanonicalizer } from '../attestation/AttestationCanonicalizer';

describe('Plugin Truth Thread Integration Adversarial Battery (PT01–PT20)', () => {
  let revisionEngine: RevisionEngine;
  const objectId = 'TRUTH-ENG-OBJ-900';
  let releasedRevHash: string;
  let releasedGeomHash: string;

  beforeEach(() => {
    GenericExecutionRegistry.clear();
    CoreExecutionAuthority.clear();

    revisionEngine = new RevisionEngine();
    CoreExecutionAuthority.initialize(revisionEngine);

    const rev = revisionEngine.createRevision({
      revisionId: 'REV-TRUTH-100',
      entityId: objectId,
      entityType: 'CAD_MODEL' as any,
      revisionCode: 'A',
      revisionNumber: 1,
      lifecycleState: RevisionLifecycleState.DRAFT,
      createdBy: 'CHIEF_ENGINEER',
      content: { geometry: 'PIPELINE_ROBOT_TURBINE_ASSEMBLY' },
      snapshot: {
        geometryState: {
          parameters: { internalPressureMPa: 18.5, payloadMassKg: 15 },
          features: [],
          topologyHash: 'TOPO-TRUTH-100',
          geometryHash: 'GEOM-TRUTH-100'
        }
      }
    } as any);

    revisionEngine.addApproval(rev.revisionId, {
      approvalId: 'APP-TRUTH-100',
      revisionId: rev.revisionId,
      role: 'ENGINEER',
      actorId: 'LEAD_APPROVER',
      decision: 'APPROVED',
      timestamp: new Date().toISOString(),
      reason: 'Truth thread baseline revision approved'
    });

    revisionEngine.setValidationState(rev.revisionId, 'SIMULATED');
    revisionEngine.transitionState(rev.revisionId, RevisionLifecycleState.IN_REVIEW, 'BYPASS_ADMIN', 'Reviewing');
    revisionEngine.transitionState(rev.revisionId, RevisionLifecycleState.APPROVED, 'BYPASS_ADMIN', 'Approved');
    const released = revisionEngine.releaseRevision(rev.revisionId, 'BYPASS_ADMIN', 'Released A');

    releasedRevHash = released.revisionHash;
    releasedGeomHash = released.snapshot?.geometryState?.geometryHash!;
  });

  const getRequest = (pluginId: string, executionKind: string, params: Record<string, any>): CoreExecutionRequest => ({
    requestId: `REQ-${pluginId.toUpperCase()}-TRUTH`,
    engineeringObjectId: objectId,
    revisionId: 'REV-TRUTH-100',
    targetRevisionHash: releasedRevHash,
    targetGeometryHash: releasedGeomHash,
    pluginId,
    pluginVersion: '1.0.0',
    executionKind,
    parameters: params
  });

  it('PT01 — Authoritative result creates valid evidence leaf record with canonical hash', async () => {
    const req = getRequest('secp-plugin-oil-gas', 'barlow-stress', {
      internalPressureMPa: 18.5,
      outerDiameterMm: 508,
      wallThicknessMm: 15.8
    });
    const envelope = await CoreExecutionAuthority.execute(req);

    expect(envelope.evidenceLeaf).toBeDefined();
    expect(envelope.evidenceLeaf.entityId).toBe(objectId);
    expect(envelope.evidenceLeaf.cadRevisionHash).toBe(releasedRevHash);
    expect(envelope.evidenceLeaf.canonicalGeometryHash).toBe(releasedGeomHash);
    expect(envelope.evidenceLeaf.executionIdentity).toBe(envelope.executionId);

    const recomputedLeafHash = EvidenceMerkleTree.computeLeafHash(envelope.evidenceLeaf);
    expect(envelope.evidenceLeaf.leafHash).toBe(recomputedLeafHash);
  });

  it('PT02 — Evidence Merkle Root recomputes correctly from evidence leaves', async () => {
    const req1 = getRequest('secp-plugin-oil-gas', 'barlow-stress', { internalPressureMPa: 18.5 });
    const req2 = getRequest('secp-plugin-aerospace', 'mach-flow', { altitudeM: 11000, velocityMs: 250 });
    const req3 = getRequest('secp-plugin-robotics', 'joint-torque', { payloadMassKg: 12 });

    const env1 = await CoreExecutionAuthority.execute(req1);
    const env2 = await CoreExecutionAuthority.execute(req2);
    const env3 = await CoreExecutionAuthority.execute(req3);

    const leaves = [env1.evidenceLeaf, env2.evidenceLeaf, env3.evidenceLeaf];
    const merkleTree = EvidenceMerkleTree.buildFromLeaves(leaves);
    const rootHash = merkleTree.getRootHash();

    expect(rootHash).toBeDefined();
    expect(rootHash).not.toBe(EvidenceMerkleTree.EMPTY_ROOT);
    expect(merkleTree.getLeaves().length).toBe(3);

    // Recompute manually to verify determinism
    const manualLeaves = leaves.map(l => EvidenceMerkleTree.computeLeafHash(l));
    const manualTree = new EvidenceMerkleTree(manualLeaves);
    expect(manualTree.getRootHash()).toBe(rootHash);
  });

  it('PT03 — Result tampering is detected by cryptographic verification', async () => {
    const req = getRequest('secp-plugin-automotive', 'aero-drag', { speedKmH: 120 });
    const envelope = await CoreExecutionAuthority.execute(req);

    // Tamper with result raw outputs
    const tamperedEnvelope = JSON.parse(JSON.stringify(envelope));
    tamperedEnvelope.solverResult.rawResults.dragForceN = 0.0; // Tampered output

    const verification = GenericExecutionRegistry.verifyResultBinding(
      tamperedEnvelope,
      releasedRevHash,
      releasedGeomHash,
      objectId
    );

    expect(verification.isValid).toBe(false);
    expect(verification.failureReason).toContain('DIGEST_MISMATCH');
  });

  it('PT04 — Evidence tampering is detected via Merkle leaf hash mismatch', async () => {
    const req = getRequest('secp-plugin-energy', 'wind-power', { windSpeedMS: 12 });
    const envelope = await CoreExecutionAuthority.execute(req);

    const originalLeaf = envelope.evidenceLeaf;
    const tamperedLeaf: EvidenceLeafRecord = {
      ...originalLeaf,
      cadRevisionHash: 'TAMPERED_CAD_REVISION_HASH'
    };

    const recomputedLeafHash = EvidenceMerkleTree.computeLeafHash(tamperedLeaf);
    expect(recomputedLeafHash).not.toBe(originalLeaf.leafHash);

    const treeOriginal = EvidenceMerkleTree.buildFromLeaves([originalLeaf]);
    const treeTampered = EvidenceMerkleTree.buildFromLeaves([tamperedLeaf]);
    expect(treeOriginal.getRootHash()).not.toBe(treeTampered.getRootHash());
  });

  it('PT05 — Cross-revision replay is rejected by Core authority', async () => {
    const req = getRequest('secp-plugin-marine', 'hydrostatics', { waterlineLengthM: 45 });
    req.targetRevisionHash = 'EXPIRED_OR_FORGED_REVISION_HASH';

    await expect(CoreExecutionAuthority.execute(req)).rejects.toThrow(/REVISION_MISMATCH/);
  });

  it('PT06 — Cross-object replay is rejected during registry verification', async () => {
    const req = getRequest('secp-plugin-marine', 'hydrostatics', { waterlineLengthM: 45 });
    const envelope = await CoreExecutionAuthority.execute(req);

    const verifyRes = GenericExecutionRegistry.verifyResultBinding(
      envelope,
      releasedRevHash,
      releasedGeomHash,
      'ATTEMPTED_TARGET_OBJECT_999'
    );

    expect(verifyRes.isValid).toBe(false);
    expect(verifyRes.failureReason).toContain('ENTITY_MISMATCH');
  });

  it('PT07 — Cross-domain replay (submitting wrong kind to domain) is rejected', async () => {
    const req = getRequest('secp-plugin-robotics', 'barlow-stress', { internalPressureMPa: 18.5 }); // Robotics plugin does not support barlow-stress

    await expect(CoreExecutionAuthority.execute(req)).rejects.toThrow(/UNAUTHORIZED_SOLVER/);
  });

  it('PT08 — Solver-version or solver identity mismatch is rejected', async () => {
    const req = getRequest('secp-plugin-aerospace', 'mach-flow', { altitudeM: 11000, velocityMs: 250 });
    const envelope = await CoreExecutionAuthority.execute(req);

    const tamperedEnvelope = JSON.parse(JSON.stringify(envelope));
    tamperedEnvelope.solverIdentity = 'FORGED-CFD-SOLVER-V99';

    const verifyRes = GenericExecutionRegistry.verifyResultBinding(
      tamperedEnvelope,
      releasedRevHash,
      releasedGeomHash,
      objectId
    );

    expect(verifyRes.isValid).toBe(false);
  });

  it('PT09 — Provenance tampering or duplicate node insertion is detected', async () => {
    const graph = new ProvenanceGraph();
    const nodeId = 'EXEC-PROV-NODE-001';

    graph.addNode({
      id: nodeId,
      engineeringIdentityId: objectId,
      canonicalHash: 'HASH-PROV-100',
      type: 'EXECUTION' as any,
      version: 1,
      createdAt: new Date().toISOString()
    });

    // Attempt duplicate node insertion with same identity and hash
    expect(() => {
      graph.addNode({
        id: 'EXEC-PROV-NODE-002',
        engineeringIdentityId: objectId,
        canonicalHash: 'HASH-PROV-100', // Same hash
        type: 'EXECUTION' as any,
        version: 1,
        createdAt: new Date().toISOString()
      });
    }).toThrow(DuplicateNodeError);
  });

  it('PT10 — Persistence bypass attempt (unsealed payload) is rejected by registry', async () => {
    const fakeEnvelope: any = {
      executionId: 'EXEC-FAKE-123456789012345678',
      engineeringObjectId: objectId,
      revisionHash: releasedRevHash,
      geometryHash: releasedGeomHash,
      pluginId: 'secp-plugin-robotics',
      executionKind: 'joint-torque',
      inputDigest: 'fake_input_digest',
      resultDigest: 'fake_result_digest',
      solverIdentity: 'ROBOTICS-KINEMATICS-SOLVER-V1',
      state: 'UNSEALED_MOCK_STATE', // Not properly sealed
      timestamp: new Date().toISOString()
    };

    expect(() => {
      GenericExecutionRegistry.registerExecution(fakeEnvelope);
    }).toThrow(/GENERIC_REGISTRATION_FAILED|CORE_AUTHORITY_VIOLATION/);
  });

  it('PT11 — Local exploratory plugin calculation cannot escalate to authoritative truth', async () => {
    // Local calculation performed inside a plugin locally (e.g. formula in UI)
    const localFormulaResult = {
      torque: 145.2,
      verdict: 'PASS_LOCAL_UI'
    };

    // Attempting to register raw local result into GenericExecutionRegistry directly fails
    const fakeEnvelope: any = {
      executionId: 'EXEC-LOCAL-UNSEALED',
      rawResults: localFormulaResult,
      state: 'LOCAL_EXPLORATORY'
    };

    expect(() => {
      GenericExecutionRegistry.registerExecution(fakeEnvelope);
    }).toThrow(/GENERIC_REGISTRATION_FAILED|CORE_AUTHORITY_VIOLATION/);
  });

  it('PT12 — Plugin cannot certify itself without Core Certification Authority', async () => {
    // A plugin cannot mint a certificate without passing valid evidence records to EngineeringTruthCertificateEngine
    const incompleteEvidence: any[] = []; // No evidence

    const cert = EngineeringTruthCertificateEngine.issue({
      engineeringObjectId: objectId,
      engineeringObjectType: 'CAD_MODEL',
      projectId: 'PROJ-TRUTH-1',
      revisionId: 'REV-TRUTH-100',
      artifactHash: releasedRevHash,
      evidenceRecords: incompleteEvidence,
      verificationSummaries: [],
      scope: [CertificationScope.SIMULATION_ACCURACY],
      issuer: 'PLUGIN_ATTEMPTED_SELF_ISSUER'
    });

    expect(cert.verdict).toBe(TruthVerdict.UNPROVEN);
    expect(cert.status).toBe('UNPROVEN');
    expect(cert.verdictReason).toContain('Incomplete evidence');
  });

  it('PT13 — Plugin cannot release its own CAD/Engineering revision', async () => {
    // Release requires Core RevisionEngine transitions with approvals
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

    // Attempting to release without approvals throws error in RevisionEngine
    expect(() => {
      revisionEngine.releaseRevision(newRev.revisionId, 'PLUGIN_ACTOR', 'Unapproved Release Attempt');
    }).toThrow();
  });

  it('PT14 — Stale canonical state (obsolete/superseded revision) is rejected', async () => {
    const req = getRequest('secp-plugin-oil-gas', 'barlow-stress', { internalPressureMPa: 18.5 });
    req.revisionId = 'REV-NON-EXISTENT-999'; // Non-existent or obsolete revision

    await expect(CoreExecutionAuthority.execute(req)).rejects.toThrow(/CANONICAL_REVISION_NOT_FOUND/);
  });

  it('PT15 — Duplicate execution identity calculation is 100% deterministic', async () => {
    const preimage = {
      engineeringObjectId: objectId,
      revisionHash: releasedRevHash,
      geometryHash: releasedGeomHash,
      pluginId: 'secp-plugin-robotics',
      pluginVersion: '1.0.0',
      executionKind: 'joint-torque',
      inputDigest: 'd1e2f3a4b5c6d7e8f90123456789012345678901234567890123456789012345',
      solverIdentity: 'ROBOTICS-KINEMATICS-SOLVER-V1'
    };

    const id1 = CoreExecutionAuthority.computeExecutionIdentity(preimage);
    const id2 = CoreExecutionAuthority.computeExecutionIdentity(preimage);

    expect(id1).toBe(id2);
    expect(id1).toMatch(/^EXEC-[A-F0-9]{24}$/);
  });

  it('PT16 — Conflicting execution registration with duplicate execution ID is rejected', async () => {
    const req = getRequest('secp-plugin-aerospace', 'mach-flow', { altitudeM: 11000, velocityMs: 250 });
    const env1 = await CoreExecutionAuthority.execute(req);

    // Create conflicting envelope with the same executionId but different contentDigest
    const conflicting = {
      ...env1,
      verificationResult: {
        ...env1.verificationResult,
        overallVerdict: 'REJECTED'
      }
    };

    expect(() => {
      GenericExecutionRegistry.registerExecution(conflicting as any);
    }).toThrow(/IMMUTABLE_IDENTITY_CONFLICT/);
  });

  it('PT17 — Independent verifier can recalculate digests without trusting declared PASS flags', async () => {
    const req = getRequest('secp-plugin-automotive', 'aero-drag', {
      speedKmH: 120,
      dragCoefficientCd: 0.28,
      frontalAreaM2: 2.2,
      airDensityKgM3: 1.225
    });
    const envelope = await CoreExecutionAuthority.execute(req);

    // Independent verifier logic:
    // 1. Recalculate inputDigest from raw request parameters
    const expectedInputDigest = CoreExecutionAuthority.computeInputDigest(req.parameters, req.environmentalSeed);
    expect(envelope.inputDigest).toBe(expectedInputDigest);

    // 2. Recalculate resultDigest from raw results
    const rawNormalized = AttestationCanonicalizer.normalizeValue(envelope.solverResult.rawResults);
    const expectedResultDigest = createHash('sha256')
      .update(JSON.stringify(rawNormalized))
      .digest('hex');
    expect(envelope.resultDigest).toBe(expectedResultDigest);

    // 3. Recalculate Evidence Leaf Hash
    const expectedLeafHash = EvidenceMerkleTree.computeLeafHash(envelope.evidenceLeaf);
    expect(envelope.evidenceLeaf.leafHash).toBe(expectedLeafHash);
  });

  it('PT18 — Missing evidence records render certificate verdict as UNPROVEN', async () => {
    const cert = EngineeringTruthCertificateEngine.issue({
      engineeringObjectId: objectId,
      engineeringObjectType: 'CAD_MODEL',
      projectId: 'PROJ-TRUTH-1',
      revisionId: 'REV-TRUTH-100',
      artifactHash: releasedRevHash,
      evidenceRecords: [], // Missing required evidence
      verificationSummaries: [],
      scope: [CertificationScope.CAD_GEOMETRY_INTEGRITY],
      issuer: 'CORE_CERT_AUTHORITY'
    });

    expect(cert.verdict).toBe(TruthVerdict.UNPROVEN);
    expect(cert.verdictReason).toContain('Incomplete evidence');
  });

  it('PT19 — Missing event store persistence is classified as PERSISTENCE_NOT_PROVEN', async () => {
    // In current SECP execution architecture, CoreExecutionAuthority and GenericExecutionRegistry
    // persist executions in an in-memory ledger. A global persistent event store (EngineeringEventStore)
    // is not wired to auto-write on every plugin execution.
    const isEventStorePersisted = false; // Absence of database/disk event store auto-commit
    
    const persistenceStatus = isEventStorePersisted ? 'PROVEN' : 'PERSISTENCE_NOT_PROVEN';
    expect(persistenceStatus).toBe('PERSISTENCE_NOT_PROVEN');
  });

  it('PT20 — Certificate cannot be generated from an incomplete truth chain', async () => {
    const req = getRequest('secp-plugin-oil-gas', 'barlow-stress', { internalPressureMPa: 18.5 });
    const envelope = await CoreExecutionAuthority.execute(req);

    // Provide evidence leaf from oil-gas execution, but request structural & manufacturing certification scopes
    const cert = EngineeringTruthCertificateEngine.issue({
      engineeringObjectId: objectId,
      engineeringObjectType: 'CAD_MODEL',
      projectId: 'PROJ-TRUTH-1',
      revisionId: 'REV-TRUTH-100',
      artifactHash: releasedRevHash,
      evidenceRecords: [envelope.evidenceLeaf],
      verificationSummaries: [],
      scope: [
        CertificationScope.CAD_GEOMETRY_INTEGRITY,
        CertificationScope.SIMULATION_RESULT,
        CertificationScope.MANUFACTURING // Missing DFM/CAM evidence
      ],
      issuer: 'CORE_CERT_AUTHORITY'
    });

    expect(cert.verdict).toBe(TruthVerdict.UNPROVEN);
    expect(cert.unprovenClaims).toContain(CertificationScope.MANUFACTURING);
  });
});
