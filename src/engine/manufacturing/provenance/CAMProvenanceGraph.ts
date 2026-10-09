/**
 * SECP Industrial OS v2 — CAM Provenance Graph Engine
 * Manages Artifact Nodes, Dependency Edges, Traces, and Orphan Detection
 */

import { 
  ProvenanceNode, 
  ProvenanceEdge, 
  CAMArtifactType, 
  ProvenanceEdgeType, 
  ArtifactLifecycleStatus, 
  ProvenanceGapType,
  ProvenanceVerdict
} from "./types";

export class CAMProvenanceGraphEngine {
  private nodes: Map<string, ProvenanceNode> = new Map();
  private edges: ProvenanceEdge[] = [];

  public addNode(node: ProvenanceNode): void {
    this.nodes.set(node.identity.artifactId, node);
  }

  public getNode(artifactId: string): ProvenanceNode | undefined {
    return this.nodes.get(artifactId);
  }

  public getAllNodes(): ProvenanceNode[] {
    return Array.from(this.nodes.values());
  }

  public addEdge(edge: ProvenanceEdge): void {
    this.edges.push(edge);
  }

  public getAllEdges(): ProvenanceEdge[] {
    return [...this.edges];
  }

  /**
   * Detects orphan nodes (published artifacts that are neither root nor have valid incoming/outgoing parent edges)
   */
  public detectOrphans(): { orphanArtifactIds: string[]; details: string[] } {
    const orphanArtifactIds: string[] = [];
    const details: string[] = [];

    for (const [id, node] of this.nodes.entries()) {
      if (node.isRoot) continue; // Root is allowed to have no parents

      // Incoming edges (target is this node, source is parent)
      const parentEdges = this.edges.filter(e => e.targetArtifactId === id);
      if (parentEdges.length === 0) {
        orphanArtifactIds.push(id);
        details.push(`Artifact ${id} (${node.identity.artifactType}) has no parent derivation link.`);
        node.status = ArtifactLifecycleStatus.STALE_DERIVATIVE; // Or flag as non-trusted
      }
    }

    return { orphanArtifactIds, details };
  }

  /**
   * Backward Trace: Trace back from a downstream artifact (e.g. NC Program or Execution) to Root (CAD)
   * Traverses all parent edges (DAG ancestor search)
   */
  public traceBackward(artifactId: string): { path: string[]; artifactTypes: CAMArtifactType[] } {
    const pathSet = new Set<string>();
    const artifactTypesSet = new Set<CAMArtifactType>();

    const queue: string[] = [artifactId];
    const visited = new Set<string>([artifactId]);

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      pathSet.add(currentId);

      const node = this.nodes.get(currentId);
      if (node) {
        artifactTypesSet.add(node.identity.artifactType);
      }

      // Find all parent edges where target = currentId
      const parentEdges = this.edges.filter(e => e.targetArtifactId === currentId);
      for (const parentEdge of parentEdges) {
        if (!visited.has(parentEdge.sourceArtifactId)) {
          visited.add(parentEdge.sourceArtifactId);
          queue.push(parentEdge.sourceArtifactId);
        }
      }
    }

    return { 
      path: Array.from(pathSet), 
      artifactTypes: Array.from(artifactTypesSet) 
    };
  }

  /**
   * Forward Trace: Trace forward from Root (CAD) to downstream artifacts
   */
  public traceForward(rootArtifactId: string): { reachableArtifactIds: string[]; leafArtifactIds: string[] } {
    const reachable = new Set<string>([rootArtifactId]);
    const leaf = new Set<string>();

    let queue = [rootArtifactId];
    while (queue.length > 0) {
      const curr = queue.shift()!;
      const childEdges = this.edges.filter(e => e.sourceArtifactId === curr);

      if (childEdges.length === 0) {
        leaf.add(curr);
      } else {
        for (const edge of childEdges) {
          if (!reachable.has(edge.targetArtifactId)) {
            reachable.add(edge.targetArtifactId);
            queue.push(edge.targetArtifactId);
          }
        }
      }
    }

    return {
      reachableArtifactIds: Array.from(reachable),
      leafArtifactIds: Array.from(leaf)
    };
  }

  /**
   * Calculates Lineage Completeness & Gaps against full digital thread chain
   * Required Chain: CAD -> FEATURE -> MATERIAL -> OPERATION -> TOOL -> MACHINE -> TOOLPATH -> SIMULATION -> POST -> NC -> VERIFICATION -> TWIN -> EXECUTION
   */
  public calculateCompleteness(targetArtifactId: string): {
    completenessRatio: number;
    missingGaps: ProvenanceGapType[];
    details: string[];
  } {
    const trace = this.traceBackward(targetArtifactId);
    const typesPresent = new Set(trace.artifactTypes);

    const requiredTypes: { type: CAMArtifactType; gap: ProvenanceGapType }[] = [
      { type: CAMArtifactType.CAD_MODEL, gap: ProvenanceGapType.MISSING_PARENT },
      { type: CAMArtifactType.MANUFACTURING_FEATURE, gap: ProvenanceGapType.MISSING_PARENT },
      { type: CAMArtifactType.MATERIAL, gap: ProvenanceGapType.MISSING_MATERIAL },
      { type: CAMArtifactType.CAM_OPERATION, gap: ProvenanceGapType.MISSING_PARENT },
      { type: CAMArtifactType.TOOL, gap: ProvenanceGapType.MISSING_TOOL },
      { type: CAMArtifactType.MACHINE, gap: ProvenanceGapType.MISSING_MACHINE },
      { type: CAMArtifactType.TOOLPATH, gap: ProvenanceGapType.MISSING_PARENT },
      { type: CAMArtifactType.SIMULATION, gap: ProvenanceGapType.MISSING_SIMULATION },
      { type: CAMArtifactType.POST_PROCESSOR, gap: ProvenanceGapType.MISSING_PARENT },
      { type: CAMArtifactType.NC_PROGRAM, gap: ProvenanceGapType.MISSING_PARENT },
      { type: CAMArtifactType.GCODE_VERIFICATION, gap: ProvenanceGapType.MISSING_VERIFICATION },
      { type: CAMArtifactType.DIGITAL_TWIN_STATE, gap: ProvenanceGapType.MISSING_EXECUTION }
    ];

    const missingGaps: ProvenanceGapType[] = [];
    const details: string[] = [];

    let countPresent = 0;
    for (const req of requiredTypes) {
      if (typesPresent.has(req.type)) {
        countPresent++;
      } else {
        missingGaps.push(req.gap);
        details.push(`Lineage missing artifact type: ${req.type}`);
      }
    }

    const completenessRatio = countPresent / requiredTypes.length;
    return { completenessRatio, missingGaps, details };
  }

  /**
   * Graph Export
   */
  public exportGraph(): {
    nodesCount: number;
    edgesCount: number;
    nodes: any[];
    edges: any[];
  } {
    return {
      nodesCount: this.nodes.size,
      edgesCount: this.edges.length,
      nodes: Array.from(this.nodes.values()).map(n => ({
        id: n.identity.artifactId,
        type: n.identity.artifactType,
        revision: n.revision.revisionNumber,
        contentHash: n.contentHash,
        status: n.status,
        agent: n.agent.agentType
      })),
      edges: this.edges.map(e => ({
        source: e.sourceArtifactId,
        target: e.targetArtifactId,
        type: e.type,
        timestamp: e.timestamp
      }))
    };
  }
}
