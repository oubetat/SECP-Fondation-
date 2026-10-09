import * as crypto from 'crypto';
import { TwinEvidenceNode, TwinEvidenceEdge, TwinEvidenceGraph } from './types';

export class EvidenceCanonicalizer {
  public static sha256(data: string): string {
    return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
  }

  public static computeNodeHash(node: Partial<TwinEvidenceNode>): string {
    const attrStr = node.attributes ? Object.keys(node.attributes).sort().map(k => `${k}:${node.attributes![k]}`).join(',') : '';
    return this.sha256([
      node.nodeType,
      node.entityId,
      node.entityVersion,
      node.source,
      node.validFrom,
      attrStr
    ].join('|'));
  }

  public static computeEdgeHash(edge: Partial<TwinEvidenceEdge>): string {
    return this.sha256([
      edge.fromNodeId,
      edge.toNodeId,
      edge.edgeType,
      edge.createdAt
    ].join('|'));
  }

  public static computeGraphRootHash(nodes: Map<string, TwinEvidenceNode>, edges: Map<string, TwinEvidenceEdge>): string {
    const nodeHashes = Array.from(nodes.values()).map(n => n.contentHash).sort();
    const edgeHashes = Array.from(edges.values()).map(e => e.contentHash).sort();
    return this.sha256(['GRAPH_ROOT', ...nodeHashes, ...edgeHashes].join('|'));
  }
}
