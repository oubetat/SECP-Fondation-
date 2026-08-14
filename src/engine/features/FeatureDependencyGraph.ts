import { FeatureDefinition } from './FeatureTypes';

/**
 * PATCH-SECP-047-B — Feature Dependency Graph
 * Manages causality and ordering between modeling features.
 * Ensures that changes propagate in the correct chronological order of the history tree.
 */

export interface FeatureNode {
  id: string;
  dependencies: string[]; // Features this one depends on (inputs)
  dependents: string[];   // Features that depend on this one (downstream)
}

export class FeatureDependencyGraph {
  private nodes: Map<string, FeatureNode> = new Map();

  constructor() {}

  /**
   * Builds the graph from design history features
   */
  public build(features: FeatureDefinition[]): void {
    this.nodes.clear();

    // 1. Initialize Nodes
    for (const feature of features) {
      this.nodes.set(feature.featureId, {
        id: feature.featureId,
        dependencies: [],
        dependents: []
      });
    }

    // 2. Establish Dependencies from References
    for (const feature of features) {
      const node = this.nodes.get(feature.featureId)!;
      
      // A feature depends on all features mentioned in its references
      for (const ref of feature.references) {
        if (ref.featureId && this.nodes.has(ref.featureId)) {
          if (!node.dependencies.includes(ref.featureId)) {
            node.dependencies.push(ref.featureId);
          }
          
          // Add back-reference to the source feature
          const sourceNode = this.nodes.get(ref.featureId)!;
          if (!sourceNode.dependents.includes(feature.featureId)) {
            sourceNode.dependents.push(feature.featureId);
          }
        }
      }
    }
  }

  /**
   * Returns a topologically sorted list of features affected by a change.
   * Ensures that regeneration happens in the correct order.
   */
  public getRegenerationOrder(changedFeatureIds: string[]): string[] {
    const affected = new Set<string>();
    const stack = [...changedFeatureIds];

    // Collect all downstream features
    while (stack.length > 0) {
      const currentId = stack.pop()!;
      if (affected.has(currentId)) continue;

      affected.add(currentId);
      const node = this.nodes.get(currentId);
      if (node) {
        for (const dependentId of node.dependents) {
          stack.push(dependentId);
        }
      }
    }

    // Topological sort of the affected set
    const result: string[] = [];
    const visited = new Set<string>();
    const temp = new Set<string>();

    const visit = (id: string) => {
      if (temp.has(id)) throw new Error(`Cyclic dependency detected at feature ${id}`);
      if (!visited.has(id)) {
        temp.add(id);
        const node = this.nodes.get(id);
        if (node) {
          for (const depId of node.dependencies) {
            if (affected.has(depId)) {
              visit(depId);
            }
          }
        }
        visited.add(id);
        temp.delete(id);
        result.push(id);
      }
    };

    for (const id of affected) {
      if (!visited.has(id)) {
        visit(id);
      }
    }

    return result;
  }

  /**
   * Validates the graph for structural integrity
   */
  public validate(): { isValid: boolean; issues: string[] } {
    const issues: string[] = [];
    
    // Check for cycles
    try {
      const allIds = Array.from(this.nodes.keys());
      this.getRegenerationOrder(allIds);
    } catch (e: any) {
      issues.push(e.message);
    }

    return {
      isValid: issues.length === 0,
      issues
    };
  }

  public getNode(id: string): FeatureNode | undefined {
    return this.nodes.get(id);
  }
}
