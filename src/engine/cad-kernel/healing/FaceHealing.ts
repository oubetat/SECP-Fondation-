/**
 * SECP CAD Kernel — Face Healing
 * Phase 2 (PATCH-020)
 */

import {
  HealingDefect,
  HealingRepair,
  HealingRepairRejection
} from './HealingTypes';
import { GeometricTolerance, GeometricToleranceModel } from '../predicates/GeometricTolerance';

export class FaceHealing {
  public static healFace(
    shape: any,
    defect: HealingDefect,
    model: GeometricToleranceModel = GeometricTolerance.DEFAULT
  ): { repair?: HealingRepair; rejection?: HealingRepairRejection; modified: boolean } {
    if (defect.defectType === 'FACE_ORIENTATION_CONFLICT') {
      const [f1Id, f2Id] = defect.entityIds;
      const fixed = this.flipFaceOrientation(shape, f2Id);

      return {
        repair: {
          repairId: `rep_${defect.defectId}`,
          defectId: defect.defectId,
          action: 'FIX_FACE_ORIENTATION',
          targetEntityIds: [f2Id],
          justification: `Adjusted orientation of face ${f2Id} to align with adjacent face ${f1Id}`,
          status: 'SUCCESS'
        },
        modified: fixed
      };
    }

    if (defect.defectType === 'DEGENERATE_FACE' || defect.defectType === 'INVALID_FACE_BOUNDARY') {
      return {
        rejection: {
          repairId: `rep_${defect.defectId}`,
          defectId: defect.defectId,
          action: 'RECONSTRUCT_FACE_SURFACE',
          targetEntityIds: defect.entityIds,
          reason: 'Surface fabrication and arbitrary face creation are explicitly disallowed',
          classification: 'UNSAFE'
        },
        modified: false
      };
    }

    return { modified: false };
  }

  private static flipFaceOrientation(shape: any, faceId: string): boolean {
    if (shape.shapeType === 'SOLID' && shape.outerShell) {
      for (const of of shape.outerShell.orientedFaces || []) {
        if (of.face && of.face.id === faceId) {
          of.orientation = of.orientation === 'FORWARD' ? 'REVERSED' : 'FORWARD';
          return true;
        }
      }
    } else if (shape.shapeType === 'SHELL') {
      for (const of of shape.orientedFaces || []) {
        if (of.face && of.face.id === faceId) {
          of.orientation = of.orientation === 'FORWARD' ? 'REVERSED' : 'FORWARD';
          return true;
        }
      }
    }
    return false;
  }
}
