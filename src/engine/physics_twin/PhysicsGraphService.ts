// SECP Industrial OS v2 — Physics Graph & Dependency Tracking

export type PhysicsNodeType =
  | 'Geometry'
  | 'Material'
  | 'PhysicsModel'
  | 'BoundaryCondition'
  | 'Load'
  | 'Constraint'
  | 'Mesh'
  | 'Solver'
  | 'TimeState'
  | 'Result'
  | 'Verification'
  | 'Validation'
  | 'Evidence';

export type PhysicsRelationType =
  | 'USES_GEOMETRY'
  | 'USES_MATERIAL'
  | 'USES_MODEL'
  | 'HAS_BOUNDARY'
  | 'HAS_LOAD'
  | 'HAS_CONSTRAINT'
  | 'DISCRETIZED_BY'
  | 'SOLVED_BY'
  | 'PRODUCES_RESULT'
  | 'VERIFIED_BY'
  | 'VALIDATED_BY'
  | 'EVIDENCED_BY'
  | 'DERIVED_FROM'
  | 'SUPERSEDES';

export interface PhysicsNode {
  id: string;
  type: PhysicsNodeType;
  label: string;
  hash: string;
  metadata: Record<string, any>;
}

export interface PhysicsEdge {
  from: string;
  to: string;
  relation: PhysicsRelationType;
}

export class PhysicsGraphService {
  private nodes: Map<string, PhysicsNode> = new Map();
  private edges: PhysicsEdge[] = [];

  public addNode(node: PhysicsNode): void {
    this.nodes.set(node.id, node);
  }

  public addRelation(from: string, to: string, relation: PhysicsRelationType): void {
    if (!this.nodes.has(from) || !this.nodes.has(to)) {
      throw new Error(`PhysicsGraph Error: Cannot connect non-existent nodes ${from} -> ${to}`);
    }
    this.edges.push({ from, to, relation });
  }

  public getNode(id: string): PhysicsNode | undefined {
    return this.nodes.get(id);
  }

  public getEdges(): PhysicsEdge[] {
    return [...this.edges];
  }

  public validateGraphIntegrity(): { valid: boolean; anomalies: string[] } {
    const anomalies: string[] = [];

    // 1. Detect Orphan Nodes
    const connectedNodes = new Set<string>();
    for (const e of this.edges) {
      connectedNodes.add(e.from);
      connectedNodes.add(e.to);
    }

    for (const [id, node] of this.nodes) {
      if (!connectedNodes.has(id)) {
        anomalies.push(`ORPHAN_PHYSICS_NODE: Node ${id} (${node.type}) is disconnected from the physics graph`);
      }
    }

    // 2. Check for required relationships (e.g. Result must link to Solver, Model, Geometry)
    const resultNodes = Array.from(this.nodes.values()).filter(n => n.type === 'Result');
    for (const r of resultNodes) {
      const incoming = this.edges.filter(e => e.to === r.id);
      const hasSolverLink = incoming.some(e => e.relation === 'PRODUCES_RESULT');
      if (!hasSolverLink) {
        anomalies.push(`BROKEN_PHYSICS_LINK: Result node ${r.id} has no producing solver edge`);
      }
    }

    return {
      valid: anomalies.length === 0,
      anomalies
    };
  }
}
