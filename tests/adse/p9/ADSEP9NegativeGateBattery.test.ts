import { describe, it, expect, beforeEach } from 'vitest';
import { ADSEP9CommunicationEngine } from '../../../src/engine/adse/p9/ADSEP9CommunicationEngine';
import { RevisionEngine } from '../../../src/engine/revision/RevisionEngine';
import { CoreExecutionAuthority } from '../../../src/engine/execution/CoreExecutionAuthority';
import { DigitalThreadRegistry } from '../../../src/engine/adse/p4/DigitalThreadRegistry';
import { MBSEElementRegistry } from '../../../src/engine/adse/p2/MBSEElementRegistry';
import { MBSEBehavioralEngine } from '../../../src/engine/adse/p2/MBSEBehavioralEngine';
import { RevisionEntityType, RevisionLifecycleState } from '../../../src/engine/revision/types';

describe('ADSE-P9 Communications Integration Negative Gate Battery Suite', () => {
  let p9: ADSEP9CommunicationEngine;
  let revisionEngine: RevisionEngine;
  let behavioralEngine: MBSEBehavioralEngine;
  let digitalThread: DigitalThreadRegistry;

  beforeEach(() => {
    revisionEngine = new RevisionEngine();
    behavioralEngine = new MBSEBehavioralEngine(new MBSEElementRegistry());
    digitalThread = new DigitalThreadRegistry(revisionEngine);
    CoreExecutionAuthority.clear();
    CoreExecutionAuthority.initialize(revisionEngine);
    p9 = new ADSEP9CommunicationEngine(revisionEngine, behavioralEngine, digitalThread);
  });

  it('PROVES Gate V1 and V3 FAIL when architecture binding is missing', async () => {
    // We register a communication system in the registry directly but we bypass authorizeCommunicationSystem
    // to avoid the p3ArchitectureId validation, or we update the system afterwards to make it invalid.
    const sys = await p9.authorizeCommunicationSystem({
      systemId: 'SYS-NEG-V1',
      architectureId: 'arch:valid-01',
      p4NodeId: 'thread:node:sys-neg-v1',
      configId: 'CONF-01'
    });

    // Verify valid state passes V1 and V3
    let gates = p9.verification.evaluateAllGates(sys.id);
    expect(gates.find(g => g.gateName === 'P9-V1_AUTHORITY_BINDING')?.verdict).toBe('PASS');
    expect(gates.find(g => g.gateName === 'P9-V3_ARCHITECTURE_BINDING')?.verdict).toBe('PASS');

    // Mutate to deliberately invalid state (remove architecture binding)
    p9.registry.updateSystem(sys.id, { p3ArchitectureId: '' });

    gates = p9.verification.evaluateAllGates(sys.id);
    expect(gates.find(g => g.gateName === 'P9-V1_AUTHORITY_BINDING')?.verdict).toBe('FAIL');
    expect(gates.find(g => g.gateName === 'P9-V3_ARCHITECTURE_BINDING')?.verdict).toBe('FAIL');
  });

  it('PROVES Gate V2 FAIL when canonical identity is falsy or contains forgery indicators', async () => {
    const sys = await p9.authorizeCommunicationSystem({
      systemId: 'SYS-NEG-V2',
      architectureId: 'arch:valid-02',
      p4NodeId: 'thread:node:sys-neg-v2',
      configId: 'CONF-01'
    });

    const originalId = sys.id;
    // Mutate system ID to contain forbidden forgery strings
    // We bypass validation by updating in-memory system object directly
    const sysObj = p9.registry.getSystem(originalId);
    if (sysObj) {
      sysObj.id = 'COMM-SYS-FAKE-V2';
    }

    const gates = p9.verification.evaluateAllGates(originalId);
    expect(gates.find(g => g.gateName === 'P9-V2_CANONICAL_IDENTITY')?.verdict).toBe('FAIL');
  });

  it('PROVES Gate V20 FAIL when results are bound to a mismatched stale revisionId', async () => {
    const archEntityId = 'arch:neg-v20';

    const revR1 = revisionEngine.createRevision({
      revisionId: `${archEntityId}:REV-A`,
      entityId: archEntityId,
      entityType: RevisionEntityType.CAD_MODEL,
      revisionCode: 'A',
      revisionNumber: 1,
      createdBy: 'COMM_LEAD',
      changeReason: 'Baseline R1',
      content: { busBandwidthMbps: 100 },
      snapshot: {} as any,
      lifecycleState: RevisionLifecycleState.RELEASED,
      dependencies: []
    });

    // Register Architecture Node in DigitalThreadRegistry
    digitalThread.registerNode({
      nodeId: archEntityId,
      nodeType: 'Architecture',
      canonicalId: archEntityId,
      authoritySource: 'P3_ARCHITECTURE_AUTHORITY',
      displayName: 'Gates Architecture CAD Model',
      configurationId: 'CONF-01',
      revisionId: revR1.revisionId
    });

    const sys = await p9.authorizeCommunicationSystem({
      systemId: 'SYS-NEG-V20',
      architectureId: archEntityId,
      p4NodeId: 'thread:node:sys-neg-v20',
      configId: 'CONF-01'
    });

    // Register Nodes & complete topology
    const node1 = p9.registry.registerNode({
      id: 'NODE-V20-1',
      systemId: 'SYS-NEG-V20',
      communicationSystemId: sys.id,
      p3ComponentId: 'comp:gates-1',
      p4NodeId: 'thread:node:gates-node1',
      nodeName: 'Node 1',
      processingDelayMs: 1.0,
      bufferCapacityBytes: 10000,
      configurationId: 'CONF-01',
      revisionId: revR1.revisionId
    });

    const node2 = p9.registry.registerNode({
      id: 'NODE-V20-2',
      systemId: 'SYS-NEG-V20',
      communicationSystemId: sys.id,
      p3ComponentId: 'comp:gates-2',
      p4NodeId: 'thread:node:gates-node2',
      nodeName: 'Node 2',
      processingDelayMs: 1.0,
      bufferCapacityBytes: 10000,
      configurationId: 'CONF-01',
      revisionId: revR1.revisionId
    });

    const iface1 = p9.registry.registerInterface({
      id: 'IFACE-V20-1',
      systemId: 'SYS-NEG-V20',
      nodeId: node1.id,
      interfaceName: 'Eth1',
      mediumType: 'COPPER_TWISTED_PAIR',
      maxBandwidthBps: 100e6,
      configurationId: 'CONF-01',
      revisionId: revR1.revisionId
    });

    const iface2 = p9.registry.registerInterface({
      id: 'IFACE-V20-2',
      systemId: 'SYS-NEG-V20',
      nodeId: node2.id,
      interfaceName: 'Eth1',
      mediumType: 'COPPER_TWISTED_PAIR',
      maxBandwidthBps: 100e6,
      configurationId: 'CONF-01',
      revisionId: revR1.revisionId
    });

    p9.registry.registerLink({
      id: 'LINK-V20-1',
      systemId: 'SYS-NEG-V20',
      communicationSystemId: sys.id,
      sourceInterfaceId: iface1.id,
      targetInterfaceId: iface2.id,
      lengthMeters: 5,
      linkCapacityBps: 100e6,
      configurationId: 'CONF-01',
      revisionId: revR1.revisionId
    });

    p9.registry.registerDataFlow({
      id: 'FLOW-V20-1',
      systemId: 'SYS-NEG-V20',
      communicationSystemId: sys.id,
      flowName: 'Flow 1',
      sourceNodeId: node1.id,
      destinationNodeId: node2.id,
      protocol: 'ETHERNET_IP',
      messageRateHz: 100,
      messageSizeBytes: 256,
      maxLatencyMs: 10,
      priority: 'HIGH_PRIORITY',
      configurationId: 'CONF-01',
      revisionId: revR1.revisionId
    });

    const envelope = await p9.execution.runExecution({
      executionId: 'exec:neg:v20',
      communicationSystemId: sys.id,
      scenarioId: 'SCENARIO-NOMINAL'
    });

    // Register active execution with matching revision (REV-A) -> V20 PASS
    p9.registry.registerExecution({
      id: envelope.executionId,
      type: 'CommunicationExecution',
      communicationSystemId: sys.id,
      scenarioId: 'SCENARIO-NOMINAL',
      startTime: new Date().toISOString(),
      durationSeconds: 1.0,
      status: 'VERIFIED',
      fingerprint: envelope.resultDigest,
      systemId: 'SYS-NEG-V20',
      configurationId: 'CONF-01',
      revisionId: revR1.revisionId, // MATCHES!
      authorityState: 'AUTHORITATIVE',
      lifecycleState: 'RELEASED',
      provenance: {},
      relationships: [],
      dependencies: [],
      verificationStatus: 'PASSED',
      evidenceReferences: []
    });

    let gates = p9.verification.evaluateAllGates(sys.id);
    expect(gates.find(g => g.gateName === 'P9-V20_RESULT_BINDING')?.verdict).toBe('PASS');

    // Deliberately mismatch system's revision ID to REV-B
    p9.registry.updateSystem(sys.id, { revisionId: 'arch:neg-v20:REV-B' });

    gates = p9.verification.evaluateAllGates(sys.id);
    expect(gates.find(g => g.gateName === 'P9-V20_RESULT_BINDING')?.verdict).toBe('FAIL');
  });

  it('PROVES Gate V24 FAIL when system p4NodeId is unregistered in the digital thread', async () => {
    const sys = await p9.authorizeCommunicationSystem({
      systemId: 'SYS-NEG-V24',
      architectureId: 'arch:valid-24',
      p4NodeId: 'thread:node:sys-neg-v24',
      configId: 'CONF-01'
    });

    // Verify valid state passes V24
    let gates = p9.verification.evaluateAllGates(sys.id);
    expect(gates.find(g => g.gateName === 'P9-V24_P4_DIGITAL_THREAD_BINDING')?.verdict).toBe('PASS');

    // Unregister node from Digital Thread Registry to trigger FAIL
    digitalThread.clear();

    gates = p9.verification.evaluateAllGates(sys.id);
    expect(gates.find(g => g.gateName === 'P9-V24_P4_DIGITAL_THREAD_BINDING')?.verdict).toBe('FAIL');
  });

  it('PROVES Gate V39 FAIL when digital thread has no bidirectional traceability edge', async () => {
    const archEntityId = 'arch:valid-39';
    const revR1 = revisionEngine.createRevision({
      revisionId: `${archEntityId}:REV-A`,
      entityId: archEntityId,
      entityType: RevisionEntityType.CAD_MODEL,
      revisionCode: 'A',
      revisionNumber: 1,
      createdBy: 'COMM_LEAD',
      changeReason: 'Baseline R1',
      content: { busBandwidthMbps: 100 },
      snapshot: {} as any,
      lifecycleState: RevisionLifecycleState.RELEASED,
      dependencies: []
    });

    // Register Architecture Node in DigitalThreadRegistry
    digitalThread.registerNode({
      nodeId: archEntityId,
      nodeType: 'Architecture',
      canonicalId: archEntityId,
      authoritySource: 'P3_ARCHITECTURE_AUTHORITY',
      displayName: 'Gates Architecture CAD Model',
      configurationId: 'CONF-01',
      revisionId: revR1.revisionId
    });

    const sys = await p9.authorizeCommunicationSystem({
      systemId: 'SYS-NEG-V39',
      architectureId: archEntityId,
      p4NodeId: 'thread:node:sys-neg-v39',
      configId: 'CONF-01'
    });

    // Valid state: IMPLEMENTED_BY edge exists -> V39 PASS
    let gates = p9.verification.evaluateAllGates(sys.id);
    expect(gates.find(g => g.gateName === 'P9-V39_BIDIRECTIONAL_TRACEABILITY')?.verdict).toBe('PASS');

    // Wipe digital thread edges to deliberately break traceability
    digitalThread['edges'].clear();

    gates = p9.verification.evaluateAllGates(sys.id);
    expect(gates.find(g => g.gateName === 'P9-V39_BIDIRECTIONAL_TRACEABILITY')?.verdict).toBe('FAIL');
  });

  it('PROVES Gate V40 FAIL when any prerequisite gate fails', async () => {
    const sys = await p9.authorizeCommunicationSystem({
      systemId: 'SYS-NEG-V40',
      architectureId: 'arch:valid-40',
      p4NodeId: 'thread:node:sys-neg-v40',
      configId: 'CONF-01'
    });

    // Violate a mandatory gate (e.g. remove architecture binding to fail V1 and V3)
    p9.registry.updateSystem(sys.id, { p3ArchitectureId: '' });

    const gates = p9.verification.evaluateAllGates(sys.id);
    expect(gates.find(g => g.gateName === 'P9-V40_TRUTH_CLOSURE')?.verdict).toBe('FAIL');
  });
});
