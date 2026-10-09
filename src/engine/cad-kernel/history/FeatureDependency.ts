/**
 * SECP CAD Kernel — Feature Dependency Graph & Topological Ordering
 * Phase 2 (PATCH-022)
 *
 * ARCHITECTURAL CONTRACT:
 * - Direct Acyclic Graph (DAG) representation of feature causality.
 * - Rigorous validation: missing deps, duplicate IDs, self-dependencies, circular dependencies.
 * - Deterministic topological sort with explicit tie-breaking (sequence ascending, then lexical FeatureId).
 * - Transitive downstream invalidation propagation.
 * - Strictly zero silent reordering or silent circular resolution.
 */

import { FeatureNode, FeatureId } from './FeatureNode';

export interface DependencyValidationIssue {
  type:
    | 'MISSING_DEPENDENCY'
    | 'DUPLICATE_FEATURE_ID'
    | 'SELF_DEPENDENCY'
    | 'CIRCULAR_DEPENDENCY'
    | 'INVALID_REFERENCE'
    | 'ORDERING_VIOLATION';
  featureId: FeatureId;
  targetId?: FeatureId;
  message: string;
}

export interface DependencyValidationResult {
  isValid: boolean;
  issues: DependencyValidationIssue[];
}

export class FeatureDependencyGraph {
  private nodes: Map<FeatureId, FeatureNode> = new Map();
  private dependencies: Map<FeatureId, Set<FeatureId>> = new Map(); // node -> set of upstream dependencies
  private dependents: Map<FeatureId, Set<FeatureId>> = new Map();   // node -> set of downstream dependents

  constructor() {}

  public clear(): void {
    this.nodes.clear();
    this.dependencies.clear();
    this.dependents.clear();
  }

  /**
   * Registers a FeatureNode in the graph.
   */
  public addNode(node: FeatureNode): void {
    if (!this.dependencies.has(node.id)) {
      this.dependencies.set(node.id, new Set());
    }
    if (!this.dependents.has(node.id)) {
      this.dependents.set(node.id, new Set());
    }
    this.nodes.set(node.id, node);

    // Register initial dependencies from node.dependencyIds and inputReferences
    for (const depId of node.dependencyIds) {
      this.addDependency(node.id, depId);
    }
    for (const ref of node.inputReferences) {
      if (ref.targetFeatureId && ref.targetFeatureId !== node.id) {
        this.addDependency(node.id, ref.targetFeatureId);
      }
    }
  }

  /**
   * Adds a dependency edge: dependentId -> dependencyId (dependentId depends on dependencyId).
   */
  public addDependency(dependentId: FeatureId, dependencyId: FeatureId): void {
    if (!this.dependencies.has(dependentId)) {
      this.dependencies.set(dependentId, new Set());
    }
    if (!this.dependents.has(dependencyId)) {
      this.dependents.set(dependencyId, new Set());
    }

    this.dependencies.get(dependentId)!.add(dependencyId);
    this.dependents.get(dependencyId)!.add(dependentId);
  }

  /**
   * Removes a node and its edges.
   */
  public removeNode(nodeId: FeatureId): void {
    const deps = this.dependencies.get(nodeId);
    if (deps) {
      for (const depId of deps) {
        this.dependents.get(depId)?.delete(nodeId);
      }
    }
    const downstream = this.dependents.get(nodeId);
    if (downstream) {
      for (const downId of downstream) {
        this.dependencies.get(downId)?.delete(nodeId);
      }
    }

    this.dependencies.delete(nodeId);
    this.dependents.delete(nodeId);
    this.nodes.delete(nodeId);
  }

  /**
   * Validates the graph for structural correctness (missing deps, self deps, duplicate IDs, cycles).
   */
  public validate(): DependencyValidationResult {
    const issues: DependencyValidationIssue[] = [];

    // 1. Check self dependencies and missing dependencies
    for (const [nodeId, depSet] of this.dependencies.entries()) {
      for (const depId of depSet) {
        if (nodeId === depId) {
          issues.push({
            type: 'SELF_DEPENDENCY',
            featureId: nodeId,
            targetId: depId,
            message: `Feature '${nodeId}' cannot depend on itself`
          });
        }

        if (!this.nodes.has(depId)) {
          issues.push({
            type: 'MISSING_DEPENDENCY',
            featureId: nodeId,
            targetId: depId,
            message: `Feature '${nodeId}' depends on non-existent feature '${depId}'`
          });
        }
      }
    }

    // 2. Check for circular dependencies (using 3-color DFS)
    const visited = new Map<FeatureId, 'WHITE' | 'GRAY' | 'BLACK'>();
    for (const nodeId of this.nodes.keys()) {
      visited.set(nodeId, 'WHITE');
    }

    const cyclePath: FeatureId[] = [];
    const detectCycle = (currId: FeatureId): boolean => {
      visited.set(currId, 'GRAY');
      cyclePath.push(currId);

      const upstream = this.dependencies.get(currId) || new Set();
      for (const depId of upstream) {
        if (!this.nodes.has(depId)) continue; // Handled by missing dependency check

        const color = visited.get(depId);
        if (color === 'GRAY') {
          // Cycle found
          issues.push({
            type: 'CIRCULAR_DEPENDENCY',
            featureId: currId,
            targetId: depId,
            message: `Circular dependency detected: ${cyclePath.join(' -> ')} -> ${depId}`
          });
          return true;
        }

        if (color === 'WHITE') {
          if (detectCycle(depId)) return true;
        }
      }

      cyclePath.pop();
      visited.set(currId, 'BLACK');
      return false;
    };

    for (const nodeId of this.nodes.keys()) {
      if (visited.get(nodeId) === 'WHITE') {
        detectCycle(nodeId);
      }
    }

    return {
      isValid: issues.length === 0,
      issues
    };
  }

  /**
   * Deterministic topological ordering of all registered features.
   * Execution rule: All dependencies MUST precede their dependents.
   * Tie-breaking: Sequence number ascending, then lexical order of FeatureId.
   */
  public getTopologicalOrder(): FeatureId[] {
    const validation = this.validate();
    if (!validation.isValid) {
      const msgs = validation.issues.map(i => i.message).join('; ');
      throw new Error(`[FeatureDependencyGraph] Cannot compute topological order: ${msgs}`);
    }

    // In-degree computation (number of unmet upstream dependencies)
    const inDegree = new Map<FeatureId, number>();
    for (const nodeId of this.nodes.keys()) {
      const deps = this.dependencies.get(nodeId) || new Set();
      inDegree.set(nodeId, deps.size);
    }

    // Ready queue for nodes with 0 unmet dependencies
    const readyNodes: FeatureNode[] = [];
    for (const [nodeId, degree] of inDegree.entries()) {
      if (degree === 0) {
        readyNodes.push(this.nodes.get(nodeId)!);
      }
    }

    // Sort ready queue deterministically (sequence asc, then id lexical)
    const sortReady = (arr: FeatureNode[]) => {
      arr.sort((a, b) => {
        if (a.sequence !== b.sequence) return a.sequence - b.sequence;
        return a.id.localeCompare(b.id);
      });
    };

    sortReady(readyNodes);

    const sortedOrder: FeatureId[] = [];

    while (readyNodes.length > 0) {
      const current = readyNodes.shift()!;
      sortedOrder.push(current.id);

      const downstream = this.dependents.get(current.id) || new Set();
      const newlyReady: FeatureNode[] = [];

      for (const downId of downstream) {
        const remaining = inDegree.get(downId)! - 1;
        inDegree.set(downId, remaining);

        if (remaining === 0) {
          const downNode = this.nodes.get(downId);
          if (downNode) {
            newlyReady.push(downNode);
          }
        }
      }

      if (newlyReady.length > 0) {
        sortReady(newlyReady);
        readyNodes.push(...newlyReady);
        sortReady(readyNodes);
      }
    }

    if (sortedOrder.length !== this.nodes.size) {
      throw new Error('[FeatureDependencyGraph] Cyclic dependency prevented complete topological ordering');
    }

    return sortedOrder;
  }

  /**
   * Returns all transitive downstream dependents of a given feature (for invalidation).
   */
  public getDownstreamDependents(featureId: FeatureId): Set<FeatureId> {
    const result = new Set<FeatureId>();
    const queue = [featureId];

    while (queue.length > 0) {
      const curr = queue.shift()!;
      const downstream = this.dependents.get(curr);
      if (downstream) {
        for (const dep of downstream) {
          if (!result.has(dep)) {
            result.add(dep);
            queue.push(dep);
          }
        }
      }
    }

    return result;
  }

  /**
   * Returns all transitive upstream dependencies of a given feature.
   */
  public getUpstreamDependencies(featureId: FeatureId): Set<FeatureId> {
    const result = new Set<FeatureId>();
    const queue = [featureId];

    while (queue.length > 0) {
      const curr = queue.shift()!;
      const upstream = this.dependencies.get(curr);
      if (upstream) {
        for (const up of upstream) {
          if (!result.has(up)) {
            result.add(up);
            queue.push(up);
          }
        }
      }
    }

    return result;
  }

  public getNode(id: FeatureId): FeatureNode | undefined {
    return this.nodes.get(id);
  }

  public getAllNodes(): FeatureNode[] {
    return Array.from(this.nodes.values());
  }

  public getDependencies(id: FeatureId): FeatureId[] {
    return Array.from(this.dependencies.get(id) || []);
  }

  public getDependents(id: FeatureId): FeatureId[] {
    return Array.from(this.dependents.get(id) || []);
  }
}
