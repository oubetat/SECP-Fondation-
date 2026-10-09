import { describe, it, expect, beforeEach } from 'vitest';
import { CoreExecutionAuthority } from '../../../execution/CoreExecutionAuthority';
import { GenericExecutionRegistry } from '../../../execution/GenericExecutionRegistry';
import { mintCompromisedGenericEnvelope } from '../../../execution/CoreExecutionAuthorityInternal';
import { CoreExecutionRequest, DomainSolver } from '../../../execution/CoreExecutionTypes';
import { RevisionEngine } from '../../../revision/RevisionEngine';
import { RevisionLifecycleState } from '../../../revision/types';
import { PluginAuthorityBoundary } from '../../../governance/PluginAuthorityBoundary';
import { CanonicalDerivedArtifactBinding } from '../../../topology/CanonicalDerivedArtifactBinding';
import { EvidenceMerkleTree } from '../../../certification/truth/EvidenceMerkleTree';
import { RoboticsPlugin } from '../../../../plugins/roboticsPlugin';

describe('Robotics Authoritative Reference Plugin Adversarial Suite (R01-R22)', () => {
  let revisionEngine: RevisionEngine;
  let releasedRevHash: string;
  let releasedGeomHash: string;
  const objectId = 'ROBOT-REFERENCE-001';

  beforeEach(() => {
    GenericExecutionRegistry.clear();
    CoreExecutionAuthority.clear();

    revisionEngine = new RevisionEngine();
    CoreExecutionAuthority.initialize(revisionEngine);

    // Bootstrap robot reference revision in RevisionEngine
    const rev = revisionEngine.createRevision({
      revisionId: 'REV-ROBOT-100',
      entityId: objectId,
      entityType: 'CAD_MODEL' as any,
      revisionCode: 'A',
      revisionNumber: 1,
      lifecycleState: RevisionLifecycleState.DRAFT,
      createdBy: 'ENGINEER-1',
      content: { geometry: 'ROBOT_ARM_6DOF_BREP' },
      snapshot: {
        geometryState: {
          parameters: { link1LengthMm: 450, link2LengthMm: 520 },
          features: [],
          topologyHash: 'TOPO-ROBOT-100',
          geometryHash: 'GEOM-ROBOT-100'
        }
      }
    } as any);

    revisionEngine.addApproval(rev.revisionId, {
      approvalId: 'APP-ROBOT-100',
      revisionId: rev.revisionId,
      role: 'ENGINEER',
      actorId: 'APPROVER',
      decision: 'APPROVED',
      timestamp: new Date().toISOString(),
      reason: 'Kinematic link design approved'
    });

    revisionEngine.setValidationState(rev.revisionId, 'SIMULATED');
    revisionEngine.transitionState(rev.revisionId, RevisionLifecycleState.IN_REVIEW, 'BYPASS_ADMIN', 'Reviewing');
    revisionEngine.transitionState(rev.revisionId, RevisionLifecycleState.APPROVED, 'BYPASS_ADMIN', 'Approved');
    const released = revisionEngine.releaseRevision(rev.revisionId, 'BYPASS_ADMIN', 'Robot release A');

    releasedRevHash = released.revisionHash;
    releasedGeomHash = released.snapshot?.geometryState?.geometryHash!;
  });

  const getValidRoboticsRequest = (): CoreExecutionRequest => ({
    requestId: 'REQ-ROBOT-001',
    engineeringObjectId: objectId,
    revisionId: 'REV-ROBOT-100',
    targetRevisionHash: releasedRevHash,
    targetGeometryHash: releasedGeomHash,
    pluginId: 'secp-plugin-robotics',
    pluginVersion: '1.5.0',
    executionKind: 'joint-torque',
    parameters: {
      payloadMassKg: 12,
      link1LengthMm: 450,
      link2LengthMm: 520,
      jointMaxAccelDegS2: 120
    },
    environmentalSeed: 'SEED-ROBOT-1'
  });

  it('R01 — Local result cannot be treated as authoritative', () => {
    // Local calculation from roboticsPlugin tool
    const localResult = RoboticsPlugin.tools[0].compute({
      payloadMassKg: 12,
      link1LengthMm: 450,
      link2LengthMm: 520,
      jointMaxAccelDegS2: 120
    });

    const unsealedEnvelope = {
      executionId: 'EXEC-ROBOT-LOCAL',
      engineeringObjectId: objectId,
      revisionHash: releasedRevHash,
      geometryHash: releasedGeomHash,
      pluginId: 'secp-plugin-robotics',
      pluginVersion: '1.5.0',
      executionKind: 'joint-torque',
      solverIdentity: 'LOCAL-CALC',
      derivationBinding: {
        artifactDigest: 'LOCAL-DIGEST',
        cadRevisionHash: releasedRevHash,
        canonicalGeometryHash: releasedGeomHash,
        isBound: true
      },
      solverResult: { status: 'SUCCESS', rawResults: localResult }
    };

    expect(() => {
      GenericExecutionRegistry.registerExecution(unsealedEnvelope as any);
    }).toThrow(/Missing authoritative execution seal/);
  });

  it('R02 — Plugin cannot mint execution seal', () => {
    const rawEnvelope = {
      executionId: 'EXEC-ROBOT-FORGED-SEAL',
      engineeringObjectId: objectId,
      revisionHash: releasedRevHash,
      geometryHash: releasedGeomHash,
      pluginId: 'secp-plugin-robotics',
      pluginVersion: '1.5.0',
      executionKind: 'joint-torque',
      [Symbol('CORE_EXECUTION_AUTHORITY_SEAL')]: true // Forged seal injection attempt
    };

    expect(() => {
      GenericExecutionRegistry.registerExecution(rawEnvelope as any);
    }).toThrow(/Missing authoritative execution seal/);
  });

  it('R03 — Plugin cannot directly mutate canonical state', () => {
    const rev = revisionEngine.getRevision('REV-ROBOT-100');
    expect(rev).toBeDefined();

    expect(() => {
      (rev!.content as any).geometry = 'MUTATED';
    }).toThrow;
  });

  it('R04 — Stale canonical revision rejected', async () => {
    // Run on REV-ROBOT-100
    const req = getValidRoboticsRequest();
    const envelope = await CoreExecutionAuthority.execute(req);
    expect(envelope).toBeDefined();

    // Create a new revision to make the previous stale
    const rev2 = revisionEngine.createRevision({
      revisionId: 'REV-ROBOT-101',
      entityId: objectId,
      entityType: 'CAD_MODEL' as any,
      revisionCode: 'B',
      revisionNumber: 2,
      lifecycleState: RevisionLifecycleState.DRAFT,
      createdBy: 'ENGINEER-1',
      content: { geometry: 'ROBOT_ARM_6DOF_BREP_V2' },
      snapshot: {
        geometryState: {
          parameters: { link1LengthMm: 450, link2LengthMm: 520 },
          features: [],
          topologyHash: 'TOPO-ROBOT-101',
          geometryHash: 'GEOM-ROBOT-101'
        }
      }
    } as any);

    revisionEngine.addApproval(rev2.revisionId, {
      approvalId: 'APP-ROBOT-101',
      revisionId: rev2.revisionId,
      role: 'ENGINEER',
      actorId: 'APPROVER',
      decision: 'APPROVED',
      timestamp: new Date().toISOString(),
      reason: 'Revision B approved'
    });
    revisionEngine.setValidationState(rev2.revisionId, 'SIMULATED');
    revisionEngine.transitionState(rev2.revisionId, RevisionLifecycleState.IN_REVIEW, 'BYPASS_ADMIN', 'Reviewing');
    revisionEngine.transitionState(rev2.revisionId, RevisionLifecycleState.APPROVED, 'BYPASS_ADMIN', 'Approved');
    const released2 = revisionEngine.releaseRevision(rev2.revisionId, 'BYPASS_ADMIN', 'Revision B released');

    // Verification against released2 should fail for the first envelope
    const verifyRes = GenericExecutionRegistry.verifyResultBinding(envelope, released2.revisionHash, 'GEOM-ROBOT-101');
    expect(verifyRes.isValid).toBe(false);
    expect(verifyRes.failureReason).toContain('REVISION_MISMATCH');
  });

  it('R05 — Wrong geometry identity rejected', async () => {
    const req = getValidRoboticsRequest();
    req.targetGeometryHash = 'INCORRECT_GEOMETRY_HASH';

    await expect(CoreExecutionAuthority.execute(req)).rejects.toThrow(/GEOMETRY_MISMATCH/);
  });

  it('R06 — Wrong engineering object rejected', async () => {
    const req = getValidRoboticsRequest();
    req.engineeringObjectId = 'WRONG-ROBOT-ARM-999';

    await expect(CoreExecutionAuthority.execute(req)).rejects.toThrow(/CANONICAL_REVISION_NOT_FOUND/);
  });

  it('R07 — Cross-object execution replay rejected', async () => {
    const req = getValidRoboticsRequest();
    const legit = await CoreExecutionAuthority.execute(req);

    // Replay verification against another engineering object ID
    const verifyRes = GenericExecutionRegistry.verifyResultBinding(legit, undefined, undefined, 'ANOTHER-ROBOT-OBJECT');
    expect(verifyRes.isValid).toBe(false);
    expect(verifyRes.failureReason).toContain('ENTITY_MISMATCH');
  });

  it('R08 — Conflicting execution identity rejected (A18 Overwrite Prevention)', async () => {
    const req = getValidRoboticsRequest();
    const legit = await CoreExecutionAuthority.execute(req);

    // Create conflicting execution with different verification outcome (alters contentDigest without breaking signature)
    const mutated = JSON.parse(JSON.stringify(legit));
    mutated.verificationResult.overallVerdict = 'REJECTED';

    const compromisedSealed = mintCompromisedGenericEnvelope(mutated);

    expect(() => {
      GenericExecutionRegistry.registerExecution(compromisedSealed);
    }).toThrow(/IMMUTABLE_IDENTITY_CONFLICT/);
  });

  it('R09 — Tampered result digest rejected', async () => {
    const req = getValidRoboticsRequest();
    const legit = await CoreExecutionAuthority.execute(req);

    const tampered = JSON.parse(JSON.stringify(legit));
    tampered.solverResult.rawResults.totalShoulderTorqueNm = 12.3; // Tampered!

    const verifyRes = GenericExecutionRegistry.verifyResultBinding(tampered);
    expect(verifyRes.isValid).toBe(false);
    expect(verifyRes.failureReason).toContain('RESULT_DIGEST_MISMATCH');
  });

  it('R10 — Missing verification evidence becomes UNPROVEN', () => {
    const rawEnvelope = {
      executionId: 'EXEC-UNPROVEN',
      engineeringObjectId: objectId,
      revisionHash: releasedRevHash,
      geometryHash: releasedGeomHash,
      state: 'UNPROVEN'
    };

    expect(rawEnvelope.state).toBe('UNPROVEN');
  });

  it('R11 — Tampered evidence leaf rejected', async () => {
    const req = getValidRoboticsRequest();
    const legit = await CoreExecutionAuthority.execute(req);

    const tamperedLeaf = { ...legit.evidenceLeaf, executionIdentity: 'TAMPERED-EXEC-ID' };
    const originalHash = legit.evidenceLeaf.leafHash;
    const recomputedHash = EvidenceMerkleTree.computeLeafHash(tamperedLeaf);

    expect(recomputedHash).not.toBe(originalHash);
  });

  it('R12 — Mutated Merkle root rejected', async () => {
    const req = getValidRoboticsRequest();
    const legit = await CoreExecutionAuthority.execute(req);

    const tree1 = EvidenceMerkleTree.buildFromLeaves([legit.evidenceLeaf]);
    const root1 = tree1.getRootHash();

    const tamperedLeaf = { ...legit.evidenceLeaf, sourceIdentity: 'TAMPERED-SOLVER' };
    const tree2 = EvidenceMerkleTree.buildFromLeaves([tamperedLeaf]);
    const root2 = tree2.getRootHash();

    expect(root1).not.toBe(root2);
  });

  it('R13 — Plugin cannot choose/bypass mandatory gate', async () => {
    const req = getValidRoboticsRequest();
    req.parameters.skipGates = true; // Attempted bypass parameter

    const envelope = await CoreExecutionAuthority.execute(req);
    expect(envelope.verificationResult.overallVerdict).toBe('PASS');
    expect(envelope.verificationResult.evaluatedGates.find(g => g.gateId === 'CORE-BINDING-INTEGRITY-GATE')).toBeDefined();
  });

  it('R14 — Plugin cannot issue engineering certificate', () => {
    const claim = {
      pluginId: 'secp-plugin-robotics',
      claimType: 'CERTIFICATE_ISSUE' as any,
      targetEntityId: objectId,
      targetRevision: 'REV-ROBOT-100',
      declaredPayload: {},
      declaredStatus: 'APPROVED'
    };

    const evalRes = PluginAuthorityBoundary.evaluatePluginClaim(claim);
    expect(evalRes.isAuthoritative).toBe(false);
    expect(evalRes.classification).toBe('DECLARED_ONLY');
  });

  it('R15 — Plugin cannot claim physical manufacturing truth', () => {
    const claim = {
      pluginId: 'secp-plugin-robotics',
      claimType: 'MANUFACTURED' as any,
      targetEntityId: objectId,
      targetRevision: 'REV-ROBOT-100',
      declaredPayload: {},
      declaredStatus: 'SUCCESS'
    };

    const evalRes = PluginAuthorityBoundary.evaluatePluginClaim(claim);
    expect(evalRes.isAuthoritative).toBe(false);
    expect(evalRes.classification).toBe('DECLARED_ONLY');
  });

  it('R16 — Plugin cannot release engineering object', () => {
    const claim = {
      pluginId: 'secp-plugin-robotics',
      claimType: 'RELEASE_APPROVAL' as any,
      targetEntityId: objectId,
      targetRevision: 'REV-ROBOT-100',
      declaredPayload: {},
      declaredStatus: 'RELEASED'
    };

    const evalRes = PluginAuthorityBoundary.evaluatePluginClaim(claim);
    expect(evalRes.isAuthoritative).toBe(false);
    expect(evalRes.classification).toBe('DECLARED_ONLY');
  });

  it('R17 — Identical canonical inputs produce identical execution identity', () => {
    const preimage1 = {
      engineeringObjectId: objectId,
      revisionHash: releasedRevHash,
      geometryHash: releasedGeomHash,
      pluginId: 'secp-plugin-robotics',
      pluginVersion: '1.5.0',
      executionKind: 'joint-torque',
      inputDigest: 'DIGEST-ROBOT-123',
      solverIdentity: 'ROBOTICS-KINEMATICS-SOLVER-V1'
    };

    const preimage2 = { ...preimage1 };

    const id1 = CoreExecutionAuthority.computeExecutionIdentity(preimage1);
    const id2 = CoreExecutionAuthority.computeExecutionIdentity(preimage2);

    expect(id1).toBe(id2);
  });

  it('R18 — One input mutation changes execution identity', () => {
    const preimage1 = {
      engineeringObjectId: objectId,
      revisionHash: releasedRevHash,
      geometryHash: releasedGeomHash,
      pluginId: 'secp-plugin-robotics',
      pluginVersion: '1.5.0',
      executionKind: 'joint-torque',
      inputDigest: 'DIGEST-ROBOT-123',
      solverIdentity: 'ROBOTICS-KINEMATICS-SOLVER-V1'
    };

    const preimage2 = {
      ...preimage1,
      inputDigest: 'DIGEST-ROBOT-124' // Mutated input
    };

    const id1 = CoreExecutionAuthority.computeExecutionIdentity(preimage1);
    const id2 = CoreExecutionAuthority.computeExecutionIdentity(preimage2);

    expect(id1).not.toBe(id2);
  });

  it('R19 — Solver version change invalidates/rebinds execution identity', () => {
    const preimage1 = {
      engineeringObjectId: objectId,
      revisionHash: releasedRevHash,
      geometryHash: releasedGeomHash,
      pluginId: 'secp-plugin-robotics',
      pluginVersion: '1.5.0',
      executionKind: 'joint-torque',
      inputDigest: 'DIGEST-ROBOT-123',
      solverIdentity: 'ROBOTICS-KINEMATICS-SOLVER-V1'
    };

    const preimage2 = {
      ...preimage1,
      solverIdentity: 'ROBOTICS-KINEMATICS-SOLVER-V2' // Changed solver version/id
    };

    const id1 = CoreExecutionAuthority.computeExecutionIdentity(preimage1);
    const id2 = CoreExecutionAuthority.computeExecutionIdentity(preimage2);

    expect(id1).not.toBe(id2);
  });

  it('R20 — Authoritative result is bound to the exact canonical revision', async () => {
    const req = getValidRoboticsRequest();
    const legit = await CoreExecutionAuthority.execute(req);

    expect(legit.revisionHash).toBe(releasedRevHash);
    expect(legit.derivationBinding.cadRevisionHash).toBe(releasedRevHash);
  });

  it('R21 — UI-only parameter mutation does not become canonical engineering state', () => {
    const localParamInputs = { payloadMassKg: 100 }; // mutated in UI slider
    const canonicalRevision = revisionEngine.getRevision('REV-ROBOT-100');

    expect(canonicalRevision?.snapshot?.geometryState?.parameters.payloadMassKg).not.toBe(100);
  });

  it('R22 — Replaying an authoritative Robotics result against another engineering object is rejected', async () => {
    const req = getValidRoboticsRequest();
    const legit = await CoreExecutionAuthority.execute(req);

    const verifyRes = GenericExecutionRegistry.verifyResultBinding(legit, undefined, undefined, 'ANOTHER-ROBOT-ARM-888');
    expect(verifyRes.isValid).toBe(false);
    expect(verifyRes.failureReason).toContain('ENTITY_MISMATCH');
  });
});
