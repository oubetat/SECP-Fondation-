import { GeometryDependencyNode } from './types';

export class GeometryDependencyReasoner {
  private nodes: Map<string, GeometryDependencyNode> = new Map();

  public addNode(node: GeometryDependencyNode): void {
    this.nodes.set(node.nodeId, node);
  }

  public getImpactedNodes(sourceRefId: string): {
    impactedNodes: GeometryDependencyNode[];
    affectedSimulations: string[];
    affectedCAM: string[];
    affectedInspections: string[];
    affectedAssemblies: string[];
  } {
    const impacted: GeometryDependencyNode[] = [];
    const queue: string[] = [];

    // Find all nodes that depend directly on sourceRefId
    for (const [id, node] of Array.from(this.nodes.entries())) {
      if (node.refId === sourceRefId || node.dependsOn.includes(sourceRefId)) {
        queue.push(id);
      }
    }

    const visited = new Set<string>();

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (visited.has(currentId)) continue;
      visited.add(currentId);

      const currentNode = this.nodes.get(currentId);
      if (currentNode) {
        impacted.push(currentNode);

        // Find downstream dependents
        for (const [id, node] of Array.from(this.nodes.entries())) {
          if (node.dependsOn.includes(currentNode.refId) || node.dependsOn.includes(currentNode.nodeId)) {
            if (!visited.has(id)) {
              queue.push(id);
            }
          }
        }
      }
    }

    const affectedSimulations = impacted.filter((n) => n.nodeType === 'SIMULATION').map((n) => n.refId);
    const affectedCAM = impacted.filter((n) => n.nodeType === 'CAM').map((n) => n.refId);
    const affectedInspections = impacted.filter((n) => n.nodeType === 'INSPECTION').map((n) => n.refId);
    const affectedAssemblies = impacted.filter((n) => n.nodeType === 'ASSEMBLY').map((n) => n.refId);

    return {
      impactedNodes: impacted,
      affectedSimulations,
      affectedCAM,
      affectedInspections,
      affectedAssemblies
    };
  }
}
