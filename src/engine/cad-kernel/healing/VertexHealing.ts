/**
 * SECP CAD Kernel — Vertex Healing
 * Phase 2 (PATCH-020)
 */

import {
  HealingDefect,
  HealingRepair,
  HealingRepairRejection
} from './HealingTypes';
import { GeometricTolerance, GeometricToleranceModel } from '../predicates/GeometricTolerance';
import { ToleranceHealing } from './ToleranceHealing';

export class VertexHealing {
  public static healVertices(
    shape: any,
    defect: HealingDefect,
    model: GeometricToleranceModel = GeometricTolerance.DEFAULT
  ): { repair?: HealingRepair; rejection?: HealingRepairRejection; modified: boolean } {
    if (defect.defectType === 'DUPLICATE_VERTEX' || defect.defectType === 'NEAR_DUPLICATE_VERTEX') {
      const [v1Id, v2Id] = defect.entityIds;
      const dist = defect.measuredValue || 0;

      if (dist > model.absoluteLength * 10) {
        return {
          rejection: {
            repairId: `rep_${defect.defectId}`,
            defectId: defect.defectId,
            action: 'MERGE_VERTEX',
            targetEntityIds: [v1Id, v2Id],
            reason: `Distance ${dist} exceeds safe vertex merge tolerance ${model.absoluteLength * 10}`,
            classification: 'EXCEEDS_TOLERANCE'
          },
          modified: false
        };
      }

      // Merge v2 into v1 across shape topology
      const count = this.replaceVertexInShape(shape, v2Id, v1Id);

      return {
        repair: {
          repairId: `rep_${defect.defectId}`,
          defectId: defect.defectId,
          action: 'MERGE_VERTEX',
          targetEntityIds: [v1Id, v2Id],
          sourceEntityIds: [v2Id],
          distance: dist,
          tolerance: model.absoluteLength,
          justification: `Merged vertex ${v2Id} into ${v1Id} at distance ${dist.toFixed(6)} across ${count} edge references`,
          status: 'SUCCESS'
        },
        modified: true
      };
    }

    return { modified: false };
  }

  private static replaceVertexInShape(shape: any, oldVId: string, newVId: string): number {
    let replacedCount = 0;
    const newV = this.findVertex(shape, newVId);
    if (!newV) return 0;

    const replaceInLoop = (loop: any) => {
      if (!loop || !loop.orientedEdges) return;
      for (const oe of loop.orientedEdges) {
        if (!oe.edge) continue;
        if (oe.edge.startVertex && oe.edge.startVertex.id === oldVId) {
          oe.edge.startVertex = newV;
          replacedCount++;
        }
        if (oe.edge.endVertex && oe.edge.endVertex.id === oldVId) {
          oe.edge.endVertex = newV;
          replacedCount++;
        }
      }
    };

    if (shape.shapeType === 'SOLID' && shape.outerShell) {
      for (const of of shape.outerShell.orientedFaces || []) {
        if (of.face) {
          replaceInLoop(of.face.outerLoop);
          for (const inner of of.face.innerLoops || []) replaceInLoop(inner);
        }
      }
    } else if (shape.shapeType === 'SHELL') {
      for (const of of shape.orientedFaces || []) {
        if (of.face) {
          replaceInLoop(of.face.outerLoop);
          for (const inner of of.face.innerLoops || []) replaceInLoop(inner);
        }
      }
    } else if (shape.shapeType === 'FACE') {
      replaceInLoop(shape.outerLoop);
      for (const inner of shape.innerLoops || []) replaceInLoop(inner);
    }

    return replacedCount;
  }

  private static findVertex(shape: any, vId: string): any {
    let found: any = null;
    const searchInLoop = (loop: any) => {
      if (found || !loop || !loop.orientedEdges) return;
      for (const oe of loop.orientedEdges) {
        if (!oe.edge) continue;
        if (oe.edge.startVertex && oe.edge.startVertex.id === vId) {
          found = oe.edge.startVertex;
          return;
        }
        if (oe.edge.endVertex && oe.edge.endVertex.id === vId) {
          found = oe.edge.endVertex;
          return;
        }
      }
    };

    if (shape.shapeType === 'SOLID' && shape.outerShell) {
      for (const of of shape.outerShell.orientedFaces || []) {
        if (of.face) {
          searchInLoop(of.face.outerLoop);
          if (found) return found;
          for (const inner of of.face.innerLoops || []) {
            searchInLoop(inner);
            if (found) return found;
          }
        }
      }
    } else if (shape.shapeType === 'SHELL') {
      for (const of of shape.orientedFaces || []) {
        if (of.face) {
          searchInLoop(of.face.outerLoop);
          if (found) return found;
          for (const inner of of.face.innerLoops || []) {
            searchInLoop(inner);
            if (found) return found;
          }
        }
      }
    } else if (shape.shapeType === 'FACE') {
      searchInLoop(shape.outerLoop);
      if (found) return found;
      for (const inner of shape.innerLoops || []) {
        searchInLoop(inner);
        if (found) return found;
      }
    }

    return found;
  }
}
