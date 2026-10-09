import { BOMGraphData, BOMNode, BOMChangeSet, BOMChange } from './types';

export class BOMDiffEngine {
  public static diff(bomR1: BOMGraphData, bomR2: BOMGraphData): BOMChangeSet {
    const changes: BOMChange[] = [];

    const nodesR1 = new Map<string, BOMNode>();
    for (const n of bomR1.nodes) nodesR1.set(n.bomNodeId, n);

    const nodesR2 = new Map<string, BOMNode>();
    for (const n of bomR2.nodes) nodesR2.set(n.bomNodeId, n);

    for (const [id, nodeR1] of nodesR1.entries()) {
      const nodeR2 = nodesR2.get(id);
      if (!nodeR2) {
        changes.push({ type: 'REMOVED', node: nodeR1 });
      } else {
        if (nodeR1.quantity !== nodeR2.quantity) {
          changes.push({
            type: 'CHANGED_QUANTITY',
            nodeId: id,
            oldQuantity: nodeR1.quantity,
            newQuantity: nodeR2.quantity,
            unit: nodeR2.unitOfMeasure
          });
        }
        if (nodeR1.partRevision !== nodeR2.partRevision) {
          changes.push({
            type: 'CHANGED_REVISION',
            nodeId: id,
            oldRevision: nodeR1.partRevision,
            newRevision: nodeR2.partRevision
          });
        }
        if (nodeR1.unitOfMeasure !== nodeR2.unitOfMeasure) {
          changes.push({
            type: 'CHANGED_UOM',
            nodeId: id,
            oldUOM: nodeR1.unitOfMeasure,
            newUOM: nodeR2.unitOfMeasure
          });
        }
      }
    }

    for (const [id, nodeR2] of nodesR2.entries()) {
      if (!nodesR1.has(id)) {
        changes.push({ type: 'ADDED', node: nodeR2 });
      }
    }

    return { changes };
  }
}
