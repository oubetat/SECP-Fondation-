import { describe, it, expect, beforeEach } from 'vitest';
import { CoreExecutionAuthority } from '../execution/CoreExecutionAuthority';
import { GenericExecutionRegistry } from '../execution/GenericExecutionRegistry';
import { RevisionEngine } from '../revision/RevisionEngine';
import { RevisionLifecycleState } from '../revision/types';
import { IndexedDbEngine } from '../storage/IndexedDbEngine';
import { RoboticsPlugin } from '../../plugins/roboticsPlugin';
import { AerospacePlugin } from '../../plugins/aerospacePlugin';

describe('SECP — M8 Engineering-Completeness & Authoritative Workflow Closure', () => {
  let revisionEngine: RevisionEngine;
  const objectId = 'BENCH-ENG-OBJ-800';

  beforeEach(() => {
    IndexedDbEngine.clearMockStore();
    GenericExecutionRegistry.clear();
    CoreExecutionAuthority.clear();

    revisionEngine = new RevisionEngine();
    CoreExecutionAuthority.initialize(revisionEngine);

    // Bootstrap benchmark reference revision
    const rev = revisionEngine.createRevision({
      revisionId: 'REV-BENCH-100',
      entityId: objectId,
      entityType: 'CAD_MODEL' as any,
      revisionCode: 'A',
      revisionNumber: 1,
      lifecycleState: RevisionLifecycleState.DRAFT,
      createdBy: 'CHIEF_METROLOGIST',
      content: { geometry: 'BREP' },
      snapshot: {
        geometryState: {
          parameters: {},
          features: [],
          topologyHash: 'TOPO-100',
          geometryHash: 'GEOM-100'
        }
      }
    } as any);

    revisionEngine.setValidationState(rev.revisionId, 'SIMULATED');
    
    revisionEngine.addApproval(rev.revisionId, {
      approvalId: 'APP-BENCH-100',
      revisionId: rev.revisionId,
      role: 'ENGINEER',
      actorId: 'LEAD_METROLOGIST',
      decision: 'APPROVED',
      timestamp: new Date().toISOString(),
      reason: 'Approved for M8 Engineering-Completeness assessment'
    });

    revisionEngine.transitionState(rev.revisionId, RevisionLifecycleState.IN_REVIEW, 'BYPASS', 'Review');
    revisionEngine.transitionState(rev.revisionId, RevisionLifecycleState.APPROVED, 'BYPASS', 'Approve');
    revisionEngine.releaseRevision(rev.revisionId, 'BYPASS', 'Release');
  });

  it('Requirement 1: Robotics Plugin supports authoritative M8 workflow from Intent to Evidence', async () => {
    const tool = RoboticsPlugin.tools.find(t => t.id === 'joint-torque')!;
    expect(tool.executeAuthoritative).toBeDefined();

    // 1. Engineering Intent + Inputs
    const inputs = {
      payloadMassKg: 15,
      link1LengthMm: 600,
      link2LengthMm: 600,
      jointMaxAccelDegS2: 180,
      engineeringObjectId: objectId,
      revisionId: 'REV-BENCH-100'
    };

    // 2. Authoritative Execution
    const envelope = await tool.executeAuthoritative!(inputs);

    // 3. Verification of Results & Identity
    expect(envelope.executionId).toMatch(/^EXEC-/);
    expect(envelope.solverResult.status).toBe('SUCCESS');
    expect(envelope.solverResult.scalarOutputs.totalShoulderTorqueNm).toBeGreaterThan(0);
    expect(envelope.state).toBe('SEALED');

    // 4. Verification of Evidence & Provenance
    const registered = GenericExecutionRegistry.getExecution(envelope.executionId);
    expect(registered).toBeDefined();
    expect(registered?.resultDigest).toBe(envelope.resultDigest);

    const graph = CoreExecutionAuthority.getProvenanceGraph();
    const nodes = graph.getNodes();
    expect(nodes.some(n => n.type === 'RESULT' && n.id === `RES-NODE-${envelope.executionId}`)).toBe(true);
    expect(nodes.some(n => n.type === 'REVISION' && n.id === `REV-NODE-${envelope.revisionHash}`)).toBe(true);
  });

  it('Requirement 2: Aerospace Plugin authoritatively rejects invalid inputs at Core boundary', async () => {
    const tool = AerospacePlugin.tools.find(t => t.id === 'mach-flow')!;
    
    // Invalid/Sub-surface altitude
    const inputs = {
      altitudeM: -500,
      velocityMs: 250,
      engineeringObjectId: objectId,
      revisionId: 'REV-BENCH-100'
    };

    await expect(tool.executeAuthoritative!(inputs)).rejects.toThrow(/PHYSICAL_CONSTRAINT_VIOLATION/);
  });

  it('Requirement 3: Authoritative engineering state is persistent and rehydratable (M8 Replay)', async () => {
    const tool = RoboticsPlugin.tools[0];
    const inputs = { payloadMassKg: 10, engineeringObjectId: objectId, revisionId: 'REV-BENCH-100' };
    
    const envOriginal = await tool.executeAuthoritative!(inputs);
    const originalExecId = envOriginal.executionId;

    // Explicitly await persistence since registerExecution triggers it in background
    await GenericExecutionRegistry.persistToStorage();

    // Simulate page reload/service restart
    GenericExecutionRegistry.clear();
    CoreExecutionAuthority.clear();
    CoreExecutionAuthority.initialize(revisionEngine);

    // Rehydrate from IndexedDB
    await CoreExecutionAuthority.rehydrate();

    const envRehydrated = GenericExecutionRegistry.getExecution(originalExecId);
    expect(envRehydrated).toBeDefined();
    expect(envRehydrated?.resultDigest).toBe(envOriginal.resultDigest);
    
    // Verify provenance was rebuilt
    const graph = CoreExecutionAuthority.getProvenanceGraph();
    expect(graph.hasNode(`RES-NODE-${originalExecId}`)).toBe(true);
  });

  it('Requirement 4: Downstream consumption avoids parallel truth via Registry binding', async () => {
    const tool = RoboticsPlugin.tools[0];
    const inputs = { payloadMassKg: 20, engineeringObjectId: objectId, revisionId: 'REV-BENCH-100' };
    const envelope = await tool.executeAuthoritative!(inputs);

    // Downstream "BOM" or "Manufacturing" layer verifies the result before use
    const verification = GenericExecutionRegistry.verifyResultBinding(
      envelope,
      envelope.revisionHash,
      envelope.geometryHash,
      objectId
    );

    expect(verification.isValid).toBe(true);

    // Tampered result rejection
    const tampered = JSON.parse(JSON.stringify(envelope));
    tampered.solverResult.rawResults.motorCurrentAmp = 9999;
    
    const verificationTampered = GenericExecutionRegistry.verifyResultBinding(tampered);
    expect(verificationTampered.isValid).toBe(false);
    expect(verificationTampered.failureReason).toContain('RESULT_DIGEST_MISMATCH');
  });
});
