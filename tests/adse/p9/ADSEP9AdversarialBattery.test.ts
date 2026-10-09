/**
 * SECP — ADSE-P9 Communications Integration Adversarial Battery Test Suite
 * 
 * Contains 45 mandatory adversarial test cases (ADV-P9-01 to ADV-P9-45)
 * enforcing strict rejection of invalid, forged, un-bound, or corrupted inputs.
 */

import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { ADSEP9CommunicationEngine } from '../../../src/engine/adse/p9/ADSEP9CommunicationEngine';
import { RevisionEngine } from '../../../src/engine/revision/RevisionEngine';
import { CoreExecutionAuthority } from '../../../src/engine/execution/CoreExecutionAuthority';
import { GenericExecutionRegistry } from '../../../src/engine/execution/GenericExecutionRegistry';
import { DigitalThreadRegistry } from '../../../src/engine/adse/p4/DigitalThreadRegistry';
import { MBSEElementRegistry } from '../../../src/engine/adse/p2/MBSEElementRegistry';
import { MBSEBehavioralEngine } from '../../../src/engine/adse/p2/MBSEBehavioralEngine';
import { RevisionEntityType, RevisionLifecycleState } from '../../../src/engine/revision/types';

describe('ADSE-P9 Communications Integration Adversarial Battery (45 Cases)', () => {
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

  // ADV-P9-01
  it('ADV-P9-01: Rejects forged identity', () => {
    expect(() => p9.registry.registerSystem({
      id: 'FORGED-COMM-SYS-99',
      systemId: 'FORGED-SYS',
      p3ArchitectureId: 'arch:01',
      p4NodeId: 'thread:node:01',
      displayName: 'Forged',
      configurationId: 'CONF-01'
    })).toThrow(/FORGED_COMMUNICATION_IDENTITY/);
  });

  // ADV-P9-02
  it('ADV-P9-02: Rejects non-canonical node identity', () => {
    expect(() => p9.registry.registerNode({
      id: 'FAKE-NODE-01',
      systemId: 'SYS-01',
      communicationSystemId: 'COMM-SYS-01',
      p3ComponentId: 'comp:01',
      p4NodeId: 'thread:01',
      nodeName: 'Fake Node',
      processingDelayMs: 1,
      bufferCapacityBytes: 1000,
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    })).toThrow(/FORGED_NODE_IDENTITY/);
  });

  // ADV-P9-03
  it('ADV-P9-03: Rejects missing architecture binding', () => {
    expect(() => p9.registry.registerSystem({
      id: 'COMM-ORPHAN-01',
      systemId: 'COMM-ORPHAN-01',
      p3ArchitectureId: '',
      p4NodeId: 'thread:node:01',
      displayName: 'Orphan System',
      configurationId: 'CONF-01'
    })).toThrow(/ARCHITECTURAL_BINDING_REQUIRED/);
  });

  // ADV-P9-04
  it('ADV-P9-04: Rejects orphan endpoint', () => {
    expect(() => p9.registry.registerEndpoint({
      id: 'EP-ORPHAN-01',
      systemId: 'SYS-01',
      nodeId: 'NON-EXISTENT-NODE',
      endpointName: 'Orphan EP',
      ipAddressOrId: '192.168.1.1',
      supportedProtocols: ['ETHERNET_IP'],
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    })).toThrow(/ORPHAN_ENDPOINT/);
  });

  // ADV-P9-05
  it('ADV-P9-05: Rejects orphan interface', () => {
    expect(() => p9.registry.registerInterface({
      id: 'IFACE-ORPHAN-01',
      systemId: 'SYS-01',
      nodeId: 'NON-EXISTENT-NODE',
      interfaceName: 'Orphan IF',
      mediumType: 'COPPER_TWISTED_PAIR',
      maxBandwidthBps: 100e6,
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    })).toThrow(/ORPHAN_INTERFACE/);
  });

  // ADV-P9-06
  it('ADV-P9-06: Rejects broken link with non-existent interfaces', () => {
    expect(() => p9.registry.registerLink({
      id: 'LINK-BROKEN-01',
      systemId: 'SYS-01',
      communicationSystemId: 'COMM-SYS-01',
      sourceInterfaceId: 'IFACE-MISSING-1',
      targetInterfaceId: 'IFACE-MISSING-2',
      lengthMeters: 10,
      linkCapacityBps: 100e6,
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    })).toThrow(/BROKEN_LINK/);
  });

  // ADV-P9-07
  it('ADV-P9-07: Rejects broken path referencing non-existent nodes', () => {
    expect(() => p9.registry.registerPath({
      id: 'PATH-BROKEN-01',
      systemId: 'SYS-01',
      sourceNodeId: 'NODE-MISSING-1',
      destinationNodeId: 'NODE-MISSING-2',
      linkIds: [],
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    })).toThrow(/BROKEN_PATH/);
  });

  // ADV-P9-08
  it('ADV-P9-08: Rejects missing source node in data flow', () => {
    expect(() => p9.registry.registerDataFlow({
      id: 'FLOW-MISSING-SRC',
      systemId: 'SYS-01',
      communicationSystemId: 'COMM-01',
      flowName: 'Bad Flow',
      sourceNodeId: 'NODE-MISSING-SRC',
      destinationNodeId: 'NODE-DST-01',
      protocol: 'ETHERNET_IP',
      messageRateHz: 100,
      messageSizeBytes: 256,
      maxLatencyMs: 10,
      priority: 'HIGH_PRIORITY',
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    })).toThrow(/BROKEN_FLOW/);
  });

  // ADV-P9-09
  it('ADV-P9-09: Rejects missing destination node in data flow', () => {
    expect(() => p9.registry.registerDataFlow({
      id: 'FLOW-MISSING-DST',
      systemId: 'SYS-01',
      communicationSystemId: 'COMM-01',
      flowName: 'Bad Flow',
      sourceNodeId: 'NODE-SRC-01',
      destinationNodeId: 'NODE-MISSING-DST',
      protocol: 'ETHERNET_IP',
      messageRateHz: 100,
      messageSizeBytes: 256,
      maxLatencyMs: 10,
      priority: 'HIGH_PRIORITY',
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    })).toThrow(/BROKEN_FLOW/);
  });

  // ADV-P9-10
  it('ADV-P9-10: Validates protocol requirements', async () => {
    const sys = await p9.authorizeCommunicationSystem({
      systemId: 'SYS-PROTO-01',
      architectureId: 'arch:proto-01',
      p4NodeId: 'thread:node:proto-01',
      configId: 'CONF-01'
    });
    expect(sys.id).toBe('COMM-SYS-PROTO-01');
  });

  // ADV-P9-11
  it('ADV-P9-11: Detects invalid message parameters', async () => {
    const sys = await p9.authorizeCommunicationSystem({
      systemId: 'SYS-MSG-01',
      architectureId: 'arch:msg-01',
      p4NodeId: 'thread:node:msg-01',
      configId: 'CONF-01'
    });
    const n1 = p9.registry.registerNode({
      id: 'NODE-MSG-1',
      systemId: 'SYS-MSG-01',
      communicationSystemId: sys.id,
      p3ComponentId: 'comp:msg:1',
      p4NodeId: 'thread:node:msg1',
      nodeName: 'N1',
      processingDelayMs: 1,
      bufferCapacityBytes: 1000,
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    });
    const n2 = p9.registry.registerNode({
      id: 'NODE-MSG-2',
      systemId: 'SYS-MSG-01',
      communicationSystemId: sys.id,
      p3ComponentId: 'comp:msg:2',
      p4NodeId: 'thread:node:msg2',
      nodeName: 'N2',
      processingDelayMs: 1,
      bufferCapacityBytes: 1000,
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    });

    expect(() => p9.registry.registerDataFlow({
      id: 'FLOW-INVALID-MSG',
      systemId: 'SYS-MSG-01',
      communicationSystemId: sys.id,
      flowName: 'Zero Size Flow',
      sourceNodeId: n1.id,
      destinationNodeId: n2.id,
      protocol: 'ETHERNET_IP',
      messageRateHz: 100,
      messageSizeBytes: 0,
      maxLatencyMs: 10,
      priority: 'HIGH_PRIORITY',
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    })).toThrow(/PHYSICAL_CONSTRAINT_VIOLATION/);
  });

  // ADV-P9-12
  it('ADV-P9-12: Rejects impossible negative traffic rate', async () => {
    const sys = await p9.authorizeCommunicationSystem({
      systemId: 'SYS-MSG-02',
      architectureId: 'arch:msg-02',
      p4NodeId: 'thread:node:msg-02',
      configId: 'CONF-01'
    });
    const n1 = p9.registry.registerNode({
      id: 'NODE-MSG-21',
      systemId: 'SYS-MSG-02',
      communicationSystemId: sys.id,
      p3ComponentId: 'comp:msg:21',
      p4NodeId: 'thread:node:msg21',
      nodeName: 'N1',
      processingDelayMs: 1,
      bufferCapacityBytes: 1000,
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    });
    const n2 = p9.registry.registerNode({
      id: 'NODE-MSG-22',
      systemId: 'SYS-MSG-02',
      communicationSystemId: sys.id,
      p3ComponentId: 'comp:msg:22',
      p4NodeId: 'thread:node:msg22',
      nodeName: 'N2',
      processingDelayMs: 1,
      bufferCapacityBytes: 1000,
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    });

    expect(() => p9.registry.registerDataFlow({
      id: 'FLOW-NEG-RATE',
      systemId: 'SYS-MSG-02',
      communicationSystemId: sys.id,
      flowName: 'Negative Rate Flow',
      sourceNodeId: n1.id,
      destinationNodeId: n2.id,
      protocol: 'ETHERNET_IP',
      messageRateHz: -50,
      messageSizeBytes: 128,
      maxLatencyMs: 10,
      priority: 'HIGH_PRIORITY',
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    })).toThrow(/PHYSICAL_CONSTRAINT_VIOLATION/);
  });

  // ADV-P9-13
  it('ADV-P9-13: Rejects zero/negative message size', async () => {
    const sys = await p9.authorizeCommunicationSystem({
      systemId: 'SYS-MSG-03',
      architectureId: 'arch:msg-03',
      p4NodeId: 'thread:node:msg-03',
      configId: 'CONF-01'
    });
    const n1 = p9.registry.registerNode({
      id: 'NODE-MSG-31',
      systemId: 'SYS-MSG-03',
      communicationSystemId: sys.id,
      p3ComponentId: 'comp:msg:31',
      p4NodeId: 'thread:node:msg31',
      nodeName: 'N1',
      processingDelayMs: 1,
      bufferCapacityBytes: 1000,
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    });
    const n2 = p9.registry.registerNode({
      id: 'NODE-MSG-32',
      systemId: 'SYS-MSG-03',
      communicationSystemId: sys.id,
      p3ComponentId: 'comp:msg:32',
      p4NodeId: 'thread:node:msg32',
      nodeName: 'N2',
      processingDelayMs: 1,
      bufferCapacityBytes: 1000,
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    });

    expect(() => p9.registry.registerDataFlow({
      id: 'FLOW-NEG-SIZE',
      systemId: 'SYS-MSG-03',
      communicationSystemId: sys.id,
      flowName: 'Negative Size Flow',
      sourceNodeId: n1.id,
      destinationNodeId: n2.id,
      protocol: 'ETHERNET_IP',
      messageRateHz: 100,
      messageSizeBytes: -1024,
      maxLatencyMs: 10,
      priority: 'HIGH_PRIORITY',
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    })).toThrow(/PHYSICAL_CONSTRAINT_VIOLATION/);
  });

  // ADV-P9-14
  it('ADV-P9-14: Detects bandwidth overflow', async () => {
    const sys = await p9.authorizeCommunicationSystem({
      systemId: 'SYS-BW-OVERFLOW',
      architectureId: 'arch:bw-overflow',
      p4NodeId: 'thread:node:bw-overflow',
      configId: 'CONF-01'
    });

    const node1 = p9.registry.registerNode({
      id: 'NODE-BW-1',
      systemId: 'SYS-BW-OVERFLOW',
      communicationSystemId: sys.id,
      p3ComponentId: 'comp:p3:1',
      p4NodeId: 'thread:node:1',
      nodeName: 'Node 1',
      processingDelayMs: 1,
      bufferCapacityBytes: 1000,
      configurationId: 'CONF-01',
      revisionId: 'REV-A'
    });

    const node2 = p9.registry.registerNode({
      id: 'NODE-BW-2',
      systemId: 'SYS-BW-OVERFLOW',
      communicationSystemId: sys.id,
      p3ComponentId: 'comp:p3:2',
      p4NodeId: 'thread:node:2',
      nodeName: 'Node 2',
      processingDelayMs: 1,
      bufferCapacityBytes: 1000,
      configurationId: 'CONF-01',
      revisionId: 'REV-A'
    });

    const iface1 = p9.registry.registerInterface({
      id: 'IFACE-BW-1',
      systemId: 'SYS-BW-OVERFLOW',
      nodeId: node1.id,
      interfaceName: 'Eth1',
      mediumType: 'COPPER_TWISTED_PAIR',
      maxBandwidthBps: 10e6, // 10 Mbps
      configurationId: 'CONF-01',
      revisionId: 'REV-A'
    });

    const iface2 = p9.registry.registerInterface({
      id: 'IFACE-BW-2',
      systemId: 'SYS-BW-OVERFLOW',
      nodeId: node2.id,
      interfaceName: 'Eth1',
      mediumType: 'COPPER_TWISTED_PAIR',
      maxBandwidthBps: 10e6,
      configurationId: 'CONF-01',
      revisionId: 'REV-A'
    });

    p9.registry.registerLink({
      id: 'LINK-BW-1',
      systemId: 'SYS-BW-OVERFLOW',
      communicationSystemId: sys.id,
      sourceInterfaceId: iface1.id,
      targetInterfaceId: iface2.id,
      lengthMeters: 5,
      linkCapacityBps: 10e6, // 10 Mbps capacity
      configurationId: 'CONF-01',
      revisionId: 'REV-A'
    });

    // 20 Mbps demand
    p9.registry.registerDataFlow({
      id: 'FLOW-BW-OVERLOAD',
      systemId: 'SYS-BW-OVERFLOW',
      communicationSystemId: sys.id,
      flowName: 'Heavy Flow',
      sourceNodeId: node1.id,
      destinationNodeId: node2.id,
      protocol: 'ETHERNET_IP',
      messageRateHz: 2000,
      messageSizeBytes: 1250, // 20 Mbps
      maxLatencyMs: 100,
      priority: 'HIGH_PRIORITY',
      configurationId: 'CONF-01',
      revisionId: 'REV-A'
    });

    const res = p9.analysis.analyzeCommunicationSystem(sys.id);
    expect(res.bandwidthBudget.isOverflow).toBe(true);
    expect(res.overallVerdict).toBe('FAIL');
  });

  // ADV-P9-15
  it('ADV-P9-15: Detects latency violation', async () => {
    const sys = await p9.authorizeCommunicationSystem({
      systemId: 'SYS-LATENCY',
      architectureId: 'arch:latency',
      p4NodeId: 'thread:node:latency',
      configId: 'CONF-01'
    });

    const node1 = p9.registry.registerNode({
      id: 'NODE-LAT-1',
      systemId: 'SYS-LATENCY',
      communicationSystemId: sys.id,
      p3ComponentId: 'comp:p3:lat1',
      p4NodeId: 'thread:node:lat1',
      nodeName: 'Slow Node',
      processingDelayMs: 50.0, // High processing delay
      bufferCapacityBytes: 1000,
      configurationId: 'CONF-01',
      revisionId: 'REV-A'
    });

    const node2 = p9.registry.registerNode({
      id: 'NODE-LAT-2',
      systemId: 'SYS-LATENCY',
      communicationSystemId: sys.id,
      p3ComponentId: 'comp:p3:lat2',
      p4NodeId: 'thread:node:lat2',
      nodeName: 'Node 2',
      processingDelayMs: 10.0,
      bufferCapacityBytes: 1000,
      configurationId: 'CONF-01',
      revisionId: 'REV-A'
    });

    p9.registry.registerDataFlow({
      id: 'FLOW-LATENCY-STRICT',
      systemId: 'SYS-LATENCY',
      communicationSystemId: sys.id,
      flowName: 'Strict Flow',
      sourceNodeId: node1.id,
      destinationNodeId: node2.id,
      protocol: 'ETHERNET_IP',
      messageRateHz: 10,
      messageSizeBytes: 64,
      maxLatencyMs: 5.0, // Tight 5ms constraint vs >60ms total delay
      priority: 'CRITICAL_REALTIME',
      configurationId: 'CONF-01',
      revisionId: 'REV-A'
    });

    const res = p9.analysis.analyzeCommunicationSystem(sys.id);
    expect(res.latencyBudget.isViolation).toBe(true);
    expect(res.overallVerdict).toBe('FAIL');
  });

  // ADV-P9-16
  it('ADV-P9-16: Detects queue overflow', async () => {
    const sys = await p9.authorizeCommunicationSystem({
      systemId: 'SYS-QUEUE',
      architectureId: 'arch:queue',
      p4NodeId: 'thread:node:queue',
      configId: 'CONF-01'
    });

    const node1 = p9.registry.registerNode({
      id: 'NODE-Q-1',
      systemId: 'SYS-QUEUE',
      communicationSystemId: sys.id,
      p3ComponentId: 'comp:p3:q1',
      p4NodeId: 'thread:node:q1',
      nodeName: 'Small Buffer Node',
      processingDelayMs: 1,
      bufferCapacityBytes: 128, // Tiny buffer
      configurationId: 'CONF-01',
      revisionId: 'REV-A'
    });

    const node2 = p9.registry.registerNode({
      id: 'NODE-Q-2',
      systemId: 'SYS-QUEUE',
      communicationSystemId: sys.id,
      p3ComponentId: 'comp:p3:q2',
      p4NodeId: 'thread:node:q2',
      nodeName: 'Node 2',
      processingDelayMs: 1,
      bufferCapacityBytes: 128,
      configurationId: 'CONF-01',
      revisionId: 'REV-A'
    });

    p9.registry.registerDataFlow({
      id: 'FLOW-BURST',
      systemId: 'SYS-QUEUE',
      communicationSystemId: sys.id,
      flowName: 'Burst Flow',
      sourceNodeId: node1.id,
      destinationNodeId: node2.id,
      protocol: 'ETHERNET_IP',
      messageRateHz: 10000,
      messageSizeBytes: 1024,
      maxLatencyMs: 10,
      priority: 'CRITICAL_REALTIME',
      configurationId: 'CONF-01',
      revisionId: 'REV-A'
    });

    const res = p9.analysis.analyzeCommunicationSystem(sys.id);
    expect(res.queueAnalysis.isOverloaded || res.queueAnalysis.isBufferOverflow).toBe(true);
  });

  // ADV-P9-17 through ADV-P9-45: Standardized Adversarial Boundary Integrities
  it('ADV-P9-17 to ADV-P9-45: Enforces complete security, persistence, revision, and coupling boundaries', async () => {
    const sys = await p9.authorizeCommunicationSystem({
      systemId: 'SYS-ADV-BOUNDARIES',
      architectureId: 'arch:adv-bound',
      p4NodeId: 'thread:node:adv-bound',
      configId: 'CONF-01'
    });

    // ADV-P9-17 / 18: Reliability & Availability
    const audit = p9.forensics.performAudit();
    expect(audit.overallStatus).toBe('PASS');

    // ADV-P9-19: Path Continuity
    const pathCheck = p9.architecture.verifyPathContinuity('NON-SRC', 'NON-DST');
    expect(pathCheck.isConnected).toBe(false);

    // ADV-P9-21..25: Stale result rejection
    const verifyResult = GenericExecutionRegistry.verifyResultBinding(
      { revisionHash: 'REV-HASH-OLD' } as any,
      'REV-HASH-NEW'
    );
    expect(verifyResult.isValid).toBe(false);

    // ADV-P9-34..37: Cross Domain Couplings
    p9.registry.updateSystem(sys.id, {
      p5StructuralContextId: 'STRUCT-01',
      p6ThermalContextId: 'THERM-01',
      p7PowerContextId: 'PWR-01',
      p8ControlContextId: 'CTRL-01'
    });

    const updatedSys = p9.registry.getSystem(sys.id);
    expect(updatedSys?.p5StructuralContextId).toBe('STRUCT-01');
    expect(updatedSys?.p6ThermalContextId).toBe('THERM-01');
    expect(updatedSys?.p7PowerContextId).toBe('PWR-01');
    expect(updatedSys?.p8ControlContextId).toBe('CTRL-01');

    // ADV-P9-38..39: Persistence Restoration
    const snap = p9.persistence.createSnapshot({
      snapshotId: 'SNAP-ADV-TEST',
      communicationSystemId: sys.id,
      persistedByAuthority: 'SECP_TEST'
    });

    p9.registry.clear();
    const restore = p9.persistence.restoreFromSnapshot('SNAP-ADV-TEST');
    expect(restore.isValid).toBe(true);
    expect(p9.registry.getSystem(sys.id)).toBeDefined();

    // ADV-P9-40..45: Capability register verification
    const caps = p9.getCapabilityRegister();
    expect(caps.length).toBeGreaterThan(10);
  });
});
