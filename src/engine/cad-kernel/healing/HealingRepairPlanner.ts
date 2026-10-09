/**
 * SECP CAD Kernel — Repair Planner
 * Phase 2 (PATCH-020)
 */

import {
  HealingDefect,
  HealingRepair,
  HealingRepairRejection,
  HealingRepairability
} from './HealingTypes';
import { GeometricTolerance, GeometricToleranceModel } from '../predicates/GeometricTolerance';

export interface HealingPlan {
  plannedRepairs: { defect: HealingDefect; action: string; classification: HealingRepairability }[];
  rejections: HealingRepairRejection[];
}

export class HealingRepairPlanner {
  public static createPlan(
    defects: HealingDefect[],
    model: GeometricToleranceModel = GeometricTolerance.DEFAULT
  ): HealingPlan {
    const plannedRepairs: { defect: HealingDefect; action: string; classification: HealingRepairability }[] = [];
    const rejections: HealingRepairRejection[] = [];

    let repairIdCounter = 0;

    for (const defect of defects) {
      repairIdCounter++;
      const repairId = `plan_rep_${repairIdCounter}`;

      if (defect.repairability === 'UNSAFE' || defect.repairability === 'UNSUPPORTED') {
        rejections.push({
          repairId,
          defectId: defect.defectId,
          action: `REPAIR_${defect.defectType}`,
          targetEntityIds: defect.entityIds,
          reason: `Repair classified as ${defect.repairability}: ${defect.description}`,
          classification: 'UNSAFE'
        });
        continue;
      }

      if (defect.measuredValue !== undefined && defect.allowedTolerance !== undefined) {
        if (defect.measuredValue > defect.allowedTolerance * 10) {
          rejections.push({
            repairId,
            defectId: defect.defectId,
            action: `REPAIR_${defect.defectType}`,
            targetEntityIds: defect.entityIds,
            reason: `Measured gap ${defect.measuredValue} exceeds allowed tolerance ${defect.allowedTolerance * 10}`,
            classification: 'EXCEEDS_TOLERANCE'
          });
          continue;
        }
      }

      // Order action based on defect type
      let action = 'HEAL_ENTITY';
      switch (defect.defectType) {
        case 'DUPLICATE_VERTEX':
        case 'NEAR_DUPLICATE_VERTEX':
          action = 'MERGE_VERTEX';
          break;
        case 'ORPHAN_VERTEX':
          action = 'REMOVE_ORPHAN_VERTEX';
          break;
        case 'ZERO_LENGTH_EDGE':
          action = 'REMOVE_ZERO_LENGTH_EDGE';
          break;
        case 'EDGE_ENDPOINT_MISMATCH':
          action = 'CORRECT_EDGE_ENDPOINTS';
          break;
        case 'GAP_IN_WIRE':
        case 'INVALID_EDGE_ORDER':
          action = 'REORDER_AND_CLOSE_WIRE';
          break;
        case 'FACE_ORIENTATION_CONFLICT':
          action = 'FIX_FACE_ORIENTATION';
          break;
      }

      plannedRepairs.push({
        defect,
        action,
        classification: defect.repairability
      });
    }

    // Sort planned repairs deterministically (Vertex -> Edge -> Wire -> Face -> Shell -> Solid)
    plannedRepairs.sort((a, b) => {
      const typeOrder: Record<string, number> = {
        MERGE_VERTEX: 1,
        REMOVE_ORPHAN_VERTEX: 2,
        REMOVE_ZERO_LENGTH_EDGE: 3,
        CORRECT_EDGE_ENDPOINTS: 4,
        REORDER_AND_CLOSE_WIRE: 5,
        FIX_FACE_ORIENTATION: 6
      };
      const o1 = typeOrder[a.action] || 99;
      const o2 = typeOrder[b.action] || 99;
      if (o1 !== o2) return o1 - o2;
      return a.defect.defectId.localeCompare(b.defect.defectId);
    });

    return { plannedRepairs, rejections };
  }
}
