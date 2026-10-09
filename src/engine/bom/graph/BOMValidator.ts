import { BOMGraphData, BOMEdgeType } from './types';

export class BOMValidator {
  public static validate(bom: BOMGraphData): string[] {
    const errors: string[] = [];
    const nodeIds = new Set(bom.nodes.map(n => n.bomNodeId));

    // Check duplicates
    if (nodeIds.size !== bom.nodes.length) {
      errors.push('DUPLICATE_NODE');
    }

    // Check for quantity issues
    for (const node of bom.nodes) {
      if (typeof node.quantity !== 'number' || isNaN(node.quantity)) {
        errors.push(`INVALID_QUANTITY: ${node.bomNodeId}`);
      } else if (node.quantity < 0) {
        errors.push(`NEGATIVE_QUANTITY: ${node.bomNodeId}`);
      } else if (!isFinite(node.quantity)) {
        errors.push(`INFINITY_QUANTITY: ${node.bomNodeId}`);
      }

      if (node.parentBomNodeId && !nodeIds.has(node.parentBomNodeId)) {
        errors.push(`INVALID_PARENT_REFERENCE: ${node.bomNodeId}`);
      }
    }

    // Check edge references
    for (const edge of bom.edges) {
      if (!nodeIds.has(edge.parentNodeId)) {
        errors.push(`INVALID_EDGE_PARENT: ${edge.edgeId}`);
      }
      if (!nodeIds.has(edge.childNodeId)) {
        errors.push(`INVALID_EDGE_CHILD: ${edge.edgeId}`);
      }
    }

    // Check cycles
    if (this.detectCycles(bom)) {
      errors.push('BOM_CYCLE');
    }

    return errors;
  }

  private static detectCycles(bom: BOMGraphData): boolean {
    const adj = new Map<string, string[]>();
    for (const edge of bom.edges) {
      if (edge.edgeType === BOMEdgeType.REQUIRES || edge.edgeType === BOMEdgeType.CONTAINS || edge.edgeType === BOMEdgeType.ASSEMBLES) {
        if (!adj.has(edge.parentNodeId)) adj.set(edge.parentNodeId, []);
        adj.get(edge.parentNodeId)!.push(edge.childNodeId);
      }
    }

    const visited = new Set<string>();
    const recStack = new Set<string>();

    for (const node of bom.nodes) {
      if (this.isCyclic(node.bomNodeId, visited, recStack, adj)) {
        return true;
      }
    }
    return false;
  }

  private static isCyclic(v: string, visited: Set<string>, recStack: Set<string>, adj: Map<string, string[]>): boolean {
    if (!visited.has(v)) {
      visited.add(v);
      recStack.add(v);

      const neighbors = adj.get(v) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor) && this.isCyclic(neighbor, visited, recStack, adj)) {
          return true;
        } else if (recStack.has(neighbor)) {
          return true;
        }
      }
    }
    recStack.delete(v);
    return false;
  }
}
