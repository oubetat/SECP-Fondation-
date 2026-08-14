/**
 * PATCH-SECP-045 — Kinematic Graph & Topology Engine
 * Represents the multi-body topological assembly graph:
 *  - Nodes: Assembly Components (Ground/Root vs Free Links)
 *  - Edges: Kinematic Joints & Normalized Assembly Constraints
 *  - Root detection, connected components, dependency cycles, topological sort
 *  - Disconnected component detection & motion propagation ordering
 */

import { AssemblyComponent } from './AssemblyConstraintTypes';
import { KinematicJoint } from './KinematicTypes';

export interface GraphNode {
  instanceId: string;
  component: AssemblyComponent;
  isRoot: boolean;
  depth: number;
  visited: boolean;
}

export interface GraphEdge {
  id: string;
  sourceId: string;
  targetId: string;
  type: string;
  joint?: KinematicJoint;
}

export class KinematicGraph {
  private nodes: Map<string, GraphNode> = new Map();
  private edges: GraphEdge[] = [];
  private adjacency: Map<string, GraphEdge[]> = new Map();

  constructor(components: AssemblyComponent[] = [], joints: KinematicJoint[] = []) {
    this.build(components, joints);
  }

  /**
   * Builds the graph topology from components and joints
   */
  public build(components: AssemblyComponent[], joints: KinematicJoint[]): void {
    this.nodes.clear();
    this.edges = [];
    this.adjacency.clear();

    // 1. Add nodes
    for (const comp of components) {
      if (comp.suppressed) continue;
      this.nodes.set(comp.instanceId, {
        instanceId: comp.instanceId,
        component: comp,
        isRoot: !!comp.fixed,
        depth: comp.fixed ? 0 : -1,
        visited: false
      });
      this.adjacency.set(comp.instanceId, []);
    }

    // 2. Add edges from joints
    for (const joint of joints) {
      if (!joint.enabled) continue;
      if (this.nodes.has(joint.parentComponentId) && this.nodes.has(joint.childComponentId)) {
        const edge: GraphEdge = {
          id: joint.id,
          sourceId: joint.parentComponentId,
          targetId: joint.childComponentId,
          type: joint.type,
          joint
        };
        this.edges.push(edge);
        this.adjacency.get(joint.parentComponentId)?.push(edge);
        // Bidirectional for connected components check
      }
    }
  }

  /**
   * Finds all Root / Grounded Anchor components
   */
  public findRootComponents(): AssemblyComponent[] {
    const roots: AssemblyComponent[] = [];
    for (const node of this.nodes.values()) {
      if (node.isRoot) {
        roots.push(node.component);
      }
    }
    return roots;
  }

  /**
   * Detects cycles in the kinematic dependency tree using DFS
   */
  public detectCycles(): { hasCycle: boolean; cyclePath: string[] } {
    const visited = new Set<string>();
    const recStack = new Set<string>();
    const cyclePath: string[] = [];

    const dfs = (nodeId: string): boolean => {
      visited.add(nodeId);
      recStack.add(nodeId);

      const edges = this.adjacency.get(nodeId) || [];
      for (const edge of edges) {
        const neighbor = edge.targetId;
        if (!visited.has(neighbor)) {
          if (dfs(neighbor)) {
            cyclePath.push(nodeId);
            return true;
          }
        } else if (recStack.has(neighbor)) {
          cyclePath.push(neighbor);
          cyclePath.push(nodeId);
          return true;
        }
      }

      recStack.delete(nodeId);
      return false;
    };

    for (const nodeId of this.nodes.keys()) {
      if (!visited.has(nodeId)) {
        if (dfs(nodeId)) {
          return { hasCycle: true, cyclePath: cyclePath.reverse() };
        }
      }
    }

    return { hasCycle: false, cyclePath: [] };
  }

  /**
   * Produces a topological propagation order starting from Root anchors down to leaf components
   */
  public getPropagationOrder(): {
    order: string[];
    disconnectedNodes: string[];
    isTree: boolean;
  } {
    const order: string[] = [];
    const visited = new Set<string>();
    const roots = this.findRootComponents();

    // BFS queue starting from all roots
    const queue: string[] = roots.map(r => r.instanceId);
    for (const r of queue) visited.add(r);

    while (queue.length > 0) {
      const current = queue.shift()!;
      order.push(current);

      const edges = this.adjacency.get(current) || [];
      for (const edge of edges) {
        if (!visited.has(edge.targetId)) {
          visited.add(edge.targetId);
          queue.push(edge.targetId);
        }
      }
    }

    // Find disconnected nodes (components not reachable from any root)
    const disconnectedNodes: string[] = [];
    for (const nodeId of this.nodes.keys()) {
      if (!visited.has(nodeId)) {
        disconnectedNodes.push(nodeId);
        order.push(nodeId); // Add them to order so they are still processed
      }
    }

    const { hasCycle } = this.detectCycles();
    const isTree = !hasCycle && disconnectedNodes.length === 0;

    return {
      order,
      disconnectedNodes,
      isTree
    };
  }

  /**
   * Gets outgoing edges for a given component
   */
  public getOutgoingEdges(nodeId: string): GraphEdge[] {
    return this.adjacency.get(nodeId) || [];
  }

  /**
   * Returns all nodes count and edges count
   */
  public getMetrics(): { nodeCount: number; edgeCount: number; rootCount: number } {
    return {
      nodeCount: this.nodes.size,
      edgeCount: this.edges.length,
      rootCount: this.findRootComponents().length
    };
  }
}
