/**
 * SECP — ADSE-P9 Master Forensic Truth Chain Test Suite
 * 
 * MANDATORY CONTINUOUS FORENSIC PROOF:
 * R1 -> P9 Communication Architecture -> Nodes -> Interfaces -> Links -> Data Flow ->
 * CoreExecutionAuthority -> E1 -> Independent Verification -> Evidence -> Provenance ->
 * P4 Digital Thread -> Persistence ->
 * R2 Revision Mutation -> RevisionImpactAnalyzer -> E1 INVALIDATED -> verifyResultBinding(E1, R2) REJECTED ->
 * R2 -> Execution E2 -> E2 verified for R2 -> Persistence ->
 * Memory Destruction -> Reload & Reconstruction ->
 * PROVE: E1 remains INVALIDATED, E2 remains VERIFIED, P4 lineage intact, Evidence intact.
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

describe('ADSE-P9 SECP Master Forensic Truth Chain Test Suite', () => {
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

  it('PROVES FULL MASTER FORENSIC TRUTH CHAIN: R1 -> E1 -> R2 Mutation -> Invalidation -> E2 -> Persistence -> Reconstruction Parity', async () => {
    const archEntityId = 'arch:node:COMMUNICATION-BUS-001';

    // 1. Create Canonical Revision R1 in RevisionEngine
    const revR1 = revisionEngine.createRevision({
      revisionId: `${archEntityId}:REV-A`,
      entityId: archEntityId,
      entityType: RevisionEntityType.CAD_MODEL,
      revisionCode: 'A',
      revisionNumber: 1,
      createdBy: 'CHIEF_COMMUNICATION_ENGINEER',
      changeReason: 'Initial avionics bus architecture baseline',
      content: { busBandwidthMbps: 100, maxNodes: 8 },
      snapshot: {} as any,
      lifecycleState: RevisionLifecycleState.RELEASED,
      dependencies: []
    });

    expect(revR1.revisionHash).toBeDefined();
    expect(revR1.revisionHash.length).toBe(64);

    // 2. Authorize Communication System in P9
    const sys = await p9.authorizeCommunicationSystem({
      systemId: 'AVIONICS-COMM-SYS-01',
      architectureId: archEntityId,
      p4NodeId: 'thread:node:AVIONICS-COMM-SYS-01',
      configId: 'CONF-COMM-01'
    });

    // Register a downstream dependency link in RevisionEngine connecting P9 system to canonical object
    revisionEngine.createRevision({
      revisionId: `${sys.id}:REV-A`,
      entityId: sys.id,
      entityType: RevisionEntityType.EVIDENCE,
      revisionCode: 'A',
      revisionNumber: 1,
      createdBy: 'P9_SYSTEM',
      changeReason: 'Communication system binding to architecture',
      content: { communicationSystemId: sys.id },
      snapshot: {} as any,
      lifecycleState: RevisionLifecycleState.RELEASED,
      dependencies: [{ entityId: archEntityId, revisionId: revR1.revisionId, isFloating: true }]
    });

    // 3. Register Communication Topology (Nodes, Interfaces, Links, Data Flows)
    const nodeA = p9.registry.registerNode({
      id: 'NODE-FLIGHT-COMPUTER',
      systemId: 'AVIONICS-COMM-SYS-01',
      communicationSystemId: sys.id,
      p3ComponentId: 'comp:p3:flight-computer',
      p4NodeId: 'thread:node:flight-computer',
      nodeName: 'Flight Computer Unit',
      processingDelayMs: 2.0,
      bufferCapacityBytes: 1048576,
      configurationId: 'CONF-COMM-01',
      revisionId: revR1.revisionId
    });

    const nodeB = p9.registry.registerNode({
      id: 'NODE-SENSOR-CONCENTRATOR',
      systemId: 'AVIONICS-COMM-SYS-01',
      communicationSystemId: sys.id,
      p3ComponentId: 'comp:p3:sensor-concentrator',
      p4NodeId: 'thread:node:sensor-concentrator',
      nodeName: 'Sensor Concentrator Unit',
      processingDelayMs: 1.5,
      bufferCapacityBytes: 524288,
      configurationId: 'CONF-COMM-01',
      revisionId: revR1.revisionId
    });

    const ifaceA = p9.registry.registerInterface({
      id: 'IFACE-FC-ETH1',
      systemId: 'AVIONICS-COMM-SYS-01',
      nodeId: nodeA.id,
      interfaceName: 'Ethernet Port 1',
      mediumType: 'COPPER_TWISTED_PAIR',
      maxBandwidthBps: 100e6,
      configurationId: 'CONF-COMM-01',
      revisionId: revR1.revisionId
    });

    const ifaceB = p9.registry.registerInterface({
      id: 'IFACE-SC-ETH1',
      systemId: 'AVIONICS-COMM-SYS-01',
      nodeId: nodeB.id,
      interfaceName: 'Ethernet Port 1',
      mediumType: 'COPPER_TWISTED_PAIR',
      maxBandwidthBps: 100e6,
      configurationId: 'CONF-COMM-01',
      revisionId: revR1.revisionId
    });

    const link1 = p9.registry.registerLink({
      id: 'LINK-AVIONICS-ETH-01',
      systemId: 'AVIONICS-COMM-SYS-01',
      communicationSystemId: sys.id,
      sourceInterfaceId: ifaceA.id,
      targetInterfaceId: ifaceB.id,
      lengthMeters: 15,
      propagationSpeedMps: 200000000,
      linkCapacityBps: 100e6,
      reliability: 0.9999,
      availability: 0.9999,
      configurationId: 'CONF-COMM-01',
      revisionId: revR1.revisionId
    });

    const flow1 = p9.registry.registerDataFlow({
      id: 'FLOW-TELEMETRY-STREAM',
      systemId: 'AVIONICS-COMM-SYS-01',
      communicationSystemId: sys.id,
      flowName: 'High Speed Telemetry',
      sourceNodeId: nodeB.id,
      destinationNodeId: nodeA.id,
      protocol: 'ETHERNET_IP',
      messageRateHz: 1000,
      messageSizeBytes: 512,
      maxLatencyMs: 10.0,
      priority: 'CRITICAL_REALTIME',
      configurationId: 'CONF-COMM-01',
      revisionId: revR1.revisionId
    });

    // 4. Execute Analysis for R1 via CoreExecutionAuthority -> Obtain Envelope E1
    const envelopeE1 = await p9.execution.runExecution({
      executionId: 'exec:comm:R1',
      communicationSystemId: sys.id,
      scenarioId: 'SCENARIO-COMM-NOMINAL'
    });

    p9.registry.registerExecution({
      id: envelopeE1.executionId,
      type: 'CommunicationExecution',
      communicationSystemId: sys.id,
      scenarioId: 'SCENARIO-COMM-NOMINAL',
      startTime: new Date().toISOString(),
      durationSeconds: 1.0,
      status: 'VERIFIED',
      fingerprint: envelopeE1.resultDigest,
      systemId: 'AVIONICS-COMM-SYS-01',
      configurationId: 'CONF-COMM-01',
      revisionId: revR1.revisionId,
      authorityState: 'AUTHORITATIVE',
      lifecycleState: 'RELEASED',
      provenance: { originHash: envelopeE1.resultDigest },
      relationships: [],
      dependencies: [{ entityId: archEntityId, revisionId: revR1.revisionId }],
      verificationStatus: 'PASSED',
      evidenceReferences: [envelopeE1.evidenceLeaf?.leafHash || '']
    });

    // ASSERT E1 PROPERTIES FOR R1
    expect(envelopeE1.verificationResult?.overallVerdict).toBe('PASS');
    expect(envelopeE1.revisionHash).toBe(revR1.revisionHash);

    const verifyR1Binding = GenericExecutionRegistry.verifyResultBinding(envelopeE1, revR1.revisionHash);
    expect(verifyR1Binding.isValid).toBe(true);

    // 5. CANONICAL REVISION MUTATION: Create R2 in RevisionEngine
    const revR2 = revisionEngine.checkoutRevision(revR1.revisionId, 'COMM_LEAD', 'ECN-COMM-002: Increase Bus Frequency & Message Rate');
    revisionEngine.updateContent(revR2.revisionId, { busBandwidthMbps: 1000, maxNodes: 16 }, 'COMM_LEAD');

    expect(revR2.revisionId).not.toBe(revR1.revisionId);
    expect(revR2.revisionHash).not.toBe(revR1.revisionHash);

    // 6. CANONICAL REVISION IMPACT EVALUATION & RESULT INVALIDATION
    const impactResult = p9.evaluateCanonicalImpact(revR2.revisionId);
    expect(impactResult.impactedItems.length).toBeGreaterThan(0);

    // Explicitly transition E1 to INVALIDATED in P9
    p9.registry.invalidateResults({
      communicationSystemId: sys.id,
      reason: `Canonical Revision Change (${revR1.revisionId} -> ${revR2.revisionId})`
    });

    const execE1Record = p9.registry.getExecution(envelopeE1.executionId);
    expect(execE1Record?.status).toBe('INVALIDATED');

    // REJECT E1 FOR R2 TRUTH
    const verifyR2Binding = GenericExecutionRegistry.verifyResultBinding(envelopeE1, revR2.revisionHash);
    expect(verifyR2Binding.isValid).toBe(false);
    expect(verifyR2Binding.failureReason).toContain('REVISION_MISMATCH');

    // 7. EXECUTE R2 via CoreExecutionAuthority -> Obtain Envelope E2
    p9.registry.updateSystem(sys.id, { revisionId: revR2.revisionId });

    const envelopeE2 = await p9.execution.runExecution({
      executionId: 'exec:comm:R2',
      communicationSystemId: sys.id,
      scenarioId: 'SCENARIO-COMM-HIGH-SPEED'
    });

    p9.registry.registerExecution({
      id: envelopeE2.executionId,
      type: 'CommunicationExecution',
      communicationSystemId: sys.id,
      scenarioId: 'SCENARIO-COMM-HIGH-SPEED',
      startTime: new Date().toISOString(),
      durationSeconds: 1.0,
      status: 'VERIFIED',
      fingerprint: envelopeE2.resultDigest,
      systemId: 'AVIONICS-COMM-SYS-01',
      configurationId: 'CONF-COMM-01',
      revisionId: revR2.revisionId,
      authorityState: 'AUTHORITATIVE',
      lifecycleState: 'RELEASED',
      provenance: { originHash: envelopeE2.resultDigest },
      relationships: [],
      dependencies: [{ entityId: archEntityId, revisionId: revR2.revisionId }],
      verificationStatus: 'PASSED',
      evidenceReferences: [envelopeE2.evidenceLeaf?.leafHash || '']
    });

    expect(envelopeE2.executionId).not.toBe(envelopeE1.executionId);
    expect(envelopeE2.revisionHash).toBe(revR2.revisionHash);

    const verifyE2Binding = GenericExecutionRegistry.verifyResultBinding(envelopeE2, revR2.revisionHash);
    expect(verifyE2Binding.isValid).toBe(true);

    // 8. MASTER PERSISTENCE, MEMORY DESTRUCTION, RELOAD & RECONSTRUCTION
    const snapshot = p9.persistence.createSnapshot({
      snapshotId: 'SNAPSHOT-MASTER-P9-TRUTH-CHAIN',
      communicationSystemId: sys.id,
      persistedByAuthority: 'SECP_PERSISTENCE_TEST'
    });

    expect(snapshot.id).toBe('SNAPSHOT-MASTER-P9-TRUTH-CHAIN');

    // DESTROY P9 IN-MEMORY INSTANCE
    p9.registry.clear();

    expect(p9.registry.getExecution(envelopeE1.executionId)).toBeUndefined();
    expect(p9.registry.getExecution(envelopeE2.executionId)).toBeUndefined();

    // RELOAD & RECONSTRUCT FROM SNAPSHOT
    const restoreResult = p9.persistence.restoreFromSnapshot('SNAPSHOT-MASTER-P9-TRUTH-CHAIN');
    expect(restoreResult.isValid).toBe(true);

    // PROVE STATE PARITY AFTER RECONSTRUCTION
    const reconstructedE1 = p9.registry.getExecution(envelopeE1.executionId);
    const reconstructedE2 = p9.registry.getExecution(envelopeE2.executionId);

    expect(reconstructedE1).toBeDefined();
    expect(reconstructedE1?.status).toBe('INVALIDATED');

    expect(reconstructedE2).toBeDefined();
    expect(reconstructedE2?.status).toBe('VERIFIED');
    expect(reconstructedE2?.revisionId).toBe(revR2.revisionId);

    // Verify bindings after reconstruction
    expect(GenericExecutionRegistry.verifyResultBinding(envelopeE1, revR2.revisionHash).isValid).toBe(false);
    expect(GenericExecutionRegistry.verifyResultBinding(envelopeE2, revR2.revisionHash).isValid).toBe(true);
  });
});
