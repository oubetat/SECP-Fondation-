import { TwinEvidenceNode, TwinEvidenceEdge, TwinEvidenceGraph, EvidenceNodeType, EvidenceEdgeType } from './types';
import { EvidenceCanonicalizer } from './EvidenceCanonicalizer';

export class TwinEvidenceGraphEngine {
  public graph: TwinEvidenceGraph;

  constructor(twinId: string) {
    this.graph = {
      graphId: `GRAPH-${twinId}`,
      twinId,
      nodes: new Map(),
      edges: new Map(),
      graphVersion: 1,
      rootHash: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  public addNode(nodeId: string, nodeType: EvidenceNodeType, entityId: string, entityVersion: string, source: string, validFrom: string, attributes: Record<string, any> = {}, autoUpdateRoot = true): TwinEvidenceNode {
    const nodeData: Partial<TwinEvidenceNode> = { nodeType, entityId, entityVersion, source, validFrom, attributes };
    const contentHash = EvidenceCanonicalizer.computeNodeHash(nodeData);
    
    const node: TwinEvidenceNode = {
      nodeId,
      nodeType,
      entityId,
      entityVersion,
      source,
      contentHash,
      createdAt: new Date().toISOString(),
      validFrom,
      status: 'ACTIVE',
      attributes
    };

    this.graph.nodes.set(nodeId, node);
    if (autoUpdateRoot) this.updateRootHash();
    return node;
  }

  public addEdge(edgeId: string, fromNodeId: string, toNodeId: string, edgeType: EvidenceEdgeType, createdAt: string = new Date().toISOString(), autoUpdateRoot = true): TwinEvidenceEdge {
    const edgeData: Partial<TwinEvidenceEdge> = { fromNodeId, toNodeId, edgeType, createdAt };
    const contentHash = EvidenceCanonicalizer.computeEdgeHash(edgeData);
    
    const edge: TwinEvidenceEdge = {
      edgeId,
      fromNodeId,
      toNodeId,
      edgeType,
      createdAt,
      contentHash,
      status: 'ACTIVE'
    };

    this.graph.edges.set(edgeId, edge);
    if (autoUpdateRoot) this.updateRootHash();
    return edge;
  }

  public updateRootHash() {
    this.graph.rootHash = EvidenceCanonicalizer.computeGraphRootHash(this.graph.nodes, this.graph.edges);
    this.graph.updatedAt = new Date().toISOString();
    this.graph.graphVersion++;
  }
}
