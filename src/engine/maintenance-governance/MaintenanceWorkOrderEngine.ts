/**
 * PATCH-SECP-066: Maintenance Work Order Engine
 * Strictly manages the work order lifecycle state machine.
 */

import { MaintenanceWorkOrder, WorkOrderStatus, MaintenanceTrigger } from './MaintenanceGovernanceTypes';

export class MaintenanceWorkOrderEngine {
  public static createWorkOrder(trigger: MaintenanceTrigger, priority: number): MaintenanceWorkOrder {
    return {
      workOrderId: `wo-${trigger.assetId}-${Date.now()}`,
      assetId: trigger.assetId,
      triggerId: trigger.triggerId,
      priority,
      status: 'DRAFT',
      requiredParts: [],
      requiredProcedures: [],
      createdAt: new Date().toISOString()
    };
  }

  public static transitionStatus(wo: MaintenanceWorkOrder, next: WorkOrderStatus): MaintenanceWorkOrder {
    const current = wo.status;

    // Strict state machine rules
    if (current === 'DRAFT' && next !== 'APPROVED' && next !== 'CANCELLED') {
      throw new Error(`Invalid transition: ${current} -> ${next}`);
    }
    if (current === 'APPROVED' && next !== 'ASSIGNED' && next !== 'CANCELLED') {
      throw new Error(`Invalid transition: ${current} -> ${next}`);
    }
    if (next === 'CLOSED' && current !== 'VERIFICATION') {
      throw new Error('Closure requires prior verification');
    }

    return { ...wo, status: next };
  }
}
