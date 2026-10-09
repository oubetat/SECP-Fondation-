import { describe, it, expect, beforeEach } from 'vitest';
import { CoreExecutionAuthority } from '../../../src/engine/execution/CoreExecutionAuthority';
import { RevisionEngine } from '../../../src/engine/revision/RevisionEngine';
import { ADSEP9CommunicationEngine } from '../../../src/engine/adse/p9/ADSEP9CommunicationEngine';
import { DigitalThreadRegistry } from '../../../src/engine/adse/p4/DigitalThreadRegistry';
import { MBSEElementRegistry } from '../../../src/engine/adse/p2/MBSEElementRegistry';
import { MBSEBehavioralEngine } from '../../../src/engine/adse/p2/MBSEBehavioralEngine';
import { RevisionEntityType, RevisionLifecycleState } from '../../../src/engine/revision/types';

describe('ADSE-P9 Core Provenance Regression Tests', () => {
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

  it('PROVES duplicate RESULT content from two executions cannot create dangling provenance edges', async () => {
    const archEntityId = 'arch:prov-duplicate-01';

    // 1. Create CAD revision
    const revR1 = revisionEngine.createRevision({
      revisionId: `${archEntityId}:REV-A`,
      entityId: archEntityId,
      entityType: RevisionEntityType.CAD_MODEL,
      revisionCode: 'A',
      revisionNumber: 1,
      createdBy: 'CHIEF_COMMUNICATION_ENGINEER',
      changeReason: 'Provenance test baseline',
      content: { busBandwidthMbps: 100, maxNodes: 8 },
      snapshot: {} as any,
      lifecycleState: RevisionLifecycleState.RELEASED,
      dependencies: []
    });

    // 2. Authorize System
    const sys = await p9.authorizeCommunicationSystem({
      systemId: 'SYS-PROV-01',
      architectureId: archEntityId,
      p4NodeId: 'thread:node:sys-prov-01',
      configId: 'CONF-01'
    });

    // Register basic nodes & links
    const node1 = p9.registry.registerNode({
      id: 'NODE-P-1',
      systemId: 'SYS-PROV-01',
      communicationSystemId: sys.id,
      p3ComponentId: 'comp:p-1',
      p4NodeId: 'thread:node:node-p-1',
      nodeName: 'Node 1',
      processingDelayMs: 1.0,
      bufferCapacityBytes: 10000,
      configurationId: 'CONF-01',
      revisionId: revR1.revisionId
    });

    const node2 = p9.registry.registerNode({
      id: 'NODE-P-2',
      systemId: 'SYS-PROV-01',
      communicationSystemId: sys.id,
      p3ComponentId: 'comp:p-2',
      p4NodeId: 'thread:node:node-p-2',
      nodeName: 'Node 2',
      processingDelayMs: 1.0,
      bufferCapacityBytes: 10000,
      configurationId: 'CONF-01',
      revisionId: revR1.revisionId
    });

    const iface1 = p9.registry.registerInterface({
      id: 'IFACE-P-1',
      systemId: 'SYS-PROV-01',
      nodeId: node1.id,
      interfaceName: 'Eth1',
      mediumType: 'COPPER_TWISTED_PAIR',
      maxBandwidthBps: 100e6,
      configurationId: 'CONF-01',
      revisionId: revR1.revisionId
    });

    const iface2 = p9.registry.registerInterface({
      id: 'IFACE-P-2',
      systemId: 'SYS-PROV-01',
      nodeId: node2.id,
      interfaceName: 'Eth1',
      mediumType: 'COPPER_TWISTED_PAIR',
      maxBandwidthBps: 100e6,
      configurationId: 'CONF-01',
      revisionId: revR1.revisionId
    });

    p9.registry.registerLink({
      id: 'LINK-P-1',
      systemId: 'SYS-PROV-01',
      communicationSystemId: sys.id,
      sourceInterfaceId: iface1.id,
      targetInterfaceId: iface2.id,
      lengthMeters: 5,
      linkCapacityBps: 100e6,
      configurationId: 'CONF-01',
      revisionId: revR1.revisionId
    });

    p9.registry.registerDataFlow({
      id: 'FLOW-P-1',
      systemId: 'SYS-PROV-01',
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

    // 3. Execution E1 with standard parameters
    const envelopeE1 = await p9.execution.runExecution({
      executionId: 'exec:prov:E1',
      communicationSystemId: sys.id,
      scenarioId: 'SCENARIO-P-1'
    });

    // 4. Execution E2 with the EXACT same parameters and exact same outputs
    const envelopeE2 = await p9.execution.runExecution({
      executionId: 'exec:prov:E2',
      communicationSystemId: sys.id,
      scenarioId: 'SCENARIO-P-1'
    });

    expect(envelopeE1.resultDigest).toBe(envelopeE2.resultDigest);

    // Get the core provenance graph
    const graph = CoreExecutionAuthority.getProvenanceGraph();
    const nodesInGraph = graph.getNodes();
    const edgesInGraph = graph.getEdges();

    expect(nodesInGraph.length).toBeGreaterThan(0);
    expect(edgesInGraph.length).toBeGreaterThan(0);

    // CRITICAL PROVENANCE INVARIANT: Every edge source and target MUST exist in the graph nodes
    for (const edge of edgesInGraph) {
      const hasFrom = graph.hasNode(edge.fromNodeId);
      const hasTo = graph.hasNode(edge.toNodeId);

      expect(hasFrom).toBe(true);
      expect(hasTo).toBe(true);
    }
  });
});
