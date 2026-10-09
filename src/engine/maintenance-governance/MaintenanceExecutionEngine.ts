import { MaintenanceWorkOrder, MaintenanceExecutionRecord } from './MaintenanceGovernanceTypes';

export class MaintenanceExecutionEngine {
  public static recordExecution(
    workOrder: MaintenanceWorkOrder,
    technicianId: string,
    procedureVersion: string,
    actions: string[],
    measurementsBefore: Record<string, number>,
    measurementsAfter: Record<string, number>,
    partsConsumed: string[]
  ): MaintenanceExecutionRecord {
    const executionId = `exec-${workOrder.workOrderId}-${Date.now()}`;
    const timestamp = new Date().toISOString();

    const payload = `${executionId}|${workOrder.workOrderId}|${technicianId}|${procedureVersion}|${actions.join(',')}|${partsConsumed.join(',')}`;
    const executionEvidenceHash = `sha256-exec-ev-${this.simpleHash(payload)}`;

    return {
      executionId,
      workOrderId: workOrder.workOrderId,
      technicianId,
      procedureVersion,
      actions: [...actions],
      measurementsBefore,
      measurementsAfter,
      partsConsumed: [...partsConsumed],
      executionEvidenceHash,
      timestamp
    };
  }

  private static simpleHash(input: string): string {
    let hash = 0x66778899;
    for (let i = 0; i < input.length; i++) {
      hash = (hash << 5) - hash + input.charCodeAt(i);
      hash &= hash;
    }
    return Math.abs(hash).toString(16).toUpperCase();
  }
}
