/**
 * SECP CAD Kernel — Solid Healing
 * Phase 2 (PATCH-020)
 */

import {
  HealingDefect,
  HealingRepair,
  HealingRepairRejection
} from './HealingTypes';
import { GeometricTolerance, GeometricToleranceModel } from '../predicates/GeometricTolerance';

export class SolidHealing {
  public static healSolid(
    shape: any,
    defect: HealingDefect,
    model: GeometricToleranceModel = GeometricTolerance.DEFAULT
  ): { repair?: HealingRepair; rejection?: HealingRepairRejection; modified: boolean } {
    if (defect.defectType === 'OPEN_SOLID' || defect.defectType === 'INVALID_CONTAINMENT') {
      return {
        rejection: {
          repairId: `rep_${defect.defectId}`,
          defectId: defect.defectId,
          action: 'HEAL_SOLID_STRUCTURE',
          targetEntityIds: defect.entityIds,
          reason: `Solid ${defect.entityIds[0]} has fundamental shell structural defects that cannot be safely synthesized.`,
          classification: 'UNSAFE'
        },
        modified: false
      };
    }

    return { modified: false };
  }
}
