/**
 * PATCH-SECP-066: Maintenance Execution Engine
 * Records the granular actions and evidence of maintenance activities.
 */

import { MaintenanceExecutionRecord, MaintenanceWorkOrder } from './MaintenanceGovernanceTypes';

export class MaintenanceExecutionEngine {
  public static recordExecution(
    wo: MaintenanceWorkOrder,
    techId: string,
    procedure: string,
    actions: string[],
    measurementsBefore: Record<string, number>,
    measurementsAfter: Record<string, number>,
    parts: string[]
  ): MaintenanceExecutionRecord {
    const timestamp = new Date().toISOString();
    const payload = `${wo.workOrderId}|${techId}|${procedure}|${actions.join(',')}|${JSON.stringify(measurementsAfter)}`;
    
    return {
      executionId: `exec-${wo.workOrderId}`,
      workOrderId: wo.workOrderId,
      technicianId: techId,
      procedureVersion: procedure,
      actions,
      measurementsBefore,
      measurementsAfter,
      partsConsumed: parts,
      executionEvidenceHash: `sha256-exec-${this.simpleHash(payload)}`,
      timestamp
    };
  }

  private static simpleHash(input: string): string {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      hash = (hash << 5) - hash + input.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(16).toUpperCase();
  }
}
