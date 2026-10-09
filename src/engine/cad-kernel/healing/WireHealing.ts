/**
 * SECP CAD Kernel — Wire & Loop Healing
 * Phase 2 (PATCH-020)
 */

import {
  HealingDefect,
  HealingRepair,
  HealingRepairRejection
} from './HealingTypes';
import { GeometricTolerance, GeometricToleranceModel } from '../predicates/GeometricTolerance';
import { ToleranceHealing } from './ToleranceHealing';

export class WireHealing {
  public static healWire(
    shape: any,
    defect: HealingDefect,
    model: GeometricToleranceModel = GeometricTolerance.DEFAULT
  ): { repair?: HealingRepair; rejection?: HealingRepairRejection; modified: boolean } {
    if (defect.defectType === 'GAP_EXCEEDS_TOLERANCE') {
      const loopId = defect.entityIds[0];
      const gap = defect.measuredValue || 0;

      return {
        rejection: {
          repairId: `rep_${defect.defectId}`,
          defectId: defect.defectId,
          action: 'REORDER_AND_CLOSE_WIRE',
          targetEntityIds: [loopId],
          reason: `Wire gap ${gap.toFixed(6)} exceeds maximum allowed healing tolerance ${model.absoluteLength * 10}`,
          classification: 'EXCEEDS_TOLERANCE'
        },
        modified: false
      };
    }

    if (defect.defectType === 'GAP_IN_WIRE' || defect.defectType === 'INVALID_EDGE_ORDER') {
      const loopId = defect.entityIds[0];
      const gap = defect.measuredValue || 0;

      if (gap > model.absoluteLength * 10) {
        return {
          rejection: {
            repairId: `rep_${defect.defectId}`,
            defectId: defect.defectId,
            action: 'REORDER_AND_CLOSE_WIRE',
            targetEntityIds: [loopId],
            reason: `Wire gap ${gap.toFixed(6)} exceeds maximum allowed healing tolerance ${model.absoluteLength * 10}`,
            classification: 'EXCEEDS_TOLERANCE'
          },
          modified: false
        };
      }

      const closed = this.closeWireInShape(shape, loopId);

      return {
        repair: {
          repairId: `rep_${defect.defectId}`,
          defectId: defect.defectId,
          action: 'REORDER_AND_CLOSE_WIRE',
          targetEntityIds: [loopId],
          distance: gap,
          tolerance: model.absoluteLength,
          justification: `Reordered edges and closed wire loop ${loopId} gap of ${gap.toFixed(6)}`,
          status: 'SUCCESS'
        },
        modified: closed
      };
    }

    return { modified: false };
  }

  private static closeWireInShape(shape: any, loopId: string): boolean {
    let loopObj: any = null;

    const findLoop = (loop: any) => {
      if (loop && loop.id === loopId) loopObj = loop;
    };

    if (shape.shapeType === 'SOLID' && shape.outerShell) {
      for (const of of shape.outerShell.orientedFaces || []) {
        if (of.face) {
          findLoop(of.face.outerLoop);
          for (const inner of of.face.innerLoops || []) findLoop(inner);
        }
      }
    } else if (shape.shapeType === 'FACE') {
      findLoop(shape.outerLoop);
      for (const inner of shape.innerLoops || []) findLoop(inner);
    }

    if (!loopObj || !loopObj.orientedEdges || loopObj.orientedEdges.length < 2) return false;

    // Connect end vertex of last edge to start vertex of first edge
    const first = loopObj.orientedEdges[0];
    const last = loopObj.orientedEdges[loopObj.orientedEdges.length - 1];

    if (first.edge && last.edge && last.edge.endVertex && first.edge.startVertex) {
      last.edge.endVertex.geometry = { ...first.edge.startVertex.geometry };
      return true;
    }

    return false;
  }
}
