import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { ADSEP8ControlEngine } from '../../../src/engine/adse/p8/ADSEP8ControlEngine';
import { RevisionEngine } from '../../../src/engine/revision/RevisionEngine';
import { CoreExecutionAuthority } from '../../../src/engine/execution/CoreExecutionAuthority';
import { GenericExecutionRegistry } from '../../../src/engine/execution/GenericExecutionRegistry';
import { DigitalThreadRegistry } from '../../../src/engine/adse/p4/DigitalThreadRegistry';
import { MBSEElementRegistry } from '../../../src/engine/adse/p2/MBSEElementRegistry';
import { MBSEBehavioralEngine } from '../../../src/engine/adse/p2/MBSEBehavioralEngine';
import { RevisionEntityType, RevisionLifecycleState } from '../../../src/engine/revision/types';

describe('ADSE-P8 SECP Canonical Revision Impact Invalidation Test Suite', () => {
  let p8: ADSEP8ControlEngine;
  let revisionEngine: RevisionEngine;
  let behavioralEngine: MBSEBehavioralEngine;
  let digitalThread: DigitalThreadRegistry;

  beforeAll(() => {
    revisionEngine = new RevisionEngine();
    behavioralEngine = new MBSEBehavioralEngine(new MBSEElementRegistry());
    digitalThread = new DigitalThreadRegistry(revisionEngine);
    CoreExecutionAuthority.initialize(revisionEngine);
  });

  beforeEach(() => {
    revisionEngine = new RevisionEngine();
    behavioralEngine = new MBSEBehavioralEngine(new MBSEElementRegistry());
    digitalThread = new DigitalThreadRegistry(revisionEngine);
    CoreExecutionAuthority.clear();
    CoreExecutionAuthority.initialize(revisionEngine);
    p8 = new ADSEP8ControlEngine(revisionEngine, behavioralEngine, digitalThread);
  });

  it('PROVES CANONICAL INVALIDATION: Canonical Revision Change -> Impact Analyzer -> P8 Execution Invalidation -> Stale Result Rejection', async () => {
    const archEntityId = 'arch:node:AVIONICS-CANONICAL-001';

    // 1. Create Canonical Revision R1 in RevisionEngine (Revision Authority)
    const revR1 = revisionEngine.createRevision({
      revisionId: `${archEntityId}:REV-A`,
      entityId: archEntityId,
      entityType: RevisionEntityType.CAD_MODEL,
      revisionCode: 'A',
      revisionNumber: 1,
      createdBy: 'CHIEF_SYSTEMS_ENGINEER',
      changeReason: 'Initial baseline for Avionics Control',
      content: { massKg: 15.5, maxPowerWatts: 120, bandwidthHz: 50 },
      snapshot: {} as any,
      lifecycleState: RevisionLifecycleState.RELEASED,
      dependencies: []
    });

    expect(revR1.revisionHash).toBeDefined();
    expect(revR1.revisionHash.length).toBe(64);

    // 2. Register Control System in P8 bound to canonical R1
    const sys = await p8.authorizeControlSystem({
      systemId: 'AV-FLIGHT-CTRL-CANONICAL',
      architectureId: archEntityId,
      p4NodeId: 'thread:node:AV-FLIGHT-CTRL-CANONICAL',
      configId: 'CONF-NOMINAL-01'
    });

    const plant = p8.registry.registerPlant({
      id: 'PLANT-CANONICAL-01',
      systemId: 'AV-FLIGHT-CTRL-CANONICAL',
      controlSystemId: sys.id,
      canonicalArchitectureId: archEntityId,
      plantModelType: 'LINEAR_SS_CONTINUOUS',
      stateVariables: [{ name: 'pitchAngleRad', initialValue: 0.05, unit: 'rad', description: 'Pitch' }],
      controlInputs: [{ name: 'ACTUATOR_CMD', minLimit: -1, maxLimit: 1, defaultLevel: 0, unit: 'rad' }],
      measurements: [{ name: 'PITCH_SENSOR', sourceStateVariable: 'pitchAngleRad', samplingRateHz: 100, unit: 'rad' }],
      parameters: { dampingRatio: 0.707 },
      configurationId: 'CONF-NOMINAL-01',
      revisionId: revR1.revisionId
    });

    const controller = p8.registry.registerController({
      id: 'CTRL-CANONICAL-01',
      systemId: 'AV-FLIGHT-CTRL-CANONICAL',
      controlSystemId: sys.id,
      canonicalArchitectureId: archEntityId,
      supportedModes: ['AUTOMATIC_NOMINAL'],
      activeMode: 'AUTOMATIC_NOMINAL',
      samplingRateHz: 100,
      configurationId: 'CONF-NOMINAL-01',
      revisionId: revR1.revisionId
    });

    const loop = p8.registry.registerLoop({
      id: 'LOOP-CANONICAL-01',
      systemId: 'AV-FLIGHT-CTRL-CANONICAL',
      controlSystemId: sys.id,
      loopName: 'Pitch Control Loop',
      controllerId: controller.id,
      plantId: plant.id,
      feedbackPaths: [{ measurementName: 'PITCH_SENSOR', targetControllerInput: 'ACTUATOR_CMD', latencyMs: 2 }],
      feedforwardPaths: [],
      executionRateHz: 100,
      targetOperatingMode: 'AUTOMATIC_NOMINAL',
      configurationId: 'CONF-NOMINAL-01',
      revisionId: revR1.revisionId
    });

    // 3. Execute R1 through CoreExecutionAuthority -> Obtain E1
    const envelopeE1 = await p8.execution.runExecution({
      executionId: 'exec:canonical:R1',
      loopId: loop.id,
      durationSeconds: 2.0,
      timeStepSeconds: 0.1
    });

    // Register execution record in P8 registry as current valid execution
    p8.registry.registerExecution({
      id: envelopeE1.executionId,
      type: 'ControlExecution',
      controlSystemId: sys.id,
      loopId: loop.id,
      scenarioId: 'SCENARIO-NOMINAL-01',
      startTime: new Date().toISOString(),
      durationSeconds: 2.0,
      status: 'VERIFIED',
      fingerprint: envelopeE1.resultDigest,
      systemId: 'AV-FLIGHT-CTRL-CANONICAL',
      configurationId: 'CONF-NOMINAL-01',
      revisionId: revR1.revisionId,
      authorityState: 'AUTHORITATIVE',
      lifecycleState: 'RELEASED',
      provenance: { originHash: envelopeE1.resultDigest } as any,
      relationships: [],
      dependencies: [{ entityId: archEntityId, revisionId: revR1.revisionId }],
      verificationStatus: 'PASSED',
      evidenceReferences: [envelopeE1.evidenceLeaf?.leafHash || '']
    });

    // ASSERT BEFORE CANONICAL REVISION CHANGE:
    // Envelope E1 is PASS, valid, and bound to R1 revisionHash
    expect(envelopeE1.verificationResult?.overallVerdict).toBe('PASS');
    expect(envelopeE1.revisionHash).toBe(revR1.revisionHash);
    
    const verifyR1Binding = GenericExecutionRegistry.verifyResultBinding(envelopeE1, revR1.revisionHash);
    expect(verifyR1Binding.isValid).toBe(true);

    const initialExecRecord = p8.registry.getExecution(envelopeE1.executionId);
    expect(initialExecRecord?.status).toBe('VERIFIED');

    // 4. CANONICAL REVISION MUTATION: Create R2 in RevisionEngine
    // Checkout R1 -> R2 (Revision B) with updated mass/power parameters
    const revR2 = revisionEngine.checkoutRevision(revR1.revisionId, 'LEAD_SYSTEM_ENGINEER', 'ECN-002: Increased Avionics Mass and Power');
    revisionEngine.updateContent(revR2.revisionId, { massKg: 18.2, maxPowerWatts: 150, bandwidthHz: 65 }, 'LEAD_SYSTEM_ENGINEER');

    expect(revR2.revisionId).not.toBe(revR1.revisionId);
    expect(revR2.revisionHash).not.toBe(revR1.revisionHash);

    // Register a downstream dependency link in RevisionEngine connecting P8 system to canonical object
    revisionEngine.createRevision({
      revisionId: `${sys.id}:REV-A`,
      entityId: sys.id,
      entityType: RevisionEntityType.EVIDENCE,
      revisionCode: 'A',
      revisionNumber: 1,
      createdBy: 'P8_SYSTEM',
      changeReason: 'Control system binding to architecture',
      content: { controlSystemId: sys.id },
      snapshot: {} as any,
      lifecycleState: RevisionLifecycleState.RELEASED,
      dependencies: [{ entityId: archEntityId, revisionId: revR1.revisionId, isFloating: true }]
    });

    // 5. CANONICAL REVISION IMPACT EVALUATION
    // P8 consumes RevisionImpactAnalyzer results via RevisionEngine
    const impactResult = p8.evaluateCanonicalImpact(revR2.revisionId);
    expect(impactResult.impactedItems.length).toBeGreaterThan(0);
    expect(impactResult.invalidatedExecutionsCount).toBeGreaterThan(0);

    // 6. ASSERT AFTER CANONICAL REVISION CHANGE:
    // A) Execution E1 in P8 is transitioned to INVALIDATED
    const invalidatedExecRecord = p8.registry.getExecution(envelopeE1.executionId);
    expect(invalidatedExecRecord?.status).toBe('INVALIDATED');

    // B) PERSISTENCE BEFORE DESTRUCTION: Save snapshot containing invalidated E1
    const snapshotInvalidated = p8.persistence.createSnapshot({
      snapshotId: 'SNAPSHOT-INVALIDATED-E1',
      controlSystemId: sys.id,
      persistedByAuthority: 'SECP_PERSISTENCE_TEST'
    });
    expect(snapshotInvalidated.id).toBe('SNAPSHOT-INVALIDATED-E1');

    // C) MUST NOT BE ACCEPTED AS CURRENT CANONICAL TRUTH
    // Verifying E1 against R2's expected revisionHash FAILS with REVISION_MISMATCH!
    const verifyR2Binding = GenericExecutionRegistry.verifyResultBinding(envelopeE1, revR2.revisionHash);
    expect(verifyR2Binding.isValid).toBe(false);
    expect(verifyR2Binding.failureReason).toContain('REVISION_MISMATCH');

    // 7. EXECUTE R2 via CoreExecutionAuthority -> Obtain E2
    // Update P8 system to R2 revision coordinates
    p8.registry.updateSystem(sys.id, { revisionId: revR2.revisionId });

    const envelopeE2 = await p8.execution.runExecution({
      executionId: 'exec:canonical:R2',
      loopId: loop.id,
      durationSeconds: 2.5,
      timeStepSeconds: 0.1
    });

    p8.registry.registerExecution({
      id: envelopeE2.executionId,
      type: 'ControlExecution',
      controlSystemId: sys.id,
      loopId: loop.id,
      scenarioId: 'SCENARIO-NOMINAL-02',
      startTime: new Date().toISOString(),
      durationSeconds: 2.5,
      status: 'VERIFIED',
      fingerprint: envelopeE2.resultDigest,
      systemId: 'AV-FLIGHT-CTRL-CANONICAL',
      configurationId: 'CONF-NOMINAL-01',
      revisionId: revR2.revisionId,
      authorityState: 'AUTHORITATIVE',
      lifecycleState: 'RELEASED',
      provenance: { originHash: envelopeE2.resultDigest } as any,
      relationships: [],
      dependencies: [{ entityId: archEntityId, revisionId: revR2.revisionId }],
      verificationStatus: 'PASSED',
      evidenceReferences: [envelopeE2.evidenceLeaf?.leafHash || '']
    });

    // ASSERT E2 PROPERTIES:
    // E2 executionId is distinct from E1
    expect(envelopeE2.executionId).not.toBe(envelopeE1.executionId);
    // E2 carries R2 revisionHash
    expect(envelopeE2.revisionHash).toBe(revR2.revisionHash);
    // E2 passes verification
    expect(envelopeE2.verificationResult?.overallVerdict).toBe('PASS');

    // E2 is valid for R2 canonical truth
    const verifyE2Binding = GenericExecutionRegistry.verifyResultBinding(envelopeE2, revR2.revisionHash);
    expect(verifyE2Binding.isValid).toBe(true);

    // 8. MASTER PERSISTENCE, DESTRUCTION, RELOAD & RECONSTRUCTION PROOF:
    // Capture final state snapshot containing invalidated E1 and verified E2
    p8.persistence.createSnapshot({
      snapshotId: 'SNAPSHOT-MASTER-E1-INVALIDATED-E2-VERIFIED',
      controlSystemId: sys.id,
      persistedByAuthority: 'SECP_PERSISTENCE_TEST'
    });

    // DESTROY P8 IN-MEMORY INSTANCE
    p8.registry.clear();

    expect(p8.registry.getExecution(envelopeE1.executionId)).toBeUndefined();
    expect(p8.registry.getExecution(envelopeE2.executionId)).toBeUndefined();

    // RELOAD & RECONSTRUCT FROM SNAPSHOT
    const restoreMaster = p8.persistence.restoreFromSnapshot('SNAPSHOT-MASTER-E1-INVALIDATED-E2-VERIFIED');
    expect(restoreMaster.isValid).toBe(true);

    // PROVE STATE TRANSITION PARITY AFTER RECONSTRUCTION:
    const reconstructedE1 = p8.registry.getExecution(envelopeE1.executionId);
    const reconstructedE2 = p8.registry.getExecution(envelopeE2.executionId);

    expect(reconstructedE1).toBeDefined();
    // CRITICAL PROOF: E1 status PROPERTY is explicitly 'INVALIDATED' (State Transition, not just hash mismatch)
    expect(reconstructedE1?.status).toBe('INVALIDATED');

    expect(reconstructedE2).toBeDefined();
    // CRITICAL PROOF: E2 status PROPERTY is 'VERIFIED' and valid current truth for R2
    expect(reconstructedE2?.status).toBe('VERIFIED');
    expect(reconstructedE2?.revisionId).toBe(revR2.revisionId);

    // Verify bindings after reconstruction
    expect(GenericExecutionRegistry.verifyResultBinding(envelopeE1, revR2.revisionHash).isValid).toBe(false);
    expect(GenericExecutionRegistry.verifyResultBinding(envelopeE2, revR2.revisionHash).isValid).toBe(true);
  });

  it('PROVES PERSISTENCE & RECONSTRUCTION PARITY: Invalidation status and lineage survive memory destruction', async () => {
    const archEntityId = 'arch:node:POWER-CANONICAL-002';

    const revR1 = revisionEngine.createRevision({
      revisionId: `${archEntityId}:REV-A`,
      entityId: archEntityId,
      entityType: RevisionEntityType.CAD_MODEL,
      revisionCode: 'A',
      revisionNumber: 1,
      createdBy: 'ENGINEER_A',
      content: { voltage: 28 },
      lifecycleState: RevisionLifecycleState.RELEASED,
      dependencies: []
    });

    const sys = await p8.authorizeControlSystem({
      systemId: 'POWER-CTRL-SYS',
      architectureId: archEntityId,
      p4NodeId: 'thread:node:POWER-CTRL-SYS',
      configId: 'CONF-PWR-01'
    });

    const execE1: any = {
      id: 'EXEC-PERSIST-001',
      type: 'ControlExecution',
      controlSystemId: sys.id,
      loopId: 'LOOP-PWR-01',
      scenarioId: 'SCEN-01',
      startTime: new Date().toISOString(),
      durationSeconds: 5,
      status: 'VERIFIED',
      fingerprint: 'HASH-PWR-E1',
      systemId: 'POWER-CTRL-SYS',
      configurationId: 'CONF-PWR-01',
      revisionId: revR1.revisionId,
      authorityState: 'AUTHORITATIVE',
      lifecycleState: 'RELEASED',
      provenance: {} as any,
      relationships: [],
      dependencies: [],
      verificationStatus: 'PASSED',
      evidenceReferences: ['EVIDENCE-001']
    };
    p8.registry.registerExecution(execE1);

    // 1. Create Baseline Snapshot
    const snapshot1 = p8.persistence.createSnapshot({
      controlSystemId: sys.id,
      persistedByAuthority: 'SECP_PERSISTENCE_TEST'
    });

    // 2. Trigger Invalidation via Revision Mutation
    p8.registry.updateSystem(sys.id, { revisionId: `${archEntityId}:REV-B` });
    expect(p8.registry.getExecution('EXEC-PERSIST-001')?.status).toBe('INVALIDATED');

    // 3. Create Invalidate Snapshot
    const snapshot2 = p8.persistence.createSnapshot({
      snapshotId: 'SNAPSHOT-INVALIDATED-STATE',
      controlSystemId: sys.id,
      persistedByAuthority: 'SECP_PERSISTENCE_TEST'
    });

    // 4. DESTROY IN-MEMORY INSTANCE
    p8.registry.clear();

    expect(p8.registry.getSystem(sys.id)).toBeUndefined();
    expect(p8.registry.getExecution('EXEC-PERSIST-001')).toBeUndefined();

    // 5. RELOAD & RECONSTRUCT from snapshot2
    const restoreResult = p8.persistence.restoreFromSnapshot('SNAPSHOT-INVALIDATED-STATE');
    expect(restoreResult.isValid).toBe(true);

    // 6. VERIFY AFTER RECONSTRUCTION:
    // E1 is reconstructed with status = INVALIDATED
    const reconstructedE1 = p8.registry.getExecution('EXEC-PERSIST-001');
    expect(reconstructedE1).toBeDefined();
    expect(reconstructedE1?.status).toBe('INVALIDATED');

    // System is reconstructed with new revisionId
    const reconstructedSys = p8.registry.getSystem(sys.id);
    expect(reconstructedSys?.revisionId).toBe(`${archEntityId}:REV-B`);
  });

  it('PROVES REAL P4 DIGITAL THREAD LINEAGE: Revision updates record REVISED_BY edges in global thread without clear()', async () => {
    const sysId = 'THREAD-LINEAGE-SYS';
    const archId = 'arch:node:THREAD-ARCH-01';
    const p4NodeId = 'thread:node:THREAD-LINEAGE-SYS';

    // Baseline architecture node in P4
    digitalThread.registerNode({
      nodeId: archId,
      nodeType: 'Architecture',
      canonicalId: archId,
      authoritySource: 'P3_ARCHITECTURE_AUTHORITY',
      displayName: 'Thread Architecture',
      configurationId: 'CONF-01'
    });

    // Register System
    const sys = await p8.authorizeControlSystem({
      systemId: sysId,
      architectureId: archId,
      p4NodeId,
      configId: 'CONF-01'
    });

    const initialNode = digitalThread.getNode(p4NodeId);
    expect(initialNode).toBeDefined();

    // Perform Revision Update in P8
    p8.registry.updateSystem(sys.id, { revisionId: 'REV-NEW-LINEAGE-02' });

    // Verify Revision Node and Edge in Digital Thread
    const expectedRevisedNodeId = `${p4NodeId}:rev:REV-NEW-LINEAGE-02`;
    const revisedNode = digitalThread.getNode(expectedRevisedNodeId);
    expect(revisedNode).toBeDefined();
    expect(revisedNode?.revisionId).toBe('REV-NEW-LINEAGE-02');

    // Verify REVISED_BY Edge connects initial node to revised node
    const edges = digitalThread.getEdgesForNode(p4NodeId);
    expect(edges.outgoing.some(e => e.targetNodeId === expectedRevisedNodeId && e.edgeType === 'REVISED_BY')).toBe(true);
  });
});
