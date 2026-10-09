/**
 * SECP — ADSE-P9 Communication Persistence Engine
 * 
 * Produces cryptographic snapshots and enables complete in-memory destruction
 * and deterministic reconstruction of the Communications Integration Model.
 */

import { CommunicationRegistry } from './CommunicationRegistry';
import { CommunicationSnapshot } from './types';
import { createHash } from 'crypto';

export class CommunicationPersistenceEngine {
  private registry: CommunicationRegistry;
  private snapshots: Map<string, CommunicationSnapshot> = new Map();

  constructor(registry: CommunicationRegistry) {
    this.registry = registry;
  }

  /**
   * Captures an immutable cryptographic snapshot of the P9 Communications state
   */
  public createSnapshot(params: {
    snapshotId?: string;
    communicationSystemId: string;
    persistedByAuthority: string;
  }): CommunicationSnapshot {
    const id = params.snapshotId || `SNAP-P9-${params.communicationSystemId}-${Date.now()}`;
    const timestamp = new Date().toISOString();

    const systems = this.registry.getAllSystems().filter(s => s.id === params.communicationSystemId || s.systemId === params.communicationSystemId);
    const nodes = this.registry.getAllNodes().filter(n => n.communicationSystemId === params.communicationSystemId);
    const endpoints = this.registry.getAllEndpoints();
    const interfaces = this.registry.getAllInterfaces();
    const links = this.registry.getAllLinks().filter(l => l.communicationSystemId === params.communicationSystemId);
    const channels = this.registry.getAllChannels();
    const paths = this.registry.getAllPaths();
    const dataFlows = this.registry.getAllDataFlows().filter(f => f.communicationSystemId === params.communicationSystemId);
    const executions = this.registry.getAllExecutions().filter(e => e.communicationSystemId === params.communicationSystemId);
    const results = this.registry.getAllResults();
    const verifications = this.registry.getAllVerifications().filter(v => v.communicationSystemId === params.communicationSystemId);
    const evidences = this.registry.getAllEvidences();

    const payload = JSON.stringify({
      systems,
      nodes,
      endpoints,
      interfaces,
      links,
      channels,
      paths,
      dataFlows,
      executions,
      results,
      verifications,
      evidences
    });

    const merkleRootHash = createHash('sha256').update(payload).digest('hex');

    const snapshot: CommunicationSnapshot = {
      id,
      snapshotId: id,
      communicationSystemId: params.communicationSystemId,
      createdAt: timestamp,
      persistedByAuthority: params.persistedByAuthority,
      merkleRootHash,
      systems,
      nodes,
      endpoints,
      interfaces,
      links,
      channels,
      paths,
      dataFlows,
      executions,
      results,
      verifications,
      evidences
    };

    this.snapshots.set(id, snapshot);
    return snapshot;
  }

  /**
   * Restores and reconstructs P9 in-memory state from a cryptographic snapshot
   */
  public restoreFromSnapshot(snapshotIdOrObject: string | CommunicationSnapshot): {
    isValid: boolean;
    reconstructedSystemId?: string;
    error?: string;
  } {
    const snapshot = typeof snapshotIdOrObject === 'string'
      ? this.snapshots.get(snapshotIdOrObject)
      : snapshotIdOrObject;

    if (!snapshot) {
      return { isValid: false, error: `Snapshot not found.` };
    }

    // Verify Merkle Root integrity before restoring
    const payload = JSON.stringify({
      systems: snapshot.systems,
      nodes: snapshot.nodes,
      endpoints: snapshot.endpoints,
      interfaces: snapshot.interfaces,
      links: snapshot.links,
      channels: snapshot.channels,
      paths: snapshot.paths,
      dataFlows: snapshot.dataFlows,
      executions: snapshot.executions,
      results: snapshot.results,
      verifications: snapshot.verifications,
      evidences: snapshot.evidences
    });

    const computedHash = createHash('sha256').update(payload).digest('hex');
    if (computedHash !== snapshot.merkleRootHash) {
      return { isValid: false, error: 'SNAPSHOT_CORRUPTED: Merkle root hash mismatch.' };
    }

    // Clear local registry before reconstruction
    this.registry.clear();

    // Reconstruct entities
    for (const sys of snapshot.systems) {
      this.registry.registerSystem({
        id: sys.id,
        systemId: sys.systemId,
        p3ArchitectureId: sys.p3ArchitectureId,
        p4NodeId: sys.p4NodeId,
        displayName: sys.displayName,
        configurationId: sys.configurationId,
        revisionId: sys.revisionId,
        p5StructuralContextId: sys.p5StructuralContextId,
        p6ThermalContextId: sys.p6ThermalContextId,
        p7PowerContextId: sys.p7PowerContextId,
        p8ControlContextId: sys.p8ControlContextId,
        authorityState: sys.authorityState,
        lifecycleState: sys.lifecycleState,
        provenance: sys.provenance
      });
    }

    for (const node of snapshot.nodes) {
      this.registry.registerNode({
        id: node.id,
        systemId: node.systemId,
        communicationSystemId: node.communicationSystemId,
        p3ComponentId: node.p3ComponentId,
        p4NodeId: node.p4NodeId,
        p5StructuralId: node.p5StructuralId,
        p6ThermalContextId: node.p6ThermalContextId,
        p7PowerLoadId: node.p7PowerLoadId,
        nodeName: node.nodeName,
        processingDelayMs: node.processingDelayMs,
        bufferCapacityBytes: node.bufferCapacityBytes,
        configurationId: node.configurationId,
        revisionId: node.revisionId
      });
    }

    for (const ep of snapshot.endpoints) {
      this.registry.registerEndpoint({
        id: ep.id,
        systemId: ep.systemId,
        nodeId: ep.nodeId,
        endpointName: ep.endpointName,
        ipAddressOrId: ep.ipAddressOrId,
        supportedProtocols: ep.supportedProtocols,
        configurationId: ep.configurationId,
        revisionId: ep.revisionId
      });
    }

    for (const iface of snapshot.interfaces) {
      this.registry.registerInterface({
        id: iface.id,
        systemId: iface.systemId,
        nodeId: iface.nodeId,
        p5PhysicalInterfaceId: iface.p5PhysicalInterfaceId,
        interfaceName: iface.interfaceName,
        mediumType: iface.mediumType,
        maxBandwidthBps: iface.maxBandwidthBps,
        configurationId: iface.configurationId,
        revisionId: iface.revisionId
      });
    }

    for (const link of snapshot.links) {
      this.registry.registerLink({
        id: link.id,
        systemId: link.systemId,
        communicationSystemId: link.communicationSystemId,
        sourceInterfaceId: link.sourceInterfaceId,
        targetInterfaceId: link.targetInterfaceId,
        lengthMeters: link.lengthMeters,
        propagationSpeedMps: link.propagationSpeedMps,
        linkCapacityBps: link.linkCapacityBps,
        bitErrorRate: link.bitErrorRate,
        reliability: link.reliability,
        availability: link.availability,
        configurationId: link.configurationId,
        revisionId: link.revisionId
      });
    }

    for (const flow of snapshot.dataFlows) {
      this.registry.registerDataFlow({
        id: flow.id,
        systemId: flow.systemId,
        communicationSystemId: flow.communicationSystemId,
        p2MbseFlowId: flow.p2MbseFlowId,
        p8ControlSignalId: flow.p8ControlSignalId,
        flowName: flow.flowName,
        sourceNodeId: flow.sourceNodeId,
        destinationNodeId: flow.destinationNodeId,
        protocol: flow.protocol,
        messageRateHz: flow.messageRateHz,
        messageSizeBytes: flow.messageSizeBytes,
        maxLatencyMs: flow.maxLatencyMs,
        priority: flow.priority,
        configurationId: flow.configurationId,
        revisionId: flow.revisionId
      });
    }

    for (const ex of snapshot.executions) {
      this.registry.registerExecution(ex);
    }

    for (const res of snapshot.results) {
      this.registry.registerResult(res);
    }

    for (const ver of snapshot.verifications) {
      this.registry.registerVerification(ver);
    }

    for (const ev of snapshot.evidences) {
      this.registry.registerEvidence(ev);
    }

    return {
      isValid: true,
      reconstructedSystemId: snapshot.communicationSystemId
    };
  }

  public getSnapshot(snapshotId: string) {
    return this.snapshots.get(snapshotId);
  }
}
