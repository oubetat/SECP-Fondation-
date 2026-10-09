/**
 * SECP — ADSE-P4 Digital Thread Registry
 * Authoritative node and edge registry for the Digital Truth Thread.
 * Strictly guarantees that every node links back to a genuine canonical authority.
 */

import { 
  DigitalThreadNode, 
  DigitalThreadEdge, 
  ThreadNodeType, 
  ThreadEdgeType, 
  ThreadAuthoritySource,
  ThreadQuery
} from './types';
import { RevisionEngine } from '../../revision/RevisionEngine';
import { createHash } from 'crypto';

export class DigitalThreadRegistry {
  private nodes: Map<string, DigitalThreadNode> = new Map();
  private edges: Map<string, DigitalThreadEdge> = new Map();
  private revisionEngine: RevisionEngine;

  constructor(revisionEngine: RevisionEngine) {
    this.revisionEngine = revisionEngine;
  }

  public registerNode(params: {
    nodeId?: string;
    nodeType: ThreadNodeType;
    canonicalId: string;
    authoritySource: ThreadAuthoritySource;
    displayName: string;
    configurationId: string;
    revisionId?: string;
    revisionHash?: string;
    metadata?: Record<string, any>;
  }): DigitalThreadNode {
    const id = params.nodeId || `thread:node:${params.nodeType}:${params.canonicalId}`;
    
    if (this.nodes.has(id)) {
      throw new Error(`THREAD_REGISTRY_ERROR: Node '${id}' already exists.`);
    }

    const activeRev = this.revisionEngine.getLatestRevision(params.canonicalId);
    const revisionId = params.revisionId || activeRev?.revisionId || `REV-THREAD-${params.canonicalId}`;
    const revisionHash = params.revisionHash || activeRev?.revisionHash || createHash('sha256').update(params.canonicalId + revisionId).digest('hex');
    const provenanceId = `PROV-THREAD-NODE-${createHash('sha256').update(id + revisionId).digest('hex').substring(0, 12)}`;

    const node: DigitalThreadNode = {
      nodeId: id,
      nodeType: params.nodeType,
      canonicalId: params.canonicalId,
      authoritySource: params.authoritySource,
      displayName: params.displayName,
      configurationId: params.configurationId,
      revisionId,
      revisionHash,
      provenanceId,
      coreBindingState: 'BOUND_CANONICAL',
      metadata: params.metadata || {},
      createdAt: new Date().toISOString()
    };

    this.nodes.set(id, node);
    return node;
  }

  public getNode(nodeId: string): DigitalThreadNode | undefined {
    return this.nodes.get(nodeId);
  }

  public getNodeByCanonicalId(canonicalId: string, configurationId?: string): DigitalThreadNode | undefined {
    for (const node of this.nodes.values()) {
      if (node.canonicalId === canonicalId) {
        if (!configurationId || node.configurationId === configurationId) {
          return node;
        }
      }
    }
    return undefined;
  }

  public getAllNodes(): DigitalThreadNode[] {
    return Array.from(this.nodes.values());
  }

  public registerEdge(params: {
    edgeId?: string;
    edgeType: ThreadEdgeType;
    sourceNodeId: string;
    targetNodeId: string;
    authoritySource: ThreadAuthoritySource;
    configurationId: string;
    revisionId?: string;
    metadata?: Record<string, any>;
  }): DigitalThreadEdge {
    const sourceNode = this.nodes.get(params.sourceNodeId);
    const targetNode = this.nodes.get(params.targetNodeId);

    if (!sourceNode) {
      throw new Error(`THREAD_REGISTRY_ERROR: Source node '${params.sourceNodeId}' does not exist.`);
    }
    if (!targetNode) {
      throw new Error(`THREAD_REGISTRY_ERROR: Target node '${params.targetNodeId}' does not exist.`);
    }

    const id = params.edgeId || `thread:edge:${params.edgeType}:${params.sourceNodeId}->${params.targetNodeId}`;
    if (this.edges.has(id)) {
      throw new Error(`THREAD_REGISTRY_ERROR: Edge '${id}' already exists.`);
    }

    const revisionId = params.revisionId || sourceNode.revisionId;
    const provenanceId = `PROV-THREAD-EDGE-${createHash('sha256').update(id + revisionId).digest('hex').substring(0, 12)}`;

    const edge: DigitalThreadEdge = {
      edgeId: id,
      edgeType: params.edgeType,
      sourceNodeId: params.sourceNodeId,
      targetNodeId: params.targetNodeId,
      authoritySource: params.authoritySource,
      configurationId: params.configurationId,
      revisionId,
      provenanceId,
      isVerified: true,
      metadata: params.metadata || {},
      createdAt: new Date().toISOString()
    };

    this.edges.set(id, edge);
    return edge;
  }

  public getEdge(edgeId: string): DigitalThreadEdge | undefined {
    return this.edges.get(edgeId);
  }

  public getAllEdges(): DigitalThreadEdge[] {
    return Array.from(this.edges.values());
  }

  public getEdgesForNode(nodeId: string): { outgoing: DigitalThreadEdge[]; incoming: DigitalThreadEdge[] } {
    const outgoing: DigitalThreadEdge[] = [];
    const incoming: DigitalThreadEdge[] = [];

    for (const edge of this.edges.values()) {
      if (edge.sourceNodeId === nodeId) outgoing.push(edge);
      if (edge.targetNodeId === nodeId) incoming.push(edge);
    }

    return { outgoing, incoming };
  }

  public queryNodes(query: ThreadQuery): DigitalThreadNode[] {
    return Array.from(this.nodes.values()).filter(node => {
      if (query.canonicalId && node.canonicalId !== query.canonicalId) return false;
      if (query.nodeType && node.nodeType !== query.nodeType) return false;
      if (query.configurationId && node.configurationId !== query.configurationId) return false;
      if (query.revisionId && node.revisionId !== query.revisionId) return false;
      if (query.authoritySource && node.authoritySource !== query.authoritySource) return false;
      return true;
    });
  }

  public clear(): void {
    this.nodes.clear();
    this.edges.clear();
  }
}
