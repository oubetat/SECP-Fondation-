import { describe, it, expect, beforeEach } from 'vitest';
import { SimulationEngine } from '../SimulationEngine';
import { SimulationExecutionRegistry } from '../SimulationExecutionRegistry';
import { SimulationIdentityService } from '../SimulationIdentityService';
import { RevisionEngine } from '../../revision/RevisionEngine';
import { CanonicalDerivedArtifactBinding } from '../../topology/CanonicalDerivedArtifactBinding';
import { mintCompromisedEnvelope } from '../SimulationAuthorityInternal';
import { RevisionLifecycleState } from '../../revision/types';

describe('Simulation Execution Authority Adversarial Battery', () => {
  let revisionEngine: RevisionEngine;
  let releasedRevHash: string;
  let releasedGeomHash: string;

  beforeEach(() => {
    SimulationExecutionRegistry.clear();
    revisionEngine = new RevisionEngine();
    SimulationIdentityService.initialize(revisionEngine);

    // Setup a valid released revision
    const rev = revisionEngine.createRevision({
      revisionId: 'REV-1',
      entityId: 'PART-1',
      entityType: 'CAD_MODEL' as any,
      revisionCode: 'A',
      revisionNumber: 1,
      lifecycleState: RevisionLifecycleState.DRAFT,
      createdBy: 'ADMIN',
      content: { geometry: 'DATA' },
      snapshot: {
        geometryState: {
          parameters: {},
          features: [],
          topologyHash: 'TOPO-1',
          geometryHash: 'GEOM-1'
        }
      }
    } as any);
    revisionEngine.addApproval(rev.revisionId, {
      approvalId: 'APP-1',
      revisionId: rev.revisionId,
      role: 'ENGINEER',
      actorId: 'APPROVER',
      decision: 'APPROVED',
      timestamp: new Date().toISOString(),
      reason: 'Looks good'
    });
    revisionEngine.setValidationState(rev.revisionId, 'SIMULATED');
    revisionEngine.transitionState(rev.revisionId, RevisionLifecycleState.IN_REVIEW, 'BYPASS_ADMIN', 'Reviewing');
    revisionEngine.transitionState(rev.revisionId, RevisionLifecycleState.APPROVED, 'BYPASS_ADMIN', 'Approved');
    const released = revisionEngine.releaseRevision(rev.revisionId, 'BYPASS_ADMIN', 'Initial release');

    releasedRevHash = released.revisionHash;
    releasedGeomHash = released.snapshot?.geometryState?.geometryHash!;
  });

  const getValidScenario = () => ({
    id: 'SCENARIO-1',
    revision: 1,
    geometry: { 
        modelId: 'PART-1', 
        geometryHash: releasedGeomHash, 
        hash: releasedRevHash 
    },
    parameters: [],
    material: { materialId: 'STEEL' },
    mesh: { hash: 'MESH-1' },
    boundaryConditions: [],
    loads: [],
    solver: { solverId: 'ANSYS' }
  } as any);

  it('A1-A4: Should not allow public token minting or arbitrary registration', () => {
    // Registry no longer has createExecutionToken
    expect((SimulationExecutionRegistry as any).createExecutionToken).toBeUndefined();

    const forgedResult = { provenanceHash: 'FORGED' };
    expect(() => {
      SimulationExecutionRegistry.registerExecution({
        provenanceHash: 'FORGED',
        result: forgedResult,
        authoritativeRevisionHash: 'ANY',
        authoritativeGeometryHash: 'ANY',
        timestamp: new Date().toISOString()
      } as any);
    }).toThrow(/Missing authoritative execution seal/);
  });

  it('A5-A7: Should reject self-signed binding registration', () => {
    const binding = CanonicalDerivedArtifactBinding.createBinding({
      cadRevisionHash: releasedRevHash,
      canonicalGeometryHash: releasedGeomHash,
      artifactKind: 'SIMULATION_RESULT',
      derivationIdentity: 'attacker',
      artifactContentHash: 'FORGED-CONTENT'
    });

    const forgedResult = {
      provenanceHash: binding.artifactDigest,
      derivedArtifactBinding: binding,
      maxStressMpa: 9999
    };

    // Attempt registration without seal
    expect(() => {
      SimulationExecutionRegistry.registerExecution({
        provenanceHash: binding.artifactDigest,
        result: forgedResult,
        authoritativeRevisionHash: releasedRevHash,
        authoritativeGeometryHash: releasedGeomHash,
        timestamp: new Date().toISOString()
      } as any);
    }).toThrow(/Missing authoritative execution seal/);
  });

  it('D1-D5: Should reject caller-supplied revision/geometry mismatch in runScenario', () => {
    const scenario = getValidScenario();
    // D1: Fabricated revision
    expect(() => {
      SimulationEngine.runScenario(scenario, 'FAKE-REV', releasedGeomHash);
    }).toThrow(/AUTHORITY_CONFLICT/);

    // D2: Fabricated geometry
    expect(() => {
      SimulationEngine.runScenario(scenario, releasedRevHash, 'FAKE-GEOM');
    }).toThrow(/AUTHORITY_CONFLICT/);
  });

  it('E1-E9: Should reject mutated binding even with no target revision supplied', () => {
    const scenario = getValidScenario();
    const legit = SimulationEngine.runScenario(scenario);
    expect(legit.status).toBe('SAFE');

    // E8: Mutated binding while preserving provenanceHash (Structural Inconsistency)
    const tampered = JSON.parse(JSON.stringify(legit));
    tampered.derivedArtifactBinding.cadRevisionHash = 'FORGED-REV';

    const verifyRes = SimulationExecutionRegistry.verifyResultBinding(tampered);
    expect(verifyRes.isValid).toBe(false);
    expect(verifyRes.failureReason).toContain('BINDING_INCONSISTENCY');
  });

  it('E2: Should reject mutated cadRevisionHash in binding during verification', () => {
    const scenario = getValidScenario();
    const legit = SimulationEngine.runScenario(scenario);
    
    // Mutate internal payload and top level to trigger corruption (digest mismatch)
    const tampered = JSON.parse(JSON.stringify(legit));
    tampered.derivedArtifactBinding.cadRevisionHash = 'REV-X';
    tampered.derivedArtifactBinding.payload.cadRevisionHash = 'REV-X';
    
    const verifyRes = SimulationExecutionRegistry.verifyResultBinding(tampered);
    expect(verifyRes.isValid).toBe(false);
    expect(verifyRes.failureReason).toContain('BINDING_CORRUPTION');
  });

  it('A18: Should reject same identity with different result (Overwrite attempt)', () => {
    const scenario = getValidScenario();
    const legit = SimulationEngine.runScenario(scenario);
    const originalContentDigest = legit.canonicalContentDigest;
    
    // 1. Capture before-state
    const executionIdentity = legit.provenanceHash;
    const cadRevisionHash = legit.cadRevisionHash;
    const canonicalGeometryHash = legit.canonicalGeometryHash;
    
    // 2. Prepare conflicting execution with valid authority seal (Compromised Authority Threat)
    // Mutation: Change residualHistory (not part of identity binding, but part of content digest)
    const mutatedResult = { 
      ...legit, 
      residualHistory: [{ iteration: 1, maxResidual: 1e-9 }] 
    };
    
    const rawEnvelope = {
      provenanceHash: executionIdentity,
      result: mutatedResult as any,
      authoritativeRevisionHash: releasedRevHash,
      authoritativeGeometryHash: releasedGeomHash,
      timestamp: new Date().toISOString()
    };

    // Use adversarial factory to simulate compromised authority
    const envelope = mintCompromisedEnvelope(rawEnvelope);
    
    // 3. Registry must reject overwrite
    expect(() => {
      SimulationExecutionRegistry.registerExecution(envelope);
    }).toThrow(/already registered and immutable/);

    // 4. PROVE ORIGINAL TRUTH UNCHANGED
    const verifyRes = SimulationExecutionRegistry.verifyResultBinding(legit);
    expect(verifyRes.isValid).toBe(true);
    
    const storedRecord = (verifyRes as any).authoritativeResult;
    expect(storedRecord.provenanceHash).toBe(executionIdentity);
    expect(storedRecord.canonicalContentDigest).toBe(originalContentDigest);
    expect(storedRecord.cadRevisionHash).toBe(cadRevisionHash);
    expect(storedRecord.canonicalGeometryHash).toBe(canonicalGeometryHash);
    expect(storedRecord.residualHistory).toBeUndefined(); // Legit had no residual history
  });

  it('A22: Should reject cross-revision replay', () => {
    const scenario1 = getValidScenario();
    // 1. Run on REV-1
    const res1 = SimulationEngine.runScenario(scenario1);

    // 2. Update authority to REV-2
    const rev2 = revisionEngine.createRevision({
        revisionId: 'REV-2',
        entityId: 'PART-1',
        entityType: 'CAD_MODEL' as any,
        revisionCode: 'B',
        revisionNumber: 2,
        lifecycleState: RevisionLifecycleState.DRAFT,
        createdBy: 'ADMIN',
        content: { geometry: 'DATA2' },
        snapshot: { geometryState: { geometryHash: 'GEOM-2' } }
    } as any);
    revisionEngine.addApproval(rev2.revisionId, {
        approvalId: 'APP-2',
        revisionId: rev2.revisionId,
        role: 'ENGINEER',
        actorId: 'APPROVER',
        decision: 'APPROVED',
        timestamp: new Date().toISOString(),
        reason: 'Release B approved'
    });
    revisionEngine.setValidationState(rev2.revisionId, 'SIMULATED');
    revisionEngine.transitionState(rev2.revisionId, RevisionLifecycleState.IN_REVIEW, 'BYPASS_ADMIN', 'Reviewing');
    revisionEngine.transitionState(rev2.revisionId, RevisionLifecycleState.APPROVED, 'BYPASS_ADMIN', 'Approved');
    const released2 = revisionEngine.releaseRevision(rev2.revisionId, 'BYPASS_ADMIN', 'Release B');

    // 3. Attempt to verify res1 (bound to REV-1) against REV-2
    const verifyRes = SimulationExecutionRegistry.verifyResultBinding(res1, released2.revisionHash, 'GEOM-2');
    expect(verifyRes.isValid).toBe(false);
    expect(verifyRes.failureReason).toContain('REVISION_MISMATCH');
  });

  it('J: Should prove deep immutability', () => {
    const scenario = getValidScenario();
    const legit = SimulationEngine.runScenario(scenario);
    const provenanceHash = legit.provenanceHash!;
    
    const record = SimulationExecutionRegistry.getResult(provenanceHash);
    
    // Modification attempt
    record.maxStressMpa = 9999;
    
    // Registry state must remain unchanged
    const freshRecord = SimulationExecutionRegistry.getResult(provenanceHash);
    expect(freshRecord.maxStressMpa).toBe(legit.maxStressMpa);
    expect(freshRecord.maxStressMpa).not.toBe(9999);
  });
});
