import { 
  BOMGraphData, 
  BOMForensicSnapshot,
  BOMItemType,
  QuantityBasis,
  UnitOfMeasure,
  BOMEdgeType,
  SourcingType,
  BOMLifecycleState
} from './types';
import { BOMValidator } from './BOMValidator';
import { BOMCanonicalizer } from './BOMCanonicalizer';
import { BOMRollupEngine } from './BOMRollupEngine';
import { BOMDependencyGraph } from './BOMDependencyGraph';

export class BOMGraphEngine {
  public static createSnapshot(bom: BOMGraphData): BOMForensicSnapshot {
    const errors = BOMValidator.validate(bom);
    if (errors.length > 0) {
      throw new Error(`BOM validation failed: ${errors.join(', ')}`);
    }

    const canonical = BOMCanonicalizer.canonicalize(bom);
    const hash = BOMCanonicalizer.computeHash(bom);

    return {
      bomId: bom.bomId,
      bomRevision: bom.bomRevision,
      assemblyRevision: bom.nodes.length > 0 ? bom.nodes[0].assemblyRevision : '1.0',
      configurationId: bom.configurationId,
      graphHash: 'MOCK_ASSEMBLY_GRAPH_HASH', // Link to PATCH-113
      bomHash: hash,
      dependencyHash: hash, // Simplified for demonstration
      nodeCount: bom.nodes.length,
      edgeCount: bom.edges.length,
      timestamp: new Date().toISOString(),
      validatorVersion: '1.0.0',
      canonicalizerVersion: '1.0.0'
    };
  }

  public static explode(bom: BOMGraphData, nodeId: string): BOMGraphData {
    // Generate an exploded single-level or multi-level view from a node
    // Simple implementation for testing
    const dependencies = BOMDependencyGraph.whereUsed(nodeId, bom);
    // In reality this would traverse downwards. Let's do a simple downward traversal.
    const childrenSet = new Set<string>();
    childrenSet.add(nodeId);
    
    const adj = new Map<string, string[]>();
    for (const edge of bom.edges) {
      if (!adj.has(edge.parentNodeId)) adj.set(edge.parentNodeId, []);
      adj.get(edge.parentNodeId)!.push(edge.childNodeId);
    }

    const queue = [nodeId];
    while(queue.length > 0) {
      const current = queue.shift()!;
      const children = adj.get(current) || [];
      for (const child of children) {
        if (!childrenSet.has(child)) {
          childrenSet.add(child);
          queue.push(child);
        }
      }
    }

    const explodedNodes = bom.nodes.filter(n => childrenSet.has(n.bomNodeId));
    const explodedEdges = bom.edges.filter(e => childrenSet.has(e.parentNodeId) && childrenSet.has(e.childNodeId));

    return {
      ...bom,
      nodes: explodedNodes,
      edges: explodedEdges
    };
  }
}
