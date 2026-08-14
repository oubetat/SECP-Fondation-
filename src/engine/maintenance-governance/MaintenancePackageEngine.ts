/**
 * PATCH-SECP-066: Maintenance Package Engine
 * Bundles the complete maintenance digital thread.
 */

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
  public static bundle(
    assetId: string,
    wo: MaintenanceWorkOrder,
    plan: MaintenancePlan,
    trigger: MaintenanceTrigger,
    exec: MaintenanceExecutionRecord,
    ver: MaintenanceVerificationRecord,
    close: MaintenanceClosureRecord,
    prov: MaintenanceProvenanceRecord
  ): MaintenancePackage {
    return {
      packageId: `maint-pkg-${wo.workOrderId}`,
      assetId,
      workOrder: wo,
      plan,
      trigger,
      execution: exec,
      verification: ver,
      closure: close,
      provenance: prov
    };
  }
}
