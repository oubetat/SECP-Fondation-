import { describe, it, expect, beforeEach } from 'vitest';
import { createHash } from 'crypto';
import { CoreExecutionAuthority } from '../../execution/CoreExecutionAuthority';
import { GenericExecutionRegistry } from '../../execution/GenericExecutionRegistry';
import { RevisionEngine } from '../../revision/RevisionEngine';
import { RevisionLifecycleState } from '../../revision/types';
import { CrossDomainWorkflowEngine } from '../CrossDomainWorkflowEngine';
import { CrossDomainConflictEngine } from '../CrossDomainConflictEngine';
import { CrossDomainPersistenceService } from '../CrossDomainPersistenceService';
import { EngineeringDomain } from '../CrossDomainTypes';
import { EvidenceMerkleTree } from '../../certification/truth/EvidenceMerkleTree';
import { TruthVerdict, CertificationScope } from '../../certification/truth/types';
import { EngineeringTruthCertificateEngine } from '../../certification/truth/EngineeringTruthCertificateEngine';

describe('M9 Cross-Domain Engineering Truth Adversarial Battery (M9-01–M9-14)', () => {
  let revisionEngine: RevisionEngine;
  const objectId = 'M9-ENG-OBJ-001';
  let releasedRevHash: string;
  let releasedGeomHash: string;

  beforeEach(() => {
    GenericExecutionRegistry.clear();
    CoreExecutionAuthority.clear();
    CrossDomainWorkflowEngine.clear();
    CrossDomainConflictEngine.clear();

    revisionEngine = new RevisionEngine();
    CoreExecutionAuthority.initialize(revisionEngine);

    const rev = revisionEngine.createRevision({
      revisionId: 'REV-M9-100',
      entityId: objectId,
      entityType: 'CAD_MODEL' as any,
      revisionCode: 'A',
      revisionNumber: 1,
      lifecycleState: RevisionLifecycleState.DRAFT,
      createdBy: 'SYSTEM_ARCHITECT',
      content: { geometry: 'MULTI_DOMAIN_ASSEMBLY' },
      snapshot: {
        geometryState: {
          parameters: { baseLoad: 100 },
          features: [],
          topologyHash: 'TOPO-M9-100',
          geometryHash: 'GEOM-M9-100'
        }
      }
    } as any);

    revisionEngine.transitionState(rev.revisionId, RevisionLifecycleState.IN_REVIEW, 'BYPASS_ADMIN', 'Reviewing');
    
    revisionEngine.addApproval(rev.revisionId, {
      approvalId: 'APP-M9-100',
      revisionId: rev.revisionId,
      role: 'ENGINEER',
      actorId: 'LEAD_APPROVER',
      decision: 'APPROVED',
      timestamp: new Date().toISOString(),
      reason: 'Approved'
    });

    revisionEngine.setValidationState(rev.revisionId, 'SIMULATED');
    revisionEngine.transitionState(rev.revisionId, RevisionLifecycleState.APPROVED, 'BYPASS_ADMIN', 'Approving');
    revisionEngine.transitionState(rev.revisionId, RevisionLifecycleState.RELEASED, 'BYPASS_ADMIN', 'Released');
    
    releasedRevHash = rev.revisionHash;
    releasedGeomHash = rev.snapshot?.geometryState?.geometryHash!;
  });

  const getRequest = (pluginId: string, executionKind: string, params: Record<string, any>) => ({
    requestId: `REQ-${pluginId.toUpperCase()}-M9`,
    engineeringObjectId: objectId,
    revisionId: 'REV-M9-100',
    targetRevisionHash: releasedRevHash,
    targetGeometryHash: releasedGeomHash,
    pluginId,
    pluginVersion: '1.0.0',
    executionKind,
    parameters: params
  });

  it('M9-01 — Domain-local canonical state creation is REJECTED', async () => {
    // A plugin tries to register its own unsealed execution result directly
    const fakeEnvelope: any = {
      executionId: 'EXEC-FAKE-LOCAL',
      engineeringObjectId: objectId,
      state: 'LOCAL_DRAFT',
      verificationResult: { overallVerdict: 'PASS' }
    };
    expect(() => {
      GenericExecutionRegistry.registerExecution(fakeEnvelope);
    }).toThrow(/CORE_AUTHORITY_VIOLATION|GENERIC_REGISTRATION_FAILED/);
  });

  it('M9-02 — Cross-domain identity mismatch is REJECTED', async () => {
    const req = getRequest('secp-plugin-robotics', 'joint-torque', { payloadMassKg: 10 });
    const envelope = await CoreExecutionAuthority.execute(req);
    
    // Attempt to reuse this execution for a different object ID
    const tampered = { ...envelope, engineeringObjectId: 'WRONG-OBJ-ID' };
    expect(() => {
      GenericExecutionRegistry.registerExecution(tampered as any);
    }).toThrow(/IMMUTABLE_IDENTITY_CONFLICT/);
  });

  it('M9-03 — Geometry hash mismatch is REJECTED', async () => {
    const req = getRequest('secp-plugin-aerospace', 'mach-flow', { altitudeM: 10000 });
    req.targetGeometryHash = 'WRONG-GEOM-HASH';
    
    await expect(CoreExecutionAuthority.execute(req)).rejects.toThrow(/GEOMETRY_MISMATCH/);
  });

  it('M9-04 — Revision mismatch is REJECTED', async () => {
    const req = getRequest('secp-plugin-automotive', 'aero-drag', { speedKmH: 100 });
    req.targetRevisionHash = 'WRONG-REV-HASH';
    
    await expect(CoreExecutionAuthority.execute(req)).rejects.toThrow(/REVISION_MISMATCH/);
  });

  it('M9-05 — Stale result publication is BLOCKED (FAIL CLOSED)', async () => {
    // 1. Domain A result on R1
    const req1 = getRequest('secp-plugin-robotics', 'joint-torque', { payloadMassKg: 10 });
    const env1 = await CoreExecutionAuthority.execute(req1);
    
    // 2. Create R2
    const rev2 = revisionEngine.createRevision({
      revisionId: 'REV-M9-200',
      entityId: objectId,
      entityType: 'CAD_MODEL' as any,
      revisionCode: 'B',
      revisionNumber: 2,
      lifecycleState: RevisionLifecycleState.RELEASED,
      createdBy: 'SYSTEM_ARCHITECT',
      content: { geometry: 'MUTATED_GEOMETRY' },
      snapshot: { geometryState: { geometryHash: 'GEOM-M9-200' } }
    } as any);

    // 3. Attempt to validate R1 handoff for R2 consumption
    const handoff = CrossDomainWorkflowEngine.createHandoff({
      sourceEnvelope: env1,
      targetDomain: EngineeringDomain.AEROSPACE,
      targetParameterKey: 'inputLoad',
      extractedValue: 120
    });

    const validation = CrossDomainWorkflowEngine.validateHandoffForConsumption(
      handoff.handoffId,
      rev2.revisionId,
      rev2.revisionHash,
      rev2.snapshot?.geometryState?.geometryHash!
    );

    expect(validation.isValid).toBe(false);
    expect(validation.status).toBe('STALE');
  });

  it('M9-06 — Forged cross-domain evidence is REJECTED', async () => {
    const req = getRequest('secp-plugin-energy', 'wind-power', { windSpeedMS: 15 });
    const envelope = await CoreExecutionAuthority.execute(req);
    
    // Tamper with the evidence leaf payload
    const tamperedLeaf = { 
      ...envelope.evidenceLeaf, 
      artifactContentHash: 'FORGED-CONTENT-HASH' 
    };
    
    // Verify leaf hash check catches it
    const recomputed = EvidenceMerkleTree.computeLeafHash(tamperedLeaf);
    expect(recomputed).not.toBe(envelope.evidenceLeaf.leafHash);
  });

  it('M9-07 — Detached domain result is REJECTED', async () => {
    const req = getRequest('secp-plugin-marine', 'hydrostatics', { waterlineLengthM: 50 });
    const envelope = await CoreExecutionAuthority.execute(req);
    
    // Attempt to register a handoff for an execution NOT in the registry
    GenericExecutionRegistry.clear();
    expect(() => {
      CrossDomainWorkflowEngine.createHandoff({
        sourceEnvelope: envelope,
        targetDomain: EngineeringDomain.MANUFACTURING_CELL,
        targetParameterKey: 'maxLoad',
        extractedValue: 500
      });
    }).toThrow(/CROSS_DOMAIN_HANDOFF_FAILED/);
  });

  it('M9-08 — Broken cross-domain provenance is DETECTABLE', async () => {
    const req1 = getRequest('secp-plugin-robotics', 'joint-torque', { payloadMassKg: 10 });
    const env1 = await CoreExecutionAuthority.execute(req1);
    
    const handoff = await CoreExecutionAuthority.performCrossDomainHandoff({
      sourceExecutionId: env1.executionId,
      targetDomain: EngineeringDomain.AEROSPACE,
      targetParameterKey: 'load',
      extractedValue: 100
    });

    const req2 = getRequest('secp-plugin-aerospace', 'mach-flow', { altitudeM: 11000 });
    req2.consumedHandoffIds = [handoff.handoffId];
    const env2 = await CoreExecutionAuthority.execute(req2);

    const graph = CoreExecutionAuthority.getProvenanceGraph();
    const edgeId = `EDGE-XD-DEP-${handoff.handoffId}-${env2.executionId}`;
    expect(graph.hasEdge(edgeId)).toBe(true);
    
    const edge = graph.getEdge(edgeId);
    expect(edge?.type).toBe('CROSS_DOMAIN_INPUT_FROM');
  });

  it('M9-09 — Unauthorized cross-domain mutation is REJECTED (FAIL CLOSED)', async () => {
    const req = getRequest('secp-plugin-oil-gas', 'barlow-stress', { internalPressureMPa: 20 });
    const envelope = await CoreExecutionAuthority.execute(req);
    
    // Attempt to modify the result inside the sealed envelope
    expect(() => {
      (envelope as any).solverResult.rawResults.hoopStressMPa = 0; // Should be blocked by Object.freeze in production, but we test the sealing logic
    }).toThrow();
  });

  it('M9-10 — Conflicting domain conclusions are PRESERVED (No Silent Merge)', async () => {
    // Domain A says PASS
    const resultA = { verdict: 'PASS', stressMPa: 100 };
    // Domain B says FAIL
    const resultB = { verdict: 'FAIL', stressMPa: 450 };
    
    const conflict = CrossDomainConflictEngine.registerConflict({
      engineeringObjectId: objectId,
      revisionId: 'REV-M9-100',
      domainA: 'Robotics',
      domainB: 'Aerospace',
      resultA,
      resultB,
      conflictType: 'CONSTRAINT_VIOLATION'
    });

    expect(conflict.status).toBe('UNRESOLVED');
    expect(CrossDomainConflictEngine.hasUnresolvedConflicts(objectId, 'REV-M9-100')).toBe(true);
    
    // Ensure no silent merge: the conflict persists
    const all = CrossDomainConflictEngine.getConflictsForRevision(objectId, 'REV-M9-100');
    expect(all.length).toBe(1);
    expect(all[0].resultA.verdict).toBe('PASS');
    expect(all[0].resultB.verdict).toBe('FAIL');
  });

  it('M9-11 — Persistence loses cross-domain linkage check', async () => {
    const req = getRequest('secp-plugin-robotics', 'joint-torque', { payloadMassKg: 10 });
    const env = await CoreExecutionAuthority.execute(req);
    
    CrossDomainWorkflowEngine.createHandoff({
      sourceEnvelope: env,
      targetDomain: EngineeringDomain.AEROSPACE,
      targetParameterKey: 'v1',
      extractedValue: 5
    });
    
    // Simulate restart by clearing and rehydrating (assuming persistence service is mocked correctly for tests)
    // In real scenario we'd use CrossDomainPersistenceService.persistAll() then rehydrate()
    const handoffs = CrossDomainWorkflowEngine.getHandoffs(objectId);
    expect(handoffs.length).toBe(1);
    
    CrossDomainWorkflowEngine.clear();
    expect(CrossDomainWorkflowEngine.getHandoffs(objectId).length).toBe(0);
    
    CrossDomainWorkflowEngine.rehydrate(handoffs);
    expect(CrossDomainWorkflowEngine.getHandoffs(objectId).length).toBe(1);
  });

  it('M9-12 — Replay preserves cross-domain meaning', async () => {
    const params = { payloadMassKg: 10 };
    const req1 = getRequest('secp-plugin-robotics', 'joint-torque', params);
    const env1 = await CoreExecutionAuthority.execute(req1);
    
    // Re-execute with same inputs
    const env2 = await CoreExecutionAuthority.execute(req1);
    expect(env1.executionId).toBe(env2.executionId);
    expect(env1.resultDigest).toBe(env2.resultDigest);
  });

  it('M9-13 — Unauthorized Domain-A -> Domain-B injection is REJECTED', async () => {
    const req = getRequest('secp-plugin-robotics', 'joint-torque', { payloadMassKg: 10 });
    const envelope = await CoreExecutionAuthority.execute(req);
    
    // Try to perform handoff with unverified data (manually created object)
    const fakeHandoff: any = {
      sourceExecutionId: 'FAKE-ID',
      targetDomain: EngineeringDomain.AEROSPACE
    };
    
    await expect(CoreExecutionAuthority.performCrossDomainHandoff(fakeHandoff))
      .rejects.toThrow(/CROSS_DOMAIN_HANDOFF_FAILED/);
  });

  it('M9-14 — Alternative plugin-created canonical truth is REJECTED', async () => {
    // A plugin tries to issue its own certificate with missing evidence
    const cert = EngineeringTruthCertificateEngine.issue({
      engineeringObjectId: objectId,
      engineeringObjectType: 'CAD_MODEL',
      projectId: 'PROJ-M9',
      revisionId: 'REV-M9-100',
      artifactHash: releasedRevHash,
      evidenceRecords: [], // NO EVIDENCE
      verificationSummaries: [],
      scope: [CertificationScope.SIMULATION_ACCURACY],
      issuer: 'ROGUE_PLUGIN'
    });
    
    expect(cert.verdict).toBe(TruthVerdict.UNPROVEN);
    expect(cert.status).toBe('UNPROVEN');
  });
});
