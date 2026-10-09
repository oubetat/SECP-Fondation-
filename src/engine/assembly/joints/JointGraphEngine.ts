/**
 * PATCH-SECP-227 — Joint Graph & Topology Engine
 * 
 * Manages the assembly kinematic graph:
 *  - Parent-Child dependency DAG
 *  - Topological sorting for kinematic forward propagation
 *  - Cycle / Loop-closure detection (e.g. 4-bar linkage, parallel robots)
 *  - Circular dependency isolation and diagnosis
 */

import { MechanicalJoint, ComponentKinematicState } from './MechanicalJointTypes';

export interface JointGraphNode {
  componentId: string;
  isGrounded: boolean;
  parentJointIds: string[];
  childJointIds: string[];
  childComponentIds: string[];
}

export interface JointGraphTopology {
  nodes: Map<string, JointGraphNode>;
  topologicalOrder: string[];
  hasCycles: boolean;
  closedLoops: string[][];
  isolatedComponents: string[];
}

export class JointGraphEngine {
  /**
   * Build complete kinematic graph topology
   */
  public static buildGraph(
    components: ComponentKinematicState[],
    joints: MechanicalJoint[]
  ): JointGraphTopology {
    const nodes = new Map<string, JointGraphNode>();

    for (const c of components) {
      nodes.set(c.componentId, {
        componentId: c.componentId,
        isGrounded: c.isGrounded,
        parentJointIds: [],
        childJointIds: [],
        childComponentIds: []
      });
    }

    // Connect nodes via active joints
    for (const j of joints) {
      if (j.isSuppressed) continue;

      const parentNode = nodes.get(j.parentComponentId);
      const childNode = nodes.get(j.childComponentId);

      if (parentNode && childNode) {
        parentNode.childJointIds.push(j.id);
        parentNode.childComponentIds.push(j.childComponentId);
        childNode.parentJointIds.push(j.id);
      }
    }

    // Detect isolated components
    const isolatedComponents: string[] = [];
    for (const [id, node] of nodes.entries()) {
      if (!node.isGrounded && node.parentJointIds.length === 0 && node.childJointIds.length === 0) {
        isolatedComponents.push(id);
      }
    }

    // Topological Sort (Kahn's Algorithm)
    const inDegree = new Map<string, number>();
    for (const [id, node] of nodes.entries()) {
      inDegree.set(id, node.parentJointIds.length);
    }

    const queue: string[] = [];
    for (const [id, deg] of inDegree.entries()) {
      if (deg === 0) {
        queue.push(id);
      }
    }

    const topologicalOrder: string[] = [];
    while (queue.length > 0) {
      const current = queue.shift()!;
      topologicalOrder.push(current);

      const node = nodes.get(current);
      if (node) {
        for (const childId of node.childComponentIds) {
          const currentDeg = inDegree.get(childId) ?? 0;
          inDegree.set(childId, currentDeg - 1);
          if (currentDeg - 1 === 0) {
            queue.push(childId);
          }
        }
      }
    }

    const hasCycles = topologicalOrder.length < components.length;
    const closedLoops: string[][] = [];

    if (hasCycles) {
      // Find looped components
      const unvisited = components.filter(c => !topologicalOrder.includes(c.componentId)).map(c => c.componentId);
      closedLoops.push(unvisited);
    }

    return {
      nodes,
      topologicalOrder,
      hasCycles,
      closedLoops,
      isolatedComponents
    };
  }
}
