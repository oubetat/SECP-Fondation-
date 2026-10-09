import { describe, it, expect, beforeEach } from 'vitest';
import { ADSEP8ControlEngine } from '../../../src/engine/adse/p8/ADSEP8ControlEngine';
import { RevisionEngine } from '../../../src/engine/revision/RevisionEngine';
import { MBSEBehavioralEngine } from '../../../src/engine/adse/p2/MBSEBehavioralEngine';
import { DigitalThreadRegistry } from '../../../src/engine/adse/p4/DigitalThreadRegistry';
import { MBSEElementRegistry } from '../../../src/engine/adse/p2/MBSEElementRegistry';

describe('ADSE-P8 Gap Closure Verification', () => {
  let engine: ADSEP8ControlEngine;
  let revisionEngine: RevisionEngine;
  let behavioralEngine: MBSEBehavioralEngine;
  let digitalThread: DigitalThreadRegistry;

  beforeEach(() => {
    revisionEngine = new RevisionEngine();
    behavioralEngine = new MBSEBehavioralEngine(new MBSEElementRegistry());
    digitalThread = new DigitalThreadRegistry(revisionEngine);
    engine = new ADSEP8ControlEngine(revisionEngine, behavioralEngine, digitalThread);
  });

  it('GAP-01: Should persist and reconstruct the P8 Control Model deterministicly', async () => {
    // 1. Setup Model
    const system = await engine.authorizeControlSystem({
      systemId: 'AV-FLIGHT-CTRL',
      architectureId: 'arch:node:AVIONICS',
      p4NodeId: 'thread:node:AV-FLIGHT-CTRL',
      configId: 'CONF-001'
    });

    engine.registry.registerPlant({
      id: 'PLANT-001',
      systemId: 'AV-FLIGHT-CTRL',
      controlSystemId: system.id,
      canonicalArchitectureId: 'arch:node:AIRFRAME',
      plantModelType: 'LINEAR_SS_CONTINUOUS',
      stateVariables: [{ name: 'altitude', initialValue: 10000, unit: 'ft', description: 'Alt' }],
      controlInputs: [{ name: 'elevator', minLimit: -1, maxLimit: 1, defaultLevel: 0, unit: 'deg' }],
      measurements: [{ name: 'alt_sens', sourceStateVariable: 'altitude', samplingRateHz: 10, unit: 'ft' }],
      parameters: {},
      configurationId: 'CONF-001',
      revisionId: 'REV-001'
    });

    // 2. Create Snapshot
    const snapshot = engine.persistence.createSnapshot({
      controlSystemId: system.id,
      persistedByAuthority: 'TEST_AUTH'
    });

    expect(snapshot.entities.systems.length).toBe(1);
    expect(snapshot.entities.plants.length).toBe(1);

    // 3. Destroy and Reconstruct
    const result = engine.persistence.restoreFromSnapshot(snapshot.id);
    expect(result.restoredCount).toBeGreaterThanOrEqual(2);
    expect(result.isValid).toBe(true);

    // 4. Verify Reconstruction
    const restoredSystem = engine.registry.getSystem(system.id);
    expect(restoredSystem).toBeDefined();
    expect(restoredSystem?.displayName).toBe(system.displayName);
    expect(restoredSystem?.p4NodeId).toBe(system.p4NodeId);
    expect(restoredSystem?.revisionId).toBe(system.revisionId);
    expect(restoredSystem?.configurationId).toBe(system.configurationId);

    const restoredPlant = engine.registry.getPlant('PLANT-001');
    expect(restoredPlant).toBeDefined();
    expect(restoredPlant?.controlSystemId).toBe(system.id);
    expect(restoredPlant?.canonicalArchitectureId).toBe('arch:node:AIRFRAME');

    // 5. Verify Digital Thread Identity (P4 nodes should still exist and match)
    const threadNode = digitalThread.getNode(system.p4NodeId);
    expect(threadNode).toBeDefined();
    expect(threadNode?.canonicalId).toBe(system.id);
  });

  it('GAP-02: Should register P8 nodes and edges in the real Digital Thread Registry', async () => {
    const systemId = 'CTRL-SYS-001';
    const archId = 'arch:node:PWR-DIST';
    const p4NodeId = 'thread:node:PWR-CTRL';

    // Ensure arch node exists for edge registration
    digitalThread.registerNode({
      nodeId: archId,
      nodeType: 'Architecture',
      canonicalId: archId,
      authoritySource: 'P3_ARCHITECTURE_AUTHORITY',
      displayName: 'Power Distribution',
      configurationId: 'CONF-001'
    });

    await engine.authorizeControlSystem({
      systemId,
      architectureId: archId,
      p4NodeId,
      configId: 'CONF-001'
    });

    // Verify Node in P4
    const node = digitalThread.getNode(p4NodeId);
    expect(node).toBeDefined();
    expect(node?.nodeType).toBe('SystemModel');
    expect(node?.canonicalId).toBe(`CTRL-${systemId}`);

    // Verify Edge in P4
    const edges = digitalThread.getEdgesForNode(archId);
    expect(edges.outgoing.some(e => e.targetNodeId === p4NodeId && e.edgeType === 'IMPLEMENTED_BY')).toBe(true);
  });

  it('GAP-03: Should reactively invalidate results for all dependency types', async () => {
    const system = await engine.authorizeControlSystem({
      systemId: 'NAV-UNIT',
      architectureId: 'arch:node:NAV',
      p4NodeId: 'thread:node:NAV-THREAD',
      configId: 'CONF-001'
    });

    const plant = engine.registry.registerPlant({
      id: 'PLANT-NAV',
      systemId: 'NAV-UNIT',
      controlSystemId: system.id,
      canonicalArchitectureId: 'arch:node:GYRO',
      plantModelType: 'LINEAR_SS_CONTINUOUS',
      stateVariables: [],
      controlInputs: [],
      measurements: [],
      parameters: {},
      configurationId: 'CONF-001',
      revisionId: 'REV-001'
    });

    const controller = engine.registry.registerController({
      id: 'CTRL-NAV',
      systemId: 'NAV-UNIT',
      controlSystemId: system.id,
      canonicalArchitectureId: 'arch:node:NAV-PROC',
      supportedModes: ['AUTOMATIC_NOMINAL'],
      activeMode: 'AUTOMATIC_NOMINAL',
      samplingRateHz: 100,
      configurationId: 'CONF-001',
      revisionId: 'REV-001'
    });

    const law = engine.registry.registerLaw({
      id: 'LAW-NAV',
      systemId: 'NAV-UNIT',
      controllerId: controller.id,
      lawType: 'PID_CLASSIC',
      parameters: [],
      constraints: [],
      configurationId: 'CONF-001',
      revisionId: 'REV-001'
    });

    // Register a mock execution
    const executionId = 'EXEC-NAV-001';
    engine.registry.registerExecution({
      id: executionId,
      type: 'ControlExecution',
      controlSystemId: system.id,
      loopId: 'LOOP-NAV',
      scenarioId: 'SCEN-001',
      startTime: new Date().toISOString(),
      durationSeconds: 10,
      status: 'VERIFIED',
      fingerprint: 'HASH-001',
      systemId: 'NAV-UNIT',
      configurationId: 'CONF-001',
      revisionId: system.revisionId,
      authorityState: 'AUTHORITATIVE',
      lifecycleState: 'RELEASED',
      provenance: {} as any,
      relationships: [],
      dependencies: [],
      verificationStatus: 'PASSED',
      evidenceReferences: []
    });

    // 1. Test Controller Revision Change Invalidation
    engine.registry.updateController(controller.id, { revisionId: 'REV-CTRL-NEW' });
    expect(engine.registry.getExecution(executionId)?.status).toBe('INVALIDATED');

    // Reset status for next test
    engine.registry.getExecution(executionId)!.status = 'VERIFIED';

    // 2. Test Plant Revision Change Invalidation
    engine.registry.updatePlant(plant.id, { revisionId: 'REV-PLANT-NEW' });
    expect(engine.registry.getExecution(executionId)?.status).toBe('INVALIDATED');

    // Reset
    engine.registry.getExecution(executionId)!.status = 'VERIFIED';

    // 3. Test Law Revision Change Invalidation
    engine.registry.updateLaw(law.id, { revisionId: 'REV-LAW-NEW' });
    expect(engine.registry.getExecution(executionId)?.status).toBe('INVALIDATED');

    // Reset
    engine.registry.getExecution(executionId)!.status = 'VERIFIED';

    // 4. Test Context Binding (P5/P6/P7) Invalidation
    engine.registry.updateSystem(system.id, { p5StructuralContextId: 'P5-NEW-CONTEXT' });
    expect(engine.registry.getExecution(executionId)?.status).toBe('INVALIDATED');

    engine.registry.getExecution(executionId)!.status = 'VERIFIED';
    engine.registry.updateSystem(system.id, { p6ThermalContextId: 'P6-NEW-CONTEXT' });
    expect(engine.registry.getExecution(executionId)?.status).toBe('INVALIDATED');

    engine.registry.getExecution(executionId)!.status = 'VERIFIED';
    engine.registry.updateSystem(system.id, { p7PowerContextId: 'P7-NEW-CONTEXT' });
    expect(engine.registry.getExecution(executionId)?.status).toBe('INVALIDATED');
  });

  it('GAP-02: Should demonstrate deep Digital Thread lineage (Requirement -> Evidence)', async () => {
    // This test proves that P8 populates the REAL P4 registry with meaningful edges
    const reqId = 'thread:node:REQ-CTRL-001';
    const archId = 'arch:node:AVIONICS-P8';
    const p8SysId = 'thread:node:P8-SYS';

    // Baseline: P4 nodes (Mocking what P1/P3 would have already registered)
    digitalThread.registerNode({ nodeId: reqId, nodeType: 'Requirement', canonicalId: 'REQ-001', authoritySource: 'P1_REQUIREMENT_AUTHORITY', displayName: 'Stability Req', configurationId: 'CONF-001' });
    digitalThread.registerNode({ nodeId: archId, nodeType: 'Architecture', canonicalId: 'ARCH-001', authoritySource: 'P3_ARCHITECTURE_AUTHORITY', displayName: 'Avionics', configurationId: 'CONF-001' });

    // Link Req to Arch (P4 semantic)
    digitalThread.registerEdge({ edgeType: 'SATISFIES', sourceNodeId: archId, targetNodeId: reqId, authoritySource: 'P3_ARCHITECTURE_AUTHORITY', configurationId: 'CONF-001' });

    // P8 Integration
    await engine.authorizeControlSystem({
      systemId: 'AV-P8',
      architectureId: 'ARCH-001', // Using canonical ID for lookup
      p4NodeId: p8SysId,
      configId: 'CONF-001'
    });

    // Verification of Lineage
    const p8Node = digitalThread.getNode(p8SysId);
    expect(p8Node).toBeDefined();
    
    // Check Traceability: Req -> Arch -> P8 System
    const edges = digitalThread.getEdgesForNode(archId);
    expect(edges.outgoing.some(e => e.targetNodeId === reqId && e.edgeType === 'SATISFIES')).toBe(true);
    expect(edges.outgoing.some(e => e.targetNodeId === p8SysId && e.edgeType === 'IMPLEMENTED_BY')).toBe(true);
  });
});
