/**
 * SECP CAD Kernel — Shell Healing
 * Phase 2 (PATCH-020)
 */

import {
  HealingDefect,
  HealingRepair,
  HealingRepairRejection
} from './HealingTypes';
import { GeometricTolerance, GeometricToleranceModel } from '../predicates/GeometricTolerance';

export class ShellHealing {
  public static healShell(
    shape: any,
    defect: HealingDefect,
    model: GeometricToleranceModel = GeometricTolerance.DEFAULT
  ): { repair?: HealingRepair; rejection?: HealingRepairRejection; modified: boolean } {
    if (defect.defectType === 'OPEN_SHELL' || defect.defectType === 'NON_MANIFOLD_SHELL') {
      return {
        rejection: {
          repairId: `rep_${defect.defectId}`,
          defectId: defect.defectId,
          action: 'FORCE_SHELL_CLOSURE',
          targetEntityIds: defect.entityIds,
          reason: `Shell ${defect.entityIds[0]} has ${defect.measuredValue || 'unshared'} boundary/free edges. Open shells cannot automatically become solid without authorized surface geometry.`,
          classification: 'UNSAFE'
        },
        modified: false
      };
    }

    return { modified: false };
  }
}
