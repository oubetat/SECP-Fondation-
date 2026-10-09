export type PhysicsNodeType =
  | 'VARIABLE'
  | 'EQUATION'
  | 'PARAMETER'
  | 'FIELD'
  | 'BOUNDARY_CONDITION'
  | 'INITIAL_CONDITION'
  | 'MATERIAL'
  | 'DOMAIN'
  | 'SOLVER'
  | 'MEASUREMENT'
  | 'OBSERVATION'
  | 'CONSTRAINT';

export type PhysicsRelationType =
  | 'DEPENDS_ON'
  | 'GOVERNS'
  | 'CONSTRAINS'
  | 'DERIVED_FROM'
  | 'MEASURED_BY'
  | 'SOLVED_BY'
  | 'COUPLED_TO'
  | 'CONSERVES'
  | 'VIOLATES'
  | 'CALIBRATED_BY'
  | 'VALIDATED_BY';

export interface PhysicsGraphNode {
  nodeId: string;
  nodeType: PhysicsNodeType;
  label: string;
  metadata: Record<string, any>;
}

export interface PhysicsGraphEdge {
  edgeId: string;
  relationType: PhysicsRelationType;
  sourceNodeId: string;
  targetNodeId: string;
  metadata?: Record<string, any>;
}

export class EngineeringPhysicsGraph {
  public nodes: Map<string, PhysicsGraphNode> = new Map();
  public edges: PhysicsGraphEdge[] = [];

  public addNode(node: PhysicsGraphNode): void {
    this.nodes.set(node.nodeId, node);
  }

  public addEdge(edge: PhysicsGraphEdge): void {
    this.edges.push(edge);
  }

  public getNode(nodeId: string): PhysicsGraphNode | undefined {
    return this.nodes.get(nodeId);
  }

  public getNodesByType(type: PhysicsNodeType): PhysicsGraphNode[] {
    return Array.from(this.nodes.values()).filter((n) => n.nodeType === type);
  }

  public getDownstreamDependents(sourceId: string): PhysicsGraphNode[] {
    const visited = new Set<string>();
    const queue = [sourceId];
    const dependents: PhysicsGraphNode[] = [];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);

      const matchingEdges = this.edges.filter((e) => e.targetNodeId === current || e.sourceNodeId === current);
      for (const edge of matchingEdges) {
        const otherId = edge.sourceNodeId === current ? edge.targetNodeId : edge.sourceNodeId;
        if (!visited.has(otherId)) {
          queue.push(otherId);
          const n = this.nodes.get(otherId);
          if (n) dependents.push(n);
        }
      }
    }

    return dependents;
  }

  public clear(): void {
    this.nodes.clear();
    this.edges = [];
  }
}
