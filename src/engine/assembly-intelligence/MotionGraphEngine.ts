import { AssemblyStructure, MotionGraph, MotionGraphNode, MotionGraphEdge } from './AssemblyTopologyTypes';

export class MotionGraphEngine {
  public static buildGraph(assembly: AssemblyStructure): MotionGraph {
    const nodes: Record<string, MotionGraphNode> = {};
    const edges: MotionGraphEdge[] = [];

    Object.keys(assembly.instances).forEach((instanceId, idx) => {
      nodes[instanceId] = {
        instanceId,
        type: idx === 0 ? 'SOURCE' : 'LINK',
        speed: 0,
        position: 0
      };
    });

    assembly.joints.forEach(joint => {
      edges.push({
        sourceInstanceId: joint.parentInstanceId,
        targetInstanceId: joint.childInstanceId,
        transferType: 'SLIDER_CRANK'
      });
    });

    return { nodes, edges };
  }

  public static propagateMotion(graph: MotionGraph, sourceInstanceId: string, speed: number): MotionGraph {
    const nodes = { ...graph.nodes };
    
    // Set source node speed
    if (nodes[sourceInstanceId]) {
      nodes[sourceInstanceId] = {
        ...nodes[sourceInstanceId],
        speed
      };
    }

    // Propagate speed to linked nodes
    graph.edges.forEach(edge => {
      if (edge.sourceInstanceId === sourceInstanceId && nodes[edge.targetInstanceId]) {
        nodes[edge.targetInstanceId] = {
          ...nodes[edge.targetInstanceId],
          speed: speed * 0.5 // Slider crank speed conversion factor
        };
      }
    });

    return {
      ...graph,
      nodes
    };
  }
}
