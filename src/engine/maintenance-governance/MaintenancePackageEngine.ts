import {
  MaintenancePackage,
  MaintenanceWorkOrder,
  MaintenancePlan,
  MaintenanceTrigger,
  MaintenanceExecutionRecord,
  MaintenanceVerificationRecord,
  MaintenanceClosureRecord,
  MaintenanceProvenanceRecord
} from './MaintenanceGovernanceTypes';

export class MaintenancePackageEngine {
  public static compilePackage(
    assetId: string,
    workOrder: MaintenanceWorkOrder,
    plan: MaintenancePlan,
    trigger: MaintenanceTrigger,
    execution: MaintenanceExecutionRecord,
    verification: MaintenanceVerificationRecord,
    closure: MaintenanceClosureRecord,
    provenance: MaintenanceProvenanceRecord
  ): MaintenancePackage {
    return {
      packageId: `pkg-maint-${workOrder.workOrderId}`,
      assetId,
      workOrder,
      plan,
      trigger,
      execution,
      verification,
      closure,
      provenance
    };
  }
}
