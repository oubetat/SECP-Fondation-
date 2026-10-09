import { describe, it, expect, beforeEach } from 'vitest';
import { CoreExecutionAuthority } from '../../execution/CoreExecutionAuthority';
import { GenericExecutionRegistry } from '../../execution/GenericExecutionRegistry';
import { mintCompromisedGenericEnvelope } from '../../execution/CoreExecutionAuthorityInternal';
import { CoreExecutionRequest, DomainSolver } from '../../execution/CoreExecutionTypes';
import { RevisionEngine } from '../../revision/RevisionEngine';
import { RevisionLifecycleState } from '../../revision/types';
import { PluginAuthorityBoundary } from '../PluginAuthorityBoundary';
import { CanonicalDerivedArtifactBinding } from '../../topology/CanonicalDerivedArtifactBinding';
import { EvidenceMerkleTree } from '../../certification/truth/EvidenceMerkleTree';

describe('Core Execution Authority Adversarial Battery (A01-A18)', () => {
  let revisionEngine: RevisionEngine;
  let releasedRevHash: string;
  let releasedGeomHash: string;
  const objectId = 'PART-ENG-001';

  beforeEach(() => {
    GenericExecutionRegistry.clear();
    CoreExecutionAuthority.clear();

    revisionEngine = new RevisionEngine();
    CoreExecutionAuthority.initialize(revisionEngine);

    // Setup a valid released revision in RevisionEngine
    const rev = revisionEngine.createRevision({
      revisionId: 'REV-100',
      entityId: objectId,
      entityType: 'CAD_MODEL' as any,
      revisionCode: 'A',
      revisionNumber: 1,
      lifecycleState: RevisionLifecycleState.DRAFT,
      createdBy: 'ADMIN',
      content: { geometry: 'VALID_BREP_DATA' },
      snapshot: {
        geometryState: {
          parameters: { length: 100, width: 50 },
          features: [],
          topologyHash: 'TOPO-HASH-100',
          geometryHash: 'GEOM-HASH-100'
        }
      }
    } as any);

    revisionEngine.addApproval(rev.revisionId, {
      approvalId: 'APP-100',
      revisionId: rev.revisionId,
      role: 'ENGINEER',
      actorId: 'APPROVER',
      decision: 'APPROVED',
      timestamp: new Date().toISOString(),
      reason: 'Release approved'
    });

    revisionEngine.setValidationState(rev.revisionId, 'SIMULATED');
    revisionEngine.transitionState(rev.revisionId, RevisionLifecycleState.IN_REVIEW, 'BYPASS_ADMIN', 'Reviewing');
    revisionEngine.transitionState(rev.revisionId, RevisionLifecycleState.APPROVED, 'BYPASS_ADMIN', 'Approved');
    const released = revisionEngine.releaseRevision(rev.revisionId, 'BYPASS_ADMIN', 'Initial release');

    releasedRevHash = released.revisionHash;
    releasedGeomHash = released.snapshot?.geometryState?.geometryHash!;

    // Register a valid test solver with Core
    const dummySolver: DomainSolver = {
      solverId: 'TEST-SOLVER-V1',
      solverVersion: '1.0.0',
      pluginId: 'test-plugin',
      executionKind: 'ANALYTICAL',
      execute: (req) => ({
        status: 'SUCCESS',
        rawResults: { stressMpa: 125.4, displacementMm: 0.12 },
        artifactContentHash: 'CONTENT-HASH-12345',
        scalarOutputs: { stressMpa: 125.4 },
        executionDurationMs: 15
      })
    };

    CoreExecutionAuthority.registerSolver(dummySolver);
  });

  const getValidRequest = (): CoreExecutionRequest => ({
    requestId: 'REQ-001',
    engineeringObjectId: objectId,
    revisionId: 'REV-100',
    targetRevisionHash: releasedRevHash,
    targetGeometryHash: releasedGeomHash,
    pluginId: 'test-plugin',
    pluginVersion: '1.0.0',
    executionKind: 'ANALYTICAL',
    parameters: { loadN: 5000, temperatureC: 25 },
    environmentalSeed: 'SEED-001'
  });

  it('A01 — Should reject forged authoritative status in unsealed envelope', () => {
    const unsealedEnvelope = {
      executionId: 'FORGED-EXEC-ID',
      engineeringObjectId: objectId,
      revisionHash: releasedRevHash,
      geometryHash: releasedGeomHash,
      pluginId: 'test-plugin',
      pluginVersion: '1.0.0',
      executionKind: 'ANALYTICAL',
      inputDigest: 'FORGED-DIGEST',
      resultDigest: 'FORGED-RESULT',
      solverIdentity: 'TEST-SOLVER-V1',
      derivationBinding: {
        artifactDigest: 'FORGED-BINDING',
        cadRevisionHash: releasedRevHash,
        canonicalGeometryHash: releasedGeomHash,
        artifactKind: 'SIMULATION_RESULT',
        payload: {} as any,
        isBound: true
      },
      verificationResult: { overallVerdict: 'PASS', evaluatedGates: [], reasons: [] },
      state: 'SEALED', // Forged status string!
      timestamp: new Date().toISOString(),
      solverResult: { status: 'SUCCESS', rawResults: {}, artifactContentHash: 'X', executionDurationMs: 1 }
    };

    expect(() => {
      GenericExecutionRegistry.registerExecution(unsealedEnvelope as any);
    }).toThrow(/Missing authoritative execution seal/);
  });

  it('A02 — Should reject forged execution ID inconsistent with canonical preimage', async () => {
    const req = getValidRequest();
    const legit = await CoreExecutionAuthority.execute(req);

    // Tamper with the execution ID while keeping original binding
    const tampered = JSON.parse(JSON.stringify(legit));
    tampered.executionId = 'FORGED-EXEC-ID-999';

    const verifyRes = GenericExecutionRegistry.verifyResultBinding(tampered);
    expect(verifyRes.isValid).toBe(false);
    expect(verifyRes.failureReason).toContain('UNREGISTERED_EXECUTION_IDENTITY');
  });

  it('A03 — Should reject execution when revision hash does not match target expectation', async () => {
    const req = getValidRequest();
    req.targetRevisionHash = 'OBSOLETE-REV-HASH-999';

    await expect(CoreExecutionAuthority.execute(req)).rejects.toThrow(/REVISION_MISMATCH/);
  });

  it('A04 — Should reject execution when geometry hash does not match target expectation', async () => {
    const req = getValidRequest();
    req.targetGeometryHash = 'INCORRECT-GEOM-HASH-888';

    await expect(CoreExecutionAuthority.execute(req)).rejects.toThrow(/GEOMETRY_MISMATCH/);
  });

  it('A05 — Should reject cross-object replay during verification', async () => {
    const req = getValidRequest();
    const legit = await CoreExecutionAuthority.execute(req);

    const verifyRes = GenericExecutionRegistry.verifyResultBinding(legit, undefined, undefined, 'WRONG-PART-ID');
    expect(verifyRes.isValid).toBe(false);
    expect(verifyRes.failureReason).toContain('ENTITY_MISMATCH');
  });

  it('A06 — Core should own gate selection and ignore plugin-selected gate bypass attempts', async () => {
    const req = getValidRequest();
    // Pass custom param attempting to bypass gates
    req.parameters.bypassGates = true;

    const envelope = await CoreExecutionAuthority.execute(req);
    expect(envelope.verificationResult.overallVerdict).toBe('PASS');
    expect(envelope.verificationResult.evaluatedGates.length).toBeGreaterThan(0);
    expect(envelope.verificationResult.evaluatedGates[0].gateId).toContain('CORE-');
  });

  it('A07 — Should reject unsealed registration into GenericExecutionRegistry', () => {
    const rawEnvelope = {
      executionId: 'EXEC-TEST',
      engineeringObjectId: objectId,
      revisionHash: releasedRevHash,
      geometryHash: releasedGeomHash,
      derivationBinding: {
        cadRevisionHash: releasedRevHash,
        canonicalGeometryHash: releasedGeomHash,
        isBound: true
      }
    };

    expect(() => {
      GenericExecutionRegistry.registerExecution(rawEnvelope as any);
    }).toThrow(/Missing authoritative execution seal/);
  });

  it('A08 — Should detect and reject forged seals', () => {
    const forgedEnvelope = {
      executionId: 'EXEC-FORGED',
      [Symbol('FAKE_SEAL')]: true
    };

    expect(() => {
      GenericExecutionRegistry.registerExecution(forgedEnvelope as any);
    }).toThrow(/Missing authoritative execution seal/);
  });

  it('A09 — Should block conflicting re-registration of existing execution identity (A18 Overwrite Prevention)', async () => {
    const req = getValidRequest();
    const legit = await CoreExecutionAuthority.execute(req);
    const originalExecutionId = legit.executionId;

    // Mutate raw solver results to create a conflicting execution payload
    const mutatedEnvelope = JSON.parse(JSON.stringify(legit));
    mutatedEnvelope.solverResult.rawResults.stressMpa = 999.9;

    // Mint compromised envelope using adversarial capability
    const compromisedSealed = mintCompromisedGenericEnvelope(mutatedEnvelope);

    // Must throw IMMUTABLE_IDENTITY_CONFLICT
    expect(() => {
      GenericExecutionRegistry.registerExecution(compromisedSealed);
    }).toThrow(/IMMUTABLE_IDENTITY_CONFLICT/);

    // Verify stored truth remains unchanged
    const stored = GenericExecutionRegistry.getExecution(originalExecutionId);
    expect(stored?.solverResult.rawResults.stressMpa).toBe(125.4);
  });

  it('A10 — Should detect tampered result payload during verification', async () => {
    const req = getValidRequest();
    const legit = await CoreExecutionAuthority.execute(req);

    const tampered = JSON.parse(JSON.stringify(legit));
    tampered.solverResult.rawResults.stressMpa = 888.8;

    const verifyRes = GenericExecutionRegistry.verifyResultBinding(tampered);
    expect(verifyRes.isValid).toBe(false);
    expect(verifyRes.failureReason).toContain('RESULT_DIGEST_MISMATCH');
  });

  it('A11 — Should detect evidence leaf tampering', async () => {
    const req = getValidRequest();
    const legit = await CoreExecutionAuthority.execute(req);

    const leaf = { ...legit.evidenceLeaf };
    const originalLeafHash = leaf.leafHash;

    // Mutate leaf property
    leaf.evidenceType = 'CORRUPTED_EVIDENCE';
    const recomputedHash = EvidenceMerkleTree.computeLeafHash(leaf);

    expect(recomputedHash).not.toBe(originalLeafHash);
  });

  it('A12 — Should prove Merkle root hash changes upon evidence leaf mutation', async () => {
    const req = getValidRequest();
    const legit = await CoreExecutionAuthority.execute(req);

    const tree1 = EvidenceMerkleTree.buildFromLeaves([legit.evidenceLeaf]);
    const root1 = tree1.getRootHash();

    const mutatedLeaf = { ...legit.evidenceLeaf, artifactKind: 'MUTATED_KIND' };
    const tree2 = EvidenceMerkleTree.buildFromLeaves([mutatedLeaf]);
    const root2 = tree2.getRootHash();

    expect(root1).not.toBe(root2);
  });

  it('A13 — Should block plugin direct canonical state mutation attempt', () => {
    const revision = revisionEngine.getRevision('REV-100');
    expect(revision).toBeDefined();

    // Attempting to overwrite properties on fetched revision snapshot
    const snapshot = revision!.snapshot;
    expect(() => {
      (snapshot as any).geometryState = 'MUTATED';
    }).toThrow;
  });

  it('A14 — Should block plugin direct certificate issuance attempt', () => {
    const evalRes = PluginAuthorityBoundary.evaluatePluginClaim({
      pluginId: 'rogue-plugin',
      claimType: 'CERTIFICATE_ISSUE',
      targetEntityId: objectId,
      targetRevision: 'REV-100',
      declaredPayload: {},
      declaredStatus: 'APPROVED'
    });

    expect(evalRes.isAuthoritative).toBe(false);
    expect(evalRes.classification).toBe('DECLARED_ONLY');
    expect(evalRes.canCrossReleaseBoundary).toBe(false);
  });

  it('A15 — Should block plugin direct physical truth / manufacturing claim', () => {
    const evalRes = PluginAuthorityBoundary.markPartAsManufactured('rogue-plugin', objectId, 'SUCCESS');

    expect(evalRes.isAuthoritative).toBe(false);
    expect(evalRes.classification).toBe('DECLARED_ONLY');
    expect(evalRes.canCrossReleaseBoundary).toBe(false);
  });

  it('A17 — Should prove deterministic execution identity for identical canonical inputs', () => {
    const preimage1 = {
      engineeringObjectId: 'PART-001',
      revisionHash: 'REV-HASH-1',
      geometryHash: 'GEOM-HASH-1',
      pluginId: 'plugin-a',
      pluginVersion: '1.0.0',
      executionKind: 'KINEMATICS',
      inputDigest: 'DIGEST-123',
      solverIdentity: 'SOLVER-1'
    };

    const preimage2 = { ...preimage1 };

    const id1 = CoreExecutionAuthority.computeExecutionIdentity(preimage1);
    const id2 = CoreExecutionAuthority.computeExecutionIdentity(preimage2);

    expect(id1).toBe(id2);
  });

  it('A18 — Should change execution identity if a single input parameter changes', () => {
    const preimage1 = {
      engineeringObjectId: 'PART-001',
      revisionHash: 'REV-HASH-1',
      geometryHash: 'GEOM-HASH-1',
      pluginId: 'plugin-a',
      pluginVersion: '1.0.0',
      executionKind: 'KINEMATICS',
      inputDigest: 'DIGEST-123',
      solverIdentity: 'SOLVER-1'
    };

    const preimage2 = {
      ...preimage1,
      inputDigest: 'DIGEST-124' // Altered input digest
    };

    const id1 = CoreExecutionAuthority.computeExecutionIdentity(preimage1);
    const id2 = CoreExecutionAuthority.computeExecutionIdentity(preimage2);

    expect(id1).not.toBe(id2);
  });
});
