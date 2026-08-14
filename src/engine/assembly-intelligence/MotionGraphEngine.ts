/**
 * PATCH-SECP-072: Motion Graph Engine
 * Resolves mechanical linkages (crank-rod-piston) and gear-shaft configurations.
 */

import { MotionGraph, MotionGraphNode, MotionGraphEdge, AssemblyStructure } from './AssemblyTopologyTypes';

export class MotionGraphEngine {
  public static buildGraph(assembly: AssemblyStructure): MotionGraph {
    const nodes: Record<string, MotionGraphNode> = {};
    const edges: MotionGraphEdge[] = [];

    // Instantiate nodes for each component in the assembly
    Object.keys(assembly.instances).forEach((instId, idx) => {
      nodes[instId] = {
        instanceId: instId,
        type: idx === 0 ? 'SOURCE' : 'LINK',
        speed: 0,
        position: 0
      };
    });

    // Translate Gear and Joint relations to graph transmission edges
    assembly.mates.forEach(mate => {
      if (mate.type === 'GEAR') {
        edges.push({
          sourceInstanceId: mate.primaryInstanceId,
          targetInstanceId: mate.secondaryInstanceId,
          transferType: 'GEAR',
          ratio: mate.value || 1.0
        });
      }
    });

    assembly.joints.forEach(joint => {
      if (joint.type === 'REVOLUTE' || joint.type === 'PRISMATIC') {
        edges.push({
          sourceInstanceId: joint.parentInstanceId,
          targetInstanceId: joint.childInstanceId,
          transferType: 'LINKAGE',
          ratio: 1.0
        });
      }
    });

    return { nodes, edges };
  }

  public static propagateMotion(
    graph: MotionGraph,
    sourceInstanceId: string,
    angularVelocity: number
  ): MotionGraph {
    const updatedNodes = { ...graph.nodes };

    if (updatedNodes[sourceInstanceId]) {
      updatedNodes[sourceInstanceId] = {
        ...updatedNodes[sourceInstanceId],
        type: 'SOURCE',
        speed: angularVelocity
      };
    }

    // Traverse the edges and propagate velocity values deterministically
    graph.edges.forEach(edge => {
      if (edge.sourceInstanceId === sourceInstanceId) {
        const target = updatedNodes[edge.targetInstanceId];
        if (target) {
          let drivenSpeed = angularVelocity;
          if (edge.transferType === 'GEAR') {
            drivenSpeed = angularVelocity * (edge.ratio || 1.0) * -1; // opposite direction
          } else if (edge.transferType === 'LINKAGE') {
            drivenSpeed = angularVelocity * 0.5; // linkage attenuation simulation
          }

          updatedNodes[edge.targetInstanceId] = {
            ...target,
            speed: drivenSpeed,
            position: target.position + drivenSpeed * 0.1
          };
        }
      }
    });

    return {
      ...graph,
      nodes: updatedNodes
    };
  }
}
