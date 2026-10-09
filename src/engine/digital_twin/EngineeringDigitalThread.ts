import { DigitalTwinGraphNode, DigitalTwinGraphEdge, TwinRelationship } from './types';
import { DigitalTwinCanonicalizer } from './DigitalTwinCanonicalizer';

export class EngineeringDigitalThread {
  private nodes: Map<string, DigitalTwinGraphNode> = new Map();
  private edges: Map<string, DigitalTwinGraphEdge> = new Map();

  public addNode(node: { id: string; type: string; label: string; hash: string; metadata?: Record<string, any> }): DigitalTwinGraphNode {
    if (this.nodes.has(node.id)) {
      throw new Error(`DUPLICATE_IDENTITY: Node with ID ${node.id} already exists`);
    }
    const graphNode: DigitalTwinGraphNode = {
      id: node.id,
      type: node.type,
      label: node.label,
      hash: node.hash,
      metadata: node.metadata || {}
    };
    this.nodes.set(node.id, graphNode);
    return graphNode;
  }

  public addEdge(edge: {
    source: string;
    target: string;
    relationship: TwinRelationship;
    evidenceId?: string;
  }): DigitalTwinGraphEdge {
    if (!this.nodes.has(edge.source)) {
      throw new Error(`INVALID_REFERENCE: Source node ${edge.source} does not exist`);
    }
    if (!this.nodes.has(edge.target)) {
      throw new Error(`INVALID_REFERENCE: Target node ${edge.target} does not exist`);
    }

    const id = `EDGE-${DigitalTwinCanonicalizer.sha256(edge.source + edge.target + edge.relationship).substring(0, 8)}`;
    const hash = DigitalTwinCanonicalizer.sha256(`${edge.source}:${edge.target}:${edge.relationship}:${edge.evidenceId || ''}`);

    const graphEdge: DigitalTwinGraphEdge = {
      id,
      source: edge.source,
      target: edge.target,
      relationship: edge.relationship,
      evidenceId: edge.evidenceId,
      hash
    };

    this.edges.set(id, graphEdge);
    return graphEdge;
  }

  public traceForward(startNodeId: string): string[] {
    const visited = new Set<string>();
    const queue = [startNodeId];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (!visited.has(current)) {
        visited.add(current);
        for (const edge of this.edges.values()) {
          if (edge.source === current && !visited.has(edge.target)) {
            queue.push(edge.target);
          }
        }
      }
    }

    return Array.from(visited);
  }

  public traceBackward(startNodeId: string): string[] {
    const visited = new Set<string>();
    const queue = [startNodeId];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (!visited.has(current)) {
        visited.add(current);
        for (const edge of this.edges.values()) {
          if (edge.target === current && !visited.has(edge.source)) {
            queue.push(edge.source);
          }
        }
      }
    }

    return Array.from(visited);
  }

  public validateGraphIntegrity(): {
    isValid: boolean;
    orphanNodes: string[];
    brokenLinks: string[];
    details: string[];
  } {
    const orphanNodes: string[] = [];
    const brokenLinks: string[] = [];
    const details: string[] = [];

    // Find orphan nodes (nodes with 0 connected edges)
    for (const nodeId of this.nodes.keys()) {
      let isConnected = false;
      for (const edge of this.edges.values()) {
        if (edge.source === nodeId || edge.target === nodeId) {
          isConnected = true;
          break;
        }
      }
      if (!isConnected && this.nodes.size > 1) {
        orphanNodes.push(nodeId);
        details.push(`ORPHAN_NODE: Node ${nodeId} has no connected digital thread edges`);
      }
    }

    // Check for broken links (edges referencing non-existent nodes)
    for (const edge of this.edges.values()) {
      if (!this.nodes.has(edge.source) || !this.nodes.has(edge.target)) {
        brokenLinks.push(edge.id);
        details.push(`BROKEN_LINK: Edge ${edge.id} points to non-existent nodes`);
      }
    }

    const isValid = orphanNodes.length === 0 && brokenLinks.length === 0;
    return {
      isValid,
      orphanNodes,
      brokenLinks,
      details
    };
  }

  public getNodes(): DigitalTwinGraphNode[] {
    return Array.from(this.nodes.values());
  }

  public getEdges(): DigitalTwinGraphEdge[] {
    return Array.from(this.edges.values());
  }
}
