// SECP Industrial OS v2 — Manufacturing Dependency Graph Engine

export type ManufacturingNodeType =
  | 'Geometry'
  | 'Feature'
  | 'Operation'
  | 'Machine'
  | 'Tool'
  | 'Fixture'
  | 'Toolpath'
  | 'NCProgram'
  | 'Execution'
  | 'Inspection'
  | 'Part';

export type ManufacturingRelationType =
  | 'DERIVED_FROM'
  | 'USES'
  | 'PRODUCES'
  | 'EXECUTES'
  | 'INSPECTS'
  | 'MODIFIES'
  | 'SUPERSEDES'
  | 'INVALIDATES';

export interface ManufacturingGraphNode {
  id: string;
  type: ManufacturingNodeType;
  label: string;
  hash: string;
  metadata: Record<string, any>;
}

export interface ManufacturingGraphEdge {
  from: string;
  to: string;
  relation: ManufacturingRelationType;
}

export class ManufacturingDependencyGraph {
  private nodes: Map<string, ManufacturingGraphNode> = new Map();
  private edges: ManufacturingGraphEdge[] = [];

  public addNode(node: ManufacturingGraphNode): void {
    this.nodes.set(node.id, node);
  }

  public addRelation(from: string, to: string, relation: ManufacturingRelationType): void {
    if (!this.nodes.has(from) || !this.nodes.has(to)) {
      throw new Error(`ManufacturingDependencyGraph: Cannot connect non-existent nodes ${from} -> ${to}`);
    }
    this.edges.push({ from, to, relation });
  }

  public getNode(id: string): ManufacturingGraphNode | undefined {
    return this.nodes.get(id);
  }

  public getEdges(): ManufacturingGraphEdge[] {
    return [...this.edges];
  }

  public validateGraphIntegrity(): { valid: boolean; anomalies: string[] } {
    const anomalies: string[] = [];

    // 1. Detect Orphan Operations
    const connectedNodes = new Set<string>();
    for (const e of this.edges) {
      connectedNodes.add(e.from);
      connectedNodes.add(e.to);
    }

    for (const [id, node] of this.nodes) {
      if (!connectedNodes.has(id)) {
        anomalies.push(`ORPHAN_MANUFACTURING_NODE: Node ${id} (${node.type}) is disconnected from the manufacturing thread`);
      }
    }

    // 2. Check for required relationships (e.g. NCProgram must link to Toolpath)
    const ncNodes = Array.from(this.nodes.values()).filter(n => n.type === 'NCProgram');
    for (const nc of ncNodes) {
      const incoming = this.edges.filter(e => e.to === nc.id);
      const hasToolpathLink = incoming.some(e => e.relation === 'PRODUCES' || e.relation === 'DERIVED_FROM');
      if (!hasToolpathLink) {
        anomalies.push(`BROKEN_DEPENDENCY: NC Program ${nc.id} has no source toolpath relationship`);
      }
    }

    return { valid: anomalies.length === 0, anomalies };
  }
}
