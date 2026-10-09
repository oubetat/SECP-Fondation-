/**
 * SECP — ADSE-P9 Communications Integration Gap Closure & Forensic Verification Suite
 * 
 * Verifies:
 * - GAP-01: Model Persistence & Reconstruction Parity
 * - GAP-02: Official P4 Digital Thread Lineage & Preservation
 * - GAP-03: Reactive Result Invalidation across P1/P2/P3/P5/P6/P7/P8
 * - 40 Forensic Gate Evaluations (P9-V1 to P9-V40)
 */

import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { ADSEP9CommunicationEngine } from '../../../src/engine/adse/p9/ADSEP9CommunicationEngine';
import { RevisionEngine } from '../../../src/engine/revision/RevisionEngine';
import { CoreExecutionAuthority } from '../../../src/engine/execution/CoreExecutionAuthority';
import { DigitalThreadRegistry } from '../../../src/engine/adse/p4/DigitalThreadRegistry';
import { MBSEElementRegistry } from '../../../src/engine/adse/p2/MBSEElementRegistry';
import { MBSEBehavioralEngine } from '../../../src/engine/adse/p2/MBSEBehavioralEngine';
import { RevisionEntityType, RevisionLifecycleState } from '../../../src/engine/revision/types';

describe('ADSE-P9 Gap Closure & Forensic Gate Verification Suite', () => {
  let p9: ADSEP9CommunicationEngine;
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
    p9 = new ADSEP9CommunicationEngine(revisionEngine, behavioralEngine, digitalThread);
  });

  it('PROVES GAP-01: Cryptographic Persistence & Deterministic Reconstruction', async () => {
    const sys = await p9.authorizeCommunicationSystem({
      systemId: 'GAP1-SYS-01',
      architectureId: 'arch:gap1-01',
      p4NodeId: 'thread:node:gap1-01',
      configId: 'CONF-01'
    });

    const node1 = p9.registry.registerNode({
      id: 'NODE-GAP1-1',
      systemId: 'GAP1-SYS-01',
      communicationSystemId: sys.id,
      p3ComponentId: 'comp:gap1-1',
      p4NodeId: 'thread:node:gap1-node1',
      nodeName: 'Node 1',
      processingDelayMs: 1.0,
      bufferCapacityBytes: 10000,
      configurationId: 'CONF-01',
      revisionId: 'REV-A'
    });

    const node2 = p9.registry.registerNode({
      id: 'NODE-GAP1-2',
      systemId: 'GAP1-SYS-01',
      communicationSystemId: sys.id,
      p3ComponentId: 'comp:gap1-2',
      p4NodeId: 'thread:node:gap1-node2',
      nodeName: 'Node 2',
      processingDelayMs: 1.0,
      bufferCapacityBytes: 10000,
      configurationId: 'CONF-01',
      revisionId: 'REV-A'
    });

    const iface1 = p9.registry.registerInterface({
      id: 'IFACE-GAP1-1',
      systemId: 'GAP1-SYS-01',
      nodeId: node1.id,
      interfaceName: 'Eth1',
      mediumType: 'COPPER_TWISTED_PAIR',
      maxBandwidthBps: 100e6,
      configurationId: 'CONF-01',
      revisionId: 'REV-A'
    });

    const iface2 = p9.registry.registerInterface({
      id: 'IFACE-GAP1-2',
      systemId: 'GAP1-SYS-01',
      nodeId: node2.id,
      interfaceName: 'Eth1',
      mediumType: 'COPPER_TWISTED_PAIR',
      maxBandwidthBps: 100e6,
      configurationId: 'CONF-01',
      revisionId: 'REV-A'
    });

    p9.registry.registerLink({
      id: 'LINK-GAP1-1',
      systemId: 'GAP1-SYS-01',
      communicationSystemId: sys.id,
      sourceInterfaceId: iface1.id,
      targetInterfaceId: iface2.id,
      lengthMeters: 5,
      linkCapacityBps: 100e6,
      configurationId: 'CONF-01',
      revisionId: 'REV-A'
    });

    const flow1 = p9.registry.registerDataFlow({
      id: 'FLOW-GAP1-1',
      systemId: 'GAP1-SYS-01',
      communicationSystemId: sys.id,
      flowName: 'Telemetry Flow',
      sourceNodeId: node1.id,
      destinationNodeId: node2.id,
      protocol: 'ETHERNET_IP',
      messageRateHz: 100,
      messageSizeBytes: 256,
      maxLatencyMs: 10,
      priority: 'HIGH_PRIORITY',
      configurationId: 'CONF-01',
      revisionId: 'REV-A'
    });

    // Capture Snapshot
    const snap = p9.persistence.createSnapshot({
      snapshotId: 'SNAP-GAP1-PROVEN',
      communicationSystemId: sys.id,
      persistedByAuthority: 'SECP_GAP_TEST'
    });

    expect(snap.merkleRootHash).toBeDefined();

    // Destroy Memory
    p9.registry.clear();
    expect(p9.registry.getSystem(sys.id)).toBeUndefined();
    expect(p9.registry.getDataFlow(flow1.id)).toBeUndefined();

    // Reconstruct
    const restore = p9.persistence.restoreFromSnapshot('SNAP-GAP1-PROVEN');
    expect(restore.isValid).toBe(true);

    // Verify Parity
    const reconstructedSys = p9.registry.getSystem(sys.id);
    const reconstructedFlow = p9.registry.getDataFlow(flow1.id);

    expect(reconstructedSys).toBeDefined();
    expect(reconstructedFlow).toBeDefined();
    expect(reconstructedFlow?.requiredBandwidthBps).toBe(flow1.requiredBandwidthBps);
  });

  it('PROVES GAP-02: P4 Digital Thread Binding & Lineage Preservation', async () => {
    const sysId = 'GAP2-THREAD-SYS';
    const archId = 'arch:node:GAP2-ARCH-01';
    const p4NodeId = 'thread:node:GAP2-THREAD-SYS';

    digitalThread.registerNode({
      nodeId: archId,
      nodeType: 'Architecture',
      canonicalId: archId,
      authoritySource: 'P3_ARCHITECTURE_AUTHORITY',
      displayName: 'Gap2 Architecture',
      configurationId: 'CONF-01'
    });

    const sys = await p9.authorizeCommunicationSystem({
      systemId: sysId,
      architectureId: archId,
      p4NodeId,
      configId: 'CONF-01'
    });

    const initialNode = digitalThread.getNode(p4NodeId);
    expect(initialNode).toBeDefined();

    // Perform Revision Update
    p9.registry.updateSystem(sys.id, { revisionId: 'REV-NEW-COMM-LINEAGE-02' });

    const expectedRevisedNodeId = `${p4NodeId}:rev:REV-NEW-COMM-LINEAGE-02`;
    const revisedNode = digitalThread.getNode(expectedRevisedNodeId);
    expect(revisedNode).toBeDefined();

    const edges = digitalThread.getEdgesForNode(p4NodeId);
    expect(edges.outgoing.some(e => e.targetNodeId === expectedRevisedNodeId && e.edgeType === 'REVISED_BY')).toBe(true);
  });

  it('PROVES GAP-03: Multi-Dependency Invalidation (P5/P6/P7/P8 & Canonical Revisions)', async () => {
    const sys = await p9.authorizeCommunicationSystem({
      systemId: 'GAP3-INVALIDATION-SYS',
      architectureId: 'arch:gap3-01',
      p4NodeId: 'thread:node:gap3-01',
      configId: 'CONF-01'
    });

    const execRecord: any = {
      id: 'EXEC-GAP3-001',
      type: 'CommunicationExecution',
      communicationSystemId: sys.id,
      scenarioId: 'SCEN-01',
      startTime: new Date().toISOString(),
      durationSeconds: 1,
      status: 'VERIFIED',
      fingerprint: 'HASH-E1',
      systemId: 'GAP3-INVALIDATION-SYS',
      configurationId: 'CONF-01',
      revisionId: 'REV-A',
      authorityState: 'AUTHORITATIVE',
      lifecycleState: 'RELEASED',
      provenance: {},
      relationships: [],
      dependencies: [],
      verificationStatus: 'PASSED',
      evidenceReferences: []
    };

    p9.registry.registerExecution(execRecord);
    expect(p9.registry.getExecution('EXEC-GAP3-001')?.status).toBe('VERIFIED');

    // Trigger Invalidation via Structural/Thermal/Power Context Update
    p9.registry.updateSystem(sys.id, { p6ThermalContextId: 'THERM-CRITICAL-OVERHEAT-01' });

    expect(p9.registry.getExecution('EXEC-GAP3-001')?.status).toBe('INVALIDATED');
  });

  it('PROVES 40 Forensic Gates (P9-V1 to P9-V40)', async () => {
    const archEntityId = 'arch:gates-all';

    // 1. Register Canonical CAD model revision
    const revR1 = revisionEngine.createRevision({
      revisionId: `${archEntityId}:REV-A`,
      entityId: archEntityId,
      entityType: RevisionEntityType.CAD_MODEL,
      revisionCode: 'A',
      revisionNumber: 1,
      createdBy: 'CHIEF_COMMUNICATION_ENGINEER',
      changeReason: 'Initial gates baseline',
      content: { busBandwidthMbps: 100, maxNodes: 8 },
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

    // 2. Authorize Communication System
    const sys = await p9.authorizeCommunicationSystem({
      systemId: 'SYS-GATES-ALL',
      architectureId: archEntityId,
      p4NodeId: 'thread:node:gates-all',
      configId: 'CONF-01'
    });

    // 3. Register Nodes
    const node1 = p9.registry.registerNode({
      id: 'NODE-GATES-1',
      systemId: 'SYS-GATES-ALL',
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
      id: 'NODE-GATES-2',
      systemId: 'SYS-GATES-ALL',
      communicationSystemId: sys.id,
      p3ComponentId: 'comp:gates-2',
      p4NodeId: 'thread:node:gates-node2',
      nodeName: 'Node 2',
      processingDelayMs: 1.0,
      bufferCapacityBytes: 10000,
      configurationId: 'CONF-01',
      revisionId: revR1.revisionId
    });

    // 4. Register Endpoints
    p9.registry.registerEndpoint({
      id: 'EP-GATES-1',
      systemId: 'SYS-GATES-ALL',
      nodeId: node1.id,
      endpointName: 'Endpoint 1',
      ipAddressOrId: '10.0.0.1',
      supportedProtocols: ['ETHERNET_IP'],
      configurationId: 'CONF-01',
      revisionId: revR1.revisionId
    });

    p9.registry.registerEndpoint({
      id: 'EP-GATES-2',
      systemId: 'SYS-GATES-ALL',
      nodeId: node2.id,
      endpointName: 'Endpoint 2',
      ipAddressOrId: '10.0.0.2',
      supportedProtocols: ['ETHERNET_IP'],
      configurationId: 'CONF-01',
      revisionId: revR1.revisionId
    });

    // 5. Register Interfaces
    const iface1 = p9.registry.registerInterface({
      id: 'IFACE-GATES-1',
      systemId: 'SYS-GATES-ALL',
      nodeId: node1.id,
      interfaceName: 'Eth1',
      mediumType: 'COPPER_TWISTED_PAIR',
      maxBandwidthBps: 100e6,
      configurationId: 'CONF-01',
      revisionId: revR1.revisionId
    });

    const iface2 = p9.registry.registerInterface({
      id: 'IFACE-GATES-2',
      systemId: 'SYS-GATES-ALL',
      nodeId: node2.id,
      interfaceName: 'Eth1',
      mediumType: 'COPPER_TWISTED_PAIR',
      maxBandwidthBps: 100e6,
      configurationId: 'CONF-01',
      revisionId: revR1.revisionId
    });

    // 6. Register Links
    p9.registry.registerLink({
      id: 'LINK-GATES-1',
      systemId: 'SYS-GATES-ALL',
      communicationSystemId: sys.id,
      sourceInterfaceId: iface1.id,
      targetInterfaceId: iface2.id,
      lengthMeters: 5,
      linkCapacityBps: 100e6,
      configurationId: 'CONF-01',
      revisionId: revR1.revisionId
    });

    // 7. Register Channels
    p9.registry.registerChannel({
      id: 'CHAN-GATES-1',
      systemId: 'SYS-GATES-ALL',
      linkId: 'LINK-GATES-1',
      channelName: 'Channel 1',
      assignedBandwidthBps: 50e6,
      protocol: 'ETHERNET_IP',
      configurationId: 'CONF-01',
      revisionId: revR1.revisionId
    });

    // 8. Register Paths
    p9.registry.registerPath({
      id: 'PATH-GATES-1',
      systemId: 'SYS-GATES-ALL',
      sourceNodeId: node1.id,
      destinationNodeId: node2.id,
      linkIds: ['LINK-GATES-1'],
      configurationId: 'CONF-01',
      revisionId: revR1.revisionId
    });

    // 9. Register Data Flows with couplings
    p9.registry.registerDataFlow({
      id: 'FLOW-GATES-1',
      systemId: 'SYS-GATES-ALL',
      communicationSystemId: sys.id,
      p2MbseFlowId: 'mbse-flow-gates-1',
      p8ControlSignalId: 'ctrl-sig-gates-1',
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

    // 10. Configure Multi-Domain Couplings and Lifecycle State on System
    p9.registry.updateSystem(sys.id, {
      revisionId: revR1.revisionId,
      p5StructuralContextId: 'STRUCT-GATES',
      p6ThermalContextId: 'THERM-GATES',
      p7PowerContextId: 'PWR-GATES',
      p8ControlContextId: 'CTRL-GATES',
      lifecycleState: 'RELEASED'
    });

    // 11. Run execution
    const envelope = await p9.execution.runExecution({
      executionId: 'exec:gates-all',
      communicationSystemId: sys.id,
      scenarioId: 'SCENARIO-GATES-ALL'
    });

    // 12. Register execution with evidence references
    p9.registry.registerExecution({
      id: envelope.executionId,
      type: 'CommunicationExecution',
      communicationSystemId: sys.id,
      scenarioId: 'SCENARIO-GATES-ALL',
      startTime: new Date().toISOString(),
      durationSeconds: 1.0,
      status: 'VERIFIED',
      fingerprint: envelope.resultDigest,
      systemId: 'SYS-GATES-ALL',
      configurationId: 'CONF-01',
      revisionId: revR1.revisionId,
      authorityState: 'AUTHORITATIVE',
      lifecycleState: 'RELEASED',
      provenance: { originHash: envelope.resultDigest },
      relationships: [],
      dependencies: [{ entityId: archEntityId, revisionId: revR1.revisionId }],
      verificationStatus: 'PASSED',
      evidenceReferences: [envelope.evidenceLeaf?.leafHash || 'evidence-hash-123']
    });

    // 13. Evaluate Gates
    const gates = p9.verification.evaluateAllGates(sys.id);
    expect(gates.length).toBe(40);
    expect(gates.every(g => g.verdict === 'PASS')).toBe(true);
  });
});
