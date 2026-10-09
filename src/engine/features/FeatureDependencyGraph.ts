import { FeatureDefinition } from './FeatureTypes';
import { ParametricFeature } from './ParametricFeatureTypes';
import { generateDeterministicHashSync } from '../../lib/hash';

/**
 * PATCH-194 & PATCH-195 — Feature Dependency Graph (DAG)
 * Manages causality, ancestry, topological ordering, and cycle detection between features.
 * Ensures that changes propagate in the strict chronological and mathematical order of the history tree.
 */

export interface FeatureNode {
  id: string;
  dependencies: string[]; // Upstream features this one depends on (inputs/parents)
  dependents: string[];   // Downstream features that depend on this one (children/consumers)
}

export class FeatureDependencyGraph {
  private nodes: Map<string, FeatureNode> = new Map();

  constructor() {}

  /**
   * Builds the graph from legacy FeatureDefinition array
   */
  public build(features: FeatureDefinition[]): void {
    this.nodes.clear();

    for (const feature of features) {
      this.nodes.set(feature.featureId, {
        id: feature.featureId,
        dependencies: [],
        dependents: []
      });
    }

    for (const feature of features) {
      const node = this.nodes.get(feature.featureId)!;
      for (const ref of feature.references || []) {
        if (ref.featureId && this.nodes.has(ref.featureId)) {
          if (!node.dependencies.includes(ref.featureId)) {
            node.dependencies.push(ref.featureId);
          }
          const sourceNode = this.nodes.get(ref.featureId)!;
          if (!sourceNode.dependents.includes(feature.featureId)) {
            sourceNode.dependents.push(feature.featureId);
          }
        }
      }
    }
  }

  /**
   * Builds graph from ParametricFeature array
   */
  public buildFromParametricFeatures(features: ParametricFeature[]): void {
    this.nodes.clear();

    for (const f of features) {
      const deps: string[] = [];
      for (const d of f.dependencies || []) {
        if (!deps.includes(d)) deps.push(d);
      }
      for (const p of f.parentFeatures || []) {
        if (!deps.includes(p)) deps.push(p);
      }
      if (f.parentFeatureId && !deps.includes(f.parentFeatureId)) {
        deps.push(f.parentFeatureId);
      }
      for (const ref of f.inputReferences || []) {
        if (!deps.includes(ref)) deps.push(ref);
      }

      this.nodes.set(f.id, {
        id: f.id,
        dependencies: deps,
        dependents: []
      });
    }

    // Populate reverse downstream edges
    for (const [id, node] of this.nodes.entries()) {
      for (const depId of node.dependencies) {
        const upstreamNode = this.nodes.get(depId);
        if (upstreamNode && !upstreamNode.dependents.includes(id)) {
          upstreamNode.dependents.push(id);
        }
      }
    }
  }

  /**
   * Manually adds a dependency link (child depends on parent)
   */
  public addDependency(childId: string, parentId: string): void {
    if (!this.nodes.has(childId)) {
      this.nodes.set(childId, { id: childId, dependencies: [], dependents: [] });
    }
    if (!this.nodes.has(parentId)) {
      this.nodes.set(parentId, { id: parentId, dependencies: [], dependents: [] });
    }

    const child = this.nodes.get(childId)!;
    const parent = this.nodes.get(parentId)!;

    if (!child.dependencies.includes(parentId)) {
      child.dependencies.push(parentId);
    }
    if (!parent.dependents.includes(childId)) {
      parent.dependents.push(childId);
    }
  }

  /**
   * Removes a dependency link
   */
  public removeDependency(childId: string, parentId: string): void {
    const child = this.nodes.get(childId);
    const parent = this.nodes.get(parentId);

    if (child) {
      child.dependencies = child.dependencies.filter(id => id !== parentId);
    }
    if (parent) {
      parent.dependents = parent.dependents.filter(id => id !== childId);
    }
  }

  public getNode(featureId: string): FeatureNode | undefined {
    return this.nodes.get(featureId);
  }

  public getAllNodeIds(): string[] {
    return Array.from(this.nodes.keys());
  }

  /**
   * Direct Upstream Parents
   */
  public getParents(featureId: string): string[] {
    const node = this.nodes.get(featureId);
    return node ? [...node.dependencies] : [];
  }

  /**
   * Direct Downstream Children
   */
  public getChildren(featureId: string): string[] {
    const node = this.nodes.get(featureId);
    return node ? [...node.dependents] : [];
  }

  /**
   * Transitive Upstream Ancestors
   */
  public getAncestors(featureId: string): string[] {
    const ancestors: string[] = [];
    const visited = new Set<string>();
    const queue = [featureId];

    while (queue.length > 0) {
      const curr = queue.shift()!;
      const node = this.nodes.get(curr);
      if (node) {
        for (const parent of node.dependencies) {
          if (!visited.has(parent)) {
            visited.add(parent);
            ancestors.push(parent);
            queue.push(parent);
          }
        }
      }
    }
    return ancestors;
  }

  /**
   * Transitive Downstream Descendants
   */
  public getDescendants(featureId: string): string[] {
    const descendants: string[] = [];
    const visited = new Set<string>();
    const queue = [featureId];

    while (queue.length > 0) {
      const curr = queue.shift()!;
      const node = this.nodes.get(curr);
      if (node) {
        for (const dep of node.dependents) {
          if (!visited.has(dep)) {
            visited.add(dep);
            descendants.push(dep);
            queue.push(dep);
          }
        }
      }
    }
    return descendants;
  }

  /**
   * Returns all affected features if featureId is edited/invalidated
   */
  public getAffectedFeatures(featureId: string): string[] {
    return [featureId, ...this.getDescendants(featureId)];
  }

  /**
   * Cycle Detection using DFS 3-color graph traversal (WHITE, GRAY, BLACK)
   */
  public hasCycle(): boolean {
    return this.detectCycle() !== null;
  }

  public detectCycle(): string[] | null {
    const WHITE = 0, GRAY = 1, BLACK = 2;
    const color = new Map<string, number>();
    const parentMap = new Map<string, string | null>();

    for (const id of this.nodes.keys()) {
      color.set(id, WHITE);
    }

    const dfs = (u: string, path: string[]): string[] | null => {
      color.set(u, GRAY);
      path.push(u);

      const node = this.nodes.get(u);
      if (node) {
        for (const v of node.dependents) {
          if (color.get(v) === GRAY) {
            // Cycle found
            const cycleStartIndex = path.indexOf(v);
            return [...path.slice(cycleStartIndex), v];
          }
          if (color.get(v) === WHITE) {
            parentMap.set(v, u);
            const cycle = dfs(v, path);
            if (cycle) return cycle;
          }
        }
      }

      color.set(u, BLACK);
      path.pop();
      return null;
    };

    for (const id of this.nodes.keys()) {
      if (color.get(id) === WHITE) {
        const cycle = dfs(id, []);
        if (cycle) return cycle;
      }
    }

    return null;
  }

  /**
   * Invalidate a node and all its transitive descendants
   */
  public invalidateSubtree(featureId: string): string[] {
    const descendants = this.getDescendants(featureId);
    return [featureId, ...descendants];
  }

  /**
   * Topological Sort with Kahn's Algorithm
   */
  public getTopologicalOrder(subsetIds?: string[]): string[] {
    const activeIds = subsetIds ? new Set(subsetIds) : new Set(this.nodes.keys());
    const inDegree = new Map<string, number>();

    for (const id of activeIds) {
      inDegree.set(id, 0);
    }

    for (const id of activeIds) {
      const node = this.nodes.get(id);
      if (node) {
        for (const parentId of node.dependencies) {
          if (activeIds.has(parentId)) {
            inDegree.set(id, (inDegree.get(id) || 0) + 1);
          }
        }
      }
    }

    const queue: string[] = [];
    for (const [id, deg] of inDegree.entries()) {
      if (deg === 0) queue.push(id);
    }

    const order: string[] = [];
    while (queue.length > 0) {
      const curr = queue.shift()!;
      order.push(curr);

      const node = this.nodes.get(curr);
      if (node) {
        for (const childId of node.dependents) {
          if (activeIds.has(childId)) {
            const nextDeg = (inDegree.get(childId) || 1) - 1;
            inDegree.set(childId, nextDeg);
            if (nextDeg === 0) {
              queue.push(childId);
            }
          }
        }
      }
    }

    if (order.length < activeIds.size) {
      // If cycle exists, append unvisited to allow diagnostic handling
      for (const id of activeIds) {
        if (!order.includes(id)) order.push(id);
      }
    }

    return order;
  }

  public getRegenerationOrder(subsetIds?: string[]): string[] {
    return this.getTopologicalOrder(subsetIds);
  }

  /**
   * Validates the graph for structural integrity (cycles, etc.)
   */
  public validate(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    const cycle = this.detectCycle();
    if (cycle) {
      errors.push(`Circular dependency detected: ${cycle.join(' -> ')}`);
    }
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Deterministic Hash of graph topology
   */
  public getDeterministicHash(): string {
    const serialized = Array.from(this.nodes.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([id, node]) => ({
        id,
        dependencies: [...node.dependencies].sort(),
        dependents: [...node.dependents].sort()
      }));
    return generateDeterministicHashSync(serialized);
  }
}
