/**
 * SECP Industrial OS v2 — Phase 1: Engineering Truth Core
 * PATCH-013: Provenance Graph Data Structure
 */

import {
  ProvenanceNode,
  ProvenanceEdge,
  ProvenanceNodeType,
  ProvenanceEdgeType,
  ProvenanceImpactResult
} from './ProvenanceGraphTypes';
import {
  DuplicateNodeError,
  MissingNodeError,
  InvalidSelfLoopError,
  InvalidNodeError,
  InvalidEdgeError
} from './ProvenanceGraphErrors';
import { ProvenanceGraphSerializer } from './ProvenanceGraphSerializer';

export class ProvenanceGraph {
  private readonly nodesMap: Map<string, ProvenanceNode> = new Map();
  private readonly edgesMap: Map<string, ProvenanceEdge> = new Map();

  // Adjacency lists for fast traversal
  private readonly childrenAdjacency: Map<string, Set<string>> = new Map(); // fromNodeId -> edgeIds
  private readonly parentsAdjacency: Map<string, Set<string>> = new Map();  // toNodeId -> edgeIds

  constructor(
    initialNodes: readonly ProvenanceNode[] = [],
    initialEdges: readonly ProvenanceEdge[] = []
  ) {
    for (const node of initialNodes) {
      this.addNodeInternal(node);
    }
    for (const edge of initialEdges) {
      this.addEdgeInternal(edge);
    }
  }

  public addNode(node: ProvenanceNode): void {
    this.addNodeInternal(node);
  }

  public addEdge(edge: ProvenanceEdge): void {
    this.addEdgeInternal(edge);
  }

  /**
   * Internal helper to register a node with invariant validation
   */
  private addNodeInternal(node: ProvenanceNode): void {
    if (!node.id || !node.engineeringIdentityId || !node.canonicalHash) {
      throw new InvalidNodeError('Node missing required identity fields (id, engineeringIdentityId, canonicalHash)');
    }

    // A. No duplicate node by id or canonical identity
    if (this.nodesMap.has(node.id)) {
      throw new DuplicateNodeError(node.id);
    }

    // Check if canonical engineering identity + canonicalHash already registered
    for (const existing of Array.from(this.nodesMap.values())) {
      if (
        existing.engineeringIdentityId === node.engineeringIdentityId &&
        existing.canonicalHash === node.canonicalHash &&
        existing.version === node.version &&
        existing.type === node.type
      ) {
        throw new DuplicateNodeError(
          `Node with same engineering identity '${node.engineeringIdentityId}' and hash '${node.canonicalHash}' already exists as '${existing.id}'`
        );
      }
    }

    this.nodesMap.set(node.id, Object.freeze({ ...node }));
    this.childrenAdjacency.set(node.id, new Set());
    this.parentsAdjacency.set(node.id, new Set());
  }

  /**
   * Internal helper to register an edge with invariant validation
   */
  private addEdgeInternal(edge: ProvenanceEdge): void {
    if (!edge.id || !edge.fromNodeId || !edge.toNodeId || !edge.type) {
      throw new InvalidEdgeError('Edge missing required fields (id, fromNodeId, toNodeId, type)');
    }

    // B. Cannot create edge targeting non-existent node
    if (!this.nodesMap.has(edge.fromNodeId)) {
      throw new MissingNodeError(edge.fromNodeId);
    }
    if (!this.nodesMap.has(edge.toNodeId)) {
      throw new MissingNodeError(edge.toNodeId);
    }

    // C. Self-loop check (fromNodeId == toNodeId allowed only for explicit allowed types if any)
    if (edge.fromNodeId === edge.toNodeId) {
      // Allow self loop only if type is explicitly REVISION_OF or similar if spec permitted,
      // but standard SECP invariants forbid self-loops unless declared
      throw new InvalidSelfLoopError(edge.fromNodeId, edge.type);
    }

    // Store edge
    this.edgesMap.set(edge.id, Object.freeze({ ...edge }));
    this.childrenAdjacency.get(edge.fromNodeId)!.add(edge.id);
    this.parentsAdjacency.get(edge.toNodeId)!.add(edge.id);
  }

  /**
   * Public getters
   */
  public getNodes(): ProvenanceNode[] {
    return ProvenanceGraphSerializer.sortNodes(Array.from(this.nodesMap.values()));
  }

  public getEdges(): ProvenanceEdge[] {
    return ProvenanceGraphSerializer.sortEdges(Array.from(this.edgesMap.values()));
  }

  public getNode(nodeId: string): ProvenanceNode | undefined {
    return this.nodesMap.get(nodeId);
  }

  public getEdge(edgeId: string): ProvenanceEdge | undefined {
    return this.edgesMap.get(edgeId);
  }

  public hasNode(nodeId: string): boolean {
    return this.nodesMap.has(nodeId);
  }

  public hasEdge(edgeId: string): boolean {
    return this.edgesMap.has(edgeId);
  }

  public get nodeCount(): number {
    return this.nodesMap.size;
  }

  public get edgeCount(): number {
    return this.edgesMap.size;
  }

  /**
   * Compute deterministic Graph Canonical Hash
   */
  public getGraphHash(): string {
    return ProvenanceGraphSerializer.calculateGraphHash(this.getNodes(), this.getEdges());
  }

  /**
   * Direct parents (nodes that point TO nodeId via edges)
   */
  public getDirectParents(nodeId: string): ProvenanceNode[] {
    if (!this.nodesMap.has(nodeId)) throw new MissingNodeError(nodeId);
    const edgeIds = this.parentsAdjacency.get(nodeId) || new Set();
    const parents: ProvenanceNode[] = [];
    for (const edgeId of Array.from(edgeIds)) {
      const edge = this.edgesMap.get(edgeId)!;
      parents.push(this.nodesMap.get(edge.fromNodeId)!);
    }
    return ProvenanceGraphSerializer.sortNodes(parents);
  }

  /**
   * Direct children (nodes that nodeId points TO via edges)
   */
  public getDirectChildren(nodeId: string): ProvenanceNode[] {
    if (!this.nodesMap.has(nodeId)) throw new MissingNodeError(nodeId);
    const edgeIds = this.childrenAdjacency.get(nodeId) || new Set();
    const children: ProvenanceNode[] = [];
    for (const edgeId of Array.from(edgeIds)) {
      const edge = this.edgesMap.get(edgeId)!;
      children.push(this.nodesMap.get(edge.toNodeId)!);
    }
    return ProvenanceGraphSerializer.sortNodes(children);
  }

  /**
   * Ancestors traversal (all upstream nodes reachable by traversing backward to parents)
   */
  public getAncestors(nodeId: string): ProvenanceNode[] {
    if (!this.nodesMap.has(nodeId)) throw new MissingNodeError(nodeId);
    const visited = new Set<string>();
    const queue: string[] = [nodeId];

    while (queue.length > 0) {
      const curr = queue.shift()!;
      const parentEdges = this.parentsAdjacency.get(curr) || new Set();
      for (const edgeId of Array.from(parentEdges)) {
        const edge = this.edgesMap.get(edgeId)!;
        if (!visited.has(edge.fromNodeId) && edge.fromNodeId !== nodeId) {
          visited.add(edge.fromNodeId);
          queue.push(edge.fromNodeId);
        }
      }
    }

    const ancestors = Array.from(visited).map(id => this.nodesMap.get(id)!);
    return ProvenanceGraphSerializer.sortNodes(ancestors);
  }

  /**
   * Descendants traversal (all downstream nodes reachable by traversing forward to children)
   */
  public getDescendants(nodeId: string): ProvenanceNode[] {
    if (!this.nodesMap.has(nodeId)) throw new MissingNodeError(nodeId);
    const visited = new Set<string>();
    const queue: string[] = [nodeId];

    while (queue.length > 0) {
      const curr = queue.shift()!;
      const childEdges = this.childrenAdjacency.get(curr) || new Set();
      for (const edgeId of Array.from(childEdges)) {
        const edge = this.edgesMap.get(edgeId)!;
        if (!visited.has(edge.toNodeId) && edge.toNodeId !== nodeId) {
          visited.add(edge.toNodeId);
          queue.push(edge.toNodeId);
        }
      }
    }

    const descendants = Array.from(visited).map(id => this.nodesMap.get(id)!);
    return ProvenanceGraphSerializer.sortNodes(descendants);
  }

  /**
   * Full lineage chain for a node (ancestors + direct node + descendants)
   */
  public getLineage(nodeId: string): {
    node: ProvenanceNode;
    ancestors: ProvenanceNode[];
    descendants: ProvenanceNode[];
  } {
    const node = this.nodesMap.get(nodeId);
    if (!node) throw new MissingNodeError(nodeId);
    return {
      node,
      ancestors: this.getAncestors(nodeId),
      descendants: this.getDescendants(nodeId)
    };
  }

  /**
   * Impact analysis: determine all downstream nodes and edges affected if nodeId changes
   */
  public getImpactSet(nodeId: string): ProvenanceImpactResult {
    if (!this.nodesMap.has(nodeId)) throw new MissingNodeError(nodeId);

    const affectedNodeIds = new Set<string>();
    const affectedEdgeIds = new Set<string>();
    const queue: string[] = [nodeId];

    while (queue.length > 0) {
      const curr = queue.shift()!;
      const childEdges = this.childrenAdjacency.get(curr) || new Set();
      for (const edgeId of Array.from(childEdges)) {
        const edge = this.edgesMap.get(edgeId)!;
        affectedEdgeIds.add(edge.id);
        if (!affectedNodeIds.has(edge.toNodeId) && edge.toNodeId !== nodeId) {
          affectedNodeIds.add(edge.toNodeId);
          queue.push(edge.toNodeId);
        }
      }
    }

    const affectedNodeList = Array.from(affectedNodeIds).sort();
    const affectedEdgeList = Array.from(affectedEdgeIds).sort();

    return {
      rootNodeId: nodeId,
      affectedNodeIds: affectedNodeList,
      affectedEdgeIds: affectedEdgeList,
      staleCandidates: affectedNodeList,
      status: affectedNodeList.length > 0 ? 'PASS' : 'UNPROVEN'
    };
  }
}
