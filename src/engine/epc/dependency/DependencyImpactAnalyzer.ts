/**
 * SECP Industrial OS — EPC-007: CAD / CAE / CAM Dependency Impact Analyzer
 */

import { 
  DependencyGraph, 
  ImpactAnalysisResult, 
  DependencyEdgeType 
} from './EngineeringDependencyTypes';

export class DependencyImpactAnalyzer {
  /**
   * Calculates deterministic impact of a node change.
   */
  public analyze(changedNodeId: string, graph: DependencyGraph): ImpactAnalysisResult {
    const directImpacts = new Set<string>();
    const indirectImpacts = new Set<string>();
    const staleArtifacts = new Set<string>();
    const brokenArtifacts = new Set<string>();
    const requiresRegeneration = new Set<string>();
    const requiresReverification = new Set<string>();

    const queue: string[] = [changedNodeId];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (visited.has(currentId)) continue;
      visited.add(currentId);

      // Find nodes that depend on the current node (downstream)
      // Note: in our graph, if A -> B, A is the source (dependent) and B is the target (dependency)
      // So if B changes, we look for edges where targetNodeId === B
      const downstreamEdges = graph.edges.filter(e => e.targetNodeId === currentId);

      for (const edge of downstreamEdges) {
        const dependentId = edge.sourceNodeId;
        
        if (currentId === changedNodeId) {
          directImpacts.add(dependentId);
        } else {
          indirectImpacts.add(dependentId);
        }

        staleArtifacts.add(dependentId);

        // Analyze edge type for specific impact
        switch (edge.dependencyType) {
          case DependencyEdgeType.GEOMETRY_DEPENDENCY:
          case DependencyEdgeType.MESH_DEPENDENCY:
            requiresRegeneration.add(dependentId);
            break;
          case DependencyEdgeType.MATERIAL_DEPENDENCY:
          case DependencyEdgeType.SIMULATION_DEPENDENCY:
          case DependencyEdgeType.REVISION_DEPENDENCY:
            requiresReverification.add(dependentId);
            break;
          case DependencyEdgeType.MANUFACTURING_DEPENDENCY:
            requiresRegeneration.add(dependentId); // G-Code regeneration
            break;
        }

        queue.push(dependentId);
      }
    }

    return {
      directImpacts: Array.from(directImpacts).sort(),
      indirectImpacts: Array.from(indirectImpacts).sort(),
      staleArtifacts: Array.from(staleArtifacts).sort(),
      brokenArtifacts: Array.from(brokenArtifacts).sort(),
      requiresRegeneration: Array.from(requiresRegeneration).sort(),
      requiresReverification: Array.from(requiresReverification).sort()
    };
  }

  /**
   * Gets the complete dependency chain for a node.
   */
  public getDependencyChain(nodeId: string, graph: DependencyGraph): string[] {
    const chain: string[] = [nodeId];
    let current = nodeId;

    // Upstream traversal (Simplified: follows first path)
    while (true) {
      const upstream = graph.edges.find(e => e.sourceNodeId === current);
      if (!upstream) break;
      chain.push(upstream.targetNodeId);
      current = upstream.targetNodeId;
    }

    return chain;
  }
}
