/**
 * SECP — ADSE-P4 Digital Thread Persistence Engine
 * Produces cryptographic snapshots and enables full destruction and deterministic reconstruction of the Digital Truth Thread.
 */

import { DigitalThreadRegistry } from './DigitalThreadRegistry';
import { ThreadSnapshot, DigitalThreadNode, DigitalThreadEdge } from './types';
import { createHash } from 'crypto';

export class DigitalThreadPersistenceEngine {
  private registry: DigitalThreadRegistry;
  private snapshots: Map<string, ThreadSnapshot> = new Map();

  constructor(registry: DigitalThreadRegistry) {
    this.registry = registry;
  }

  /**
   * Captures an immutable cryptographic snapshot of the current Digital Thread state.
   */
  public createSnapshot(params: {
    snapshotId?: string;
    configurationId: string;
    revisionId: string;
    persistedByAuthority: string;
  }): ThreadSnapshot {
    const nodes = this.registry.getAllNodes();
    const edges = this.registry.getAllEdges();

    const id = params.snapshotId || `SNAPSHOT-THREAD-${params.configurationId}-${Date.now()}`;
    const timestamp = new Date().toISOString();

    const payload = JSON.stringify({
      id,
      configurationId: params.configurationId,
      revisionId: params.revisionId,
      nodes,
      edges
    });

    const merkleHash = createHash('sha256').update(payload).digest('hex');
    const provenanceId = `PROV-SNAPSHOT-${merkleHash.substring(0, 12)}`;

    const snapshot: ThreadSnapshot = {
      snapshotId: id,
      configurationId: params.configurationId,
      revisionId: params.revisionId,
      timestamp,
      nodes: JSON.parse(JSON.stringify(nodes)),
      edges: JSON.parse(JSON.stringify(edges)),
      merkleHash,
      provenanceId,
      persistedByAuthority: params.persistedByAuthority
    };

    this.snapshots.set(id, snapshot);
    return snapshot;
  }

  public getSnapshot(snapshotId: string): ThreadSnapshot | undefined {
    return this.snapshots.get(snapshotId);
  }

  public getAllSnapshots(): ThreadSnapshot[] {
    return Array.from(this.snapshots.values());
  }

  /**
   * Reconstructs the Digital Thread registry from a saved snapshot.
   */
  public restoreFromSnapshot(snapshotId: string): { restoredNodesCount: number; restoredEdgesCount: number; isValid: boolean } {
    const snapshot = this.snapshots.get(snapshotId);
    if (!snapshot) {
      throw new Error(`PERSISTENCE_ERROR: Snapshot '${snapshotId}' not found.`);
    }

    // Clear existing in-memory registry
    this.registry.clear();

    for (const node of snapshot.nodes) {
      this.registry.registerNode({
        nodeId: node.nodeId,
        nodeType: node.nodeType,
        canonicalId: node.canonicalId,
        authoritySource: node.authoritySource,
        displayName: node.displayName,
        configurationId: node.configurationId,
        revisionId: node.revisionId,
        revisionHash: node.revisionHash,
        metadata: node.metadata
      });
    }

    for (const edge of snapshot.edges) {
      this.registry.registerEdge({
        edgeId: edge.edgeId,
        edgeType: edge.edgeType,
        sourceNodeId: edge.sourceNodeId,
        targetNodeId: edge.targetNodeId,
        authoritySource: edge.authoritySource,
        configurationId: edge.configurationId,
        revisionId: edge.revisionId,
        metadata: edge.metadata
      });
    }

    return {
      restoredNodesCount: snapshot.nodes.length,
      restoredEdgesCount: snapshot.edges.length,
      isValid: true
    };
  }
}
