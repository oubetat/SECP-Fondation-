import { AssemblyComponent, AssemblyConstraint, KinematicJoint } from './AssemblyConstraintTypes';

/**
 * PATCH-SECP-046-A — Constraint Dependency Graph
 * Manages relationships and causality between components, constraints, and joints.
 * Responsible for detecting cyclic dependencies, dangling references, and identifying affected subgraphs.
 */
export interface DependencyNode {
  id: string;
  type: 'COMPONENT' | 'CONSTRAINT' | 'JOINT';
  dependencies: string[]; // IDs this node depends on
  dependents: string[];   // IDs that depend on this node
}

export class ConstraintDependencyGraph {
  private nodes: Map<string, DependencyNode> = new Map();

  constructor() {}

  /**
   * Builds the graph from assembly elements
   */
  public build(
    components: AssemblyComponent[],
    constraints: AssemblyConstraint[],
    joints: KinematicJoint[]
  ): void {
    this.nodes.clear();

    // 1. Initialize Component Nodes
    for (const comp of components) {
      this.nodes.set(comp.instanceId, {
        id: comp.instanceId,
        type: 'COMPONENT',
        dependencies: [],
        dependents: []
      });
    }

    // 2. Initialize Constraint Nodes & Connect to Components
    for (const constraint of constraints) {
      const node: DependencyNode = {
        id: constraint.constraintId,
        type: 'CONSTRAINT',
        dependencies: [constraint.componentA, constraint.componentB],
        dependents: []
      };
      this.nodes.set(constraint.constraintId, node);

      // Add back-references to components
      this.addDependent(constraint.componentA, constraint.constraintId);
      this.addDependent(constraint.componentB, constraint.constraintId);

      // 046-A causality: The constraint also affects the components it connects
      this.addDependent(constraint.constraintId, constraint.componentA);
      this.addDependent(constraint.constraintId, constraint.componentB);
    }

    // 3. Initialize Joint Nodes & Connect to Components
    for (const joint of joints) {
      const node: DependencyNode = {
        id: joint.jointId,
        type: 'JOINT',
        dependencies: [joint.parentComponentId, joint.childComponentId],
        dependents: []
      };
      this.nodes.set(joint.jointId, node);

      // Add back-references to components
      this.addDependent(joint.parentComponentId, joint.jointId);
      this.addDependent(joint.childComponentId, joint.jointId);

      // 046-A causality: The joint also affects the components
      this.addDependent(joint.jointId, joint.parentComponentId);
      this.addDependent(joint.jointId, joint.childComponentId);
    }
  }

  private addDependent(nodeId: string, dependentId: string): void {
    const node = this.nodes.get(nodeId);
    if (node && !node.dependents.includes(dependentId)) {
      node.dependents.push(dependentId);
    }
  }

  /**
   * Identifies the subgraph of elements affected by a change to a specific set of IDs.
   * Useful for Incremental Solve.
   */
  public getAffectedSubgraph(changedIds: string[]): string[] {
    const affected = new Set<string>();
    const stack = [...changedIds];

    while (stack.length > 0) {
      const currentId = stack.pop()!;
      if (affected.has(currentId)) continue;

      affected.add(currentId);
      const node = this.nodes.get(currentId);
      if (node) {
        // Any node that depends on this one is also affected
        for (const dependentId of node.dependents) {
          stack.push(dependentId);
        }
        
        // Special case: if a component moves, all its joints and constraints move
        // already handled by dependents.
      }
    }

    return Array.from(affected);
  }

  /**
   * Validates the graph for structural issues
   */
  public validate(): {
    isValid: boolean;
    issues: { type: 'CYCLIC' | 'DANGLING' | 'ORPHAN'; id: string; message: string }[];
  } {
    const issues: { type: 'CYCLIC' | 'DANGLING' | 'ORPHAN'; id: string; message: string }[] = [];

    // Check for Dangling References
    for (const node of this.nodes.values()) {
      for (const depId of node.dependencies) {
        if (!this.nodes.has(depId)) {
          issues.push({
            type: 'DANGLING',
            id: node.id,
            message: `Node ${node.id} (${node.type}) depends on missing ID ${depId}`
          });
        }
      }
    }

    // Check for Cycles (only relevant for causality, though kinematic loops are physically possible)
    // In parametric logic, cycles in causality can be problematic.
    const visited = new Set<string>();
    const recStack = new Set<string>();

    const hasCycle = (id: string): boolean => {
      if (recStack.has(id)) return true;
      if (visited.has(id)) return false;

      visited.add(id);
      recStack.add(id);

      const node = this.nodes.get(id);
      if (node) {
        for (const depId of node.dependents) {
          if (hasCycle(depId)) return true;
        }
      }

      recStack.delete(id);
      return false;
    };

    for (const id of this.nodes.keys()) {
      if (!visited.has(id)) {
        if (hasCycle(id)) {
          issues.push({
            type: 'CYCLIC',
            id,
            message: `Cyclic dependency detected involving ${id}`
          });
          // We only report the first cycle found per start node to avoid spam
        }
      }
    }

    return {
      isValid: issues.length === 0,
      issues
    };
  }

  public getNode(id: string): DependencyNode | undefined {
    return this.nodes.get(id);
  }
}
