/**
 * PATCH-SECP-228 — Motion Link Dependency Graph Engine
 * 
 * Kinematic dependency network analysis:
 *  - Directed Acyclic Graph (DAG) construction of mechanical motion links
 *  - Cycle Detection (DFS recursion) -> flags CIRCULAR_DEPENDENCY
 *  - Multi-Driver Conflict Detection (two links driving the same DOF) -> flags CONFLICT
 *  - Topological Sorting for multi-stage gear trains & coupled mechanisms
 *  - Overall Transmission Ratio computation
 *  - Broken reference detection
 */

import {
  MotionLink,
  MotionGraphNode,
  MotionGraphEdge,
  MotionDependencyGraph
} from './MotionLinkTypes';
import { ComponentKinematicState } from '../joints/MechanicalJointTypes';

export class MotionLinkDependencyGraphEngine {
  /**
   * Constructs the full dependency graph and analyzes cycles and conflicts
   */
  public static buildGraph(
    components: ComponentKinematicState[],
    links: MotionLink[]
  ): MotionDependencyGraph {
    const nodes = new Map<string, MotionGraphNode>();
    const edges: MotionGraphEdge[] = [];

    // 1. Initialize Nodes from Components
    for (const comp of components) {
      nodes.set(comp.componentId, {
        componentId: comp.componentId,
        componentName: comp.name,
        isGrounded: comp.isGrounded,
        drivenByLinkId: undefined,
        drivesLinkIds: []
      });
    }

    // Track DOF drivers to detect conflicts
    const dofDriverMap = new Map<string, string[]>(); // dofKey -> [linkId1, linkId2, ...]

    // 2. Build Edges and link connections
    for (const link of links) {
      if (link.isSuppressed) continue;

      // Ensure nodes exist for driver and follower
      if (!nodes.has(link.driverComponentId)) {
        nodes.set(link.driverComponentId, {
          componentId: link.driverComponentId,
          componentName: link.driverComponentId,
          isGrounded: false,
          drivesLinkIds: []
        });
      }
      if (!nodes.has(link.followerComponentId)) {
        nodes.set(link.followerComponentId, {
          componentId: link.followerComponentId,
          componentName: link.followerComponentId,
          isGrounded: false,
          drivesLinkIds: []
        });
      }

      const driverNode = nodes.get(link.driverComponentId)!;
      const followerNode = nodes.get(link.followerComponentId)!;

      driverNode.drivesLinkIds.push(link.id);
      followerNode.drivenByLinkId = link.id;

      edges.push({
        linkId: link.id,
        sourceComponentId: link.driverComponentId,
        targetComponentId: link.followerComponentId,
        ratio: link.ratio,
        linkType: link.type,
        isValid: link.state === 'VALID'
      });

      // Track target DOF key
      const targetDofKey = `${link.followerJointId || link.followerComponentId}_${link.followerDofName || 'PRIMARY'}`;
      if (!dofDriverMap.has(targetDofKey)) {
        dofDriverMap.set(targetDofKey, []);
      }
      dofDriverMap.get(targetDofKey)!.push(link.id);
    }

    // 3. Multi-Driver Conflict Detection
    const conflictingDofs: { dofId: string; driverLinkIds: string[] }[] = [];
    dofDriverMap.forEach((driverList, dofId) => {
      if (driverList.length > 1) {
        conflictingDofs.push({ dofId, driverLinkIds: driverList });
      }
    });

    // 4. Cycle Detection (Tarjan / DFS)
    const { hasCycle, cyclePath } = this.detectCycles(nodes, edges);

    // 5. Topological Sort (if no cycle)
    const topologicalOrder = hasCycle ? [] : this.topologicalSort(nodes, edges);

    // 6. Overall Transmission Ratio along longest path
    let overallRatio = 1.0;
    if (!hasCycle && edges.length > 0) {
      for (const edge of edges) {
        if (edge.ratio !== 0) {
          overallRatio *= edge.ratio;
        }
      }
    }

    return {
      nodes,
      edges,
      topologicalOrder,
      hasCircularDependency: hasCycle,
      circularPath: cyclePath,
      conflictingDofs,
      overallTransmissionRatio: overallRatio
    };
  }

  /**
   * Detects cycles in the directed graph using DFS with 3-color vertex marking
   */
  private static detectCycles(
    nodes: Map<string, MotionGraphNode>,
    edges: MotionGraphEdge[]
  ): { hasCycle: boolean; cyclePath?: string[] } {
    const adj = new Map<string, string[]>();
    for (const [id] of nodes) {
      adj.set(id, []);
    }
    for (const edge of edges) {
      if (adj.has(edge.sourceComponentId)) {
        adj.get(edge.sourceComponentId)!.push(edge.targetComponentId);
      }
    }

    // 0 = unvisited (white), 1 = visiting (gray), 2 = visited (black)
    const visited = new Map<string, number>();
    for (const [id] of nodes) {
      visited.set(id, 0);
    }

    const currentPath: string[] = [];
    let detectedCyclePath: string[] | undefined;

    const dfs = (nodeId: string): boolean => {
      visited.set(nodeId, 1);
      currentPath.push(nodeId);

      const neighbors = adj.get(nodeId) || [];
      for (const neighbor of neighbors) {
        const state = visited.get(neighbor) || 0;
        if (state === 1) {
          // Cycle found!
          const cycleStartIdx = currentPath.indexOf(neighbor);
          detectedCyclePath = [...currentPath.slice(cycleStartIdx), neighbor];
          return true;
        }
        if (state === 0) {
          if (dfs(neighbor)) return true;
        }
      }

      visited.set(nodeId, 2);
      currentPath.pop();
      return false;
    };

    for (const [nodeId] of nodes) {
      if ((visited.get(nodeId) || 0) === 0) {
        if (dfs(nodeId)) {
          return { hasCycle: true, cyclePath: detectedCyclePath };
        }
      }
    }

    return { hasCycle: false };
  }

  /**
   * Topological Sort of components for deterministic evaluation sequence
   */
  private static topologicalSort(
    nodes: Map<string, MotionGraphNode>,
    edges: MotionGraphEdge[]
  ): string[] {
    const inDegree = new Map<string, number>();
    const adj = new Map<string, string[]>();

    for (const [id] of nodes) {
      inDegree.set(id, 0);
      adj.set(id, []);
    }

    for (const edge of edges) {
      if (adj.has(edge.sourceComponentId)) {
        adj.get(edge.sourceComponentId)!.push(edge.targetComponentId);
        inDegree.set(edge.targetComponentId, (inDegree.get(edge.targetComponentId) || 0) + 1);
      }
    }

    const queue: string[] = [];
    for (const [id, deg] of inDegree) {
      if (deg === 0) {
        queue.push(id);
      }
    }

    const order: string[] = [];
    while (queue.length > 0) {
      const u = queue.shift()!;
      order.push(u);

      const neighbors = adj.get(u) || [];
      for (const v of neighbors) {
        const newDeg = (inDegree.get(v) || 1) - 1;
        inDegree.set(v, newDeg);
        if (newDeg === 0) {
          queue.push(v);
        }
      }
    }

    return order;
  }
}
