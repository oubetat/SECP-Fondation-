/**
 * SECP CAD Kernel — Edge Healing
 * Phase 2 (PATCH-020)
 */

import {
  HealingDefect,
  HealingRepair,
  HealingRepairRejection
} from './HealingTypes';
import { GeometricTolerance, GeometricToleranceModel } from '../predicates/GeometricTolerance';

export class EdgeHealing {
  public static healEdge(
    shape: any,
    defect: HealingDefect,
    model: GeometricToleranceModel = GeometricTolerance.DEFAULT
  ): { repair?: HealingRepair; rejection?: HealingRepairRejection; modified: boolean } {
    if (defect.defectType === 'ZERO_LENGTH_EDGE') {
      const eId = defect.entityIds[0];
      const removedCount = this.removeEdgeFromShape(shape, eId);

      return {
        repair: {
          repairId: `rep_${defect.defectId}`,
          defectId: defect.defectId,
          action: 'REMOVE_ZERO_LENGTH_EDGE',
          targetEntityIds: [eId],
          justification: `Removed degenerate zero-length edge ${eId} from ${removedCount} loops`,
          status: 'SUCCESS'
        },
        modified: true
      };
    }

    if (defect.defectType === 'EDGE_ENDPOINT_MISMATCH') {
      const [e1Id, e2Id] = defect.entityIds;
      const gap = defect.measuredValue || 0;

      if (gap > model.absoluteLength * 10) {
        return {
          rejection: {
            repairId: `rep_${defect.defectId}`,
            defectId: defect.defectId,
            action: 'CORRECT_EDGE_ENDPOINTS',
            targetEntityIds: [e1Id, e2Id],
            reason: `Gap ${gap} exceeds max edge healing tolerance ${model.absoluteLength * 10}`,
            classification: 'EXCEEDS_TOLERANCE'
          },
          modified: false
        };
      }

      // Synchronize edge end vertex coordinates
      this.synchronizeEdgeEndpoints(shape, e1Id, e2Id);

      return {
        repair: {
          repairId: `rep_${defect.defectId}`,
          defectId: defect.defectId,
          action: 'CORRECT_EDGE_ENDPOINTS',
          targetEntityIds: [e1Id, e2Id],
          distance: gap,
          tolerance: model.absoluteLength,
          justification: `Synchronized edge endpoint geometries across ${e1Id} and ${e2Id} at gap ${gap.toFixed(6)}`,
          status: 'SUCCESS'
        },
        modified: true
      };
    }

    return { modified: false };
  }

  private static removeEdgeFromShape(shape: any, edgeId: string): number {
    let removed = 0;

    const filterLoop = (loop: any) => {
      if (!loop || !loop.orientedEdges) return;
      const initial = loop.orientedEdges.length;
      loop.orientedEdges = loop.orientedEdges.filter((oe: any) => oe.edge && oe.edge.id !== edgeId);
      removed += initial - loop.orientedEdges.length;
    };

    if (shape.shapeType === 'SOLID' && shape.outerShell) {
      for (const of of shape.outerShell.orientedFaces || []) {
        if (of.face) {
          filterLoop(of.face.outerLoop);
          for (const inner of of.face.innerLoops || []) filterLoop(inner);
        }
      }
    } else if (shape.shapeType === 'SHELL') {
      for (const of of shape.orientedFaces || []) {
        if (of.face) {
          filterLoop(of.face.outerLoop);
          for (const inner of of.face.innerLoops || []) filterLoop(inner);
        }
      }
    } else if (shape.shapeType === 'FACE') {
      filterLoop(shape.outerLoop);
      for (const inner of shape.innerLoops || []) filterLoop(inner);
    }

    return removed;
  }

  private static synchronizeEdgeEndpoints(shape: any, e1Id: string, e2Id: string): void {
    // Find edges e1 and e2 and set e1.endVertex.geometry = e2.startVertex.geometry (midpoint)
    let e1: any = null;
    let e2: any = null;

    const inspectLoop = (loop: any) => {
      if (!loop || !loop.orientedEdges) return;
      for (const oe of loop.orientedEdges) {
        if (!oe.edge) continue;
        if (oe.edge.id === e1Id) e1 = oe.edge;
        if (oe.edge.id === e2Id) e2 = oe.edge;
      }
    };

    if (shape.shapeType === 'SOLID' && shape.outerShell) {
      for (const of of shape.outerShell.orientedFaces || []) {
        if (of.face) inspectLoop(of.face.outerLoop);
      }
    }

    if (e1 && e2 && e1.endVertex && e2.startVertex) {
      const mid = {
        x: (e1.endVertex.geometry.x + e2.startVertex.geometry.x) / 2,
        y: (e1.endVertex.geometry.y + e2.startVertex.geometry.y) / 2,
        z: (e1.endVertex.geometry.z + e2.startVertex.geometry.z) / 2
      };
      e1.endVertex.geometry = mid;
      e2.startVertex.geometry = mid;
    }
  }
}
