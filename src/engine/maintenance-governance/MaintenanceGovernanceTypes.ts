/**
 * PATCH-SECP-066: Manufacturing Maintenance & Service Governance Types
 * Defines the core domain model for controlled industrial maintenance lifecycles.
 */

import { MachineState, ReliabilityDecision } from '../asset-reliability/AssetReliabilityTypes';

export type TriggerType = 'TIME_BASED' | 'USAGE_BASED' | 'CONDITION_BASED' | 'FAILURE_BASED' | 'DEGRADATION_BASED' | 'MANUAL_ENGINEERING';

export type WorkOrderStatus = 'DRAFT' | 'APPROVED' | 'ASSIGNED' | 'IN_PROGRESS' | 'WAITING_PARTS' | 'COMPLETED' | 'VERIFICATION' | 'CLOSED' | 'CANCELLED' | 'BLOCKED' | 'REJECTED' | 'REOPENED';

export type MaintenanceDecision = 'CONTINUE_OPERATION' | 'MONITOR' | 'SCHEDULE_MAINTENANCE' | 'PRIORITY_MAINTENANCE' | 'CONTROLLED_SHUTDOWN' | 'BLOCK_RETURN_TO_SERVICE';

export type VerificationResult = 'PASSED' | 'FAILED' | 'CONDITIONAL' | 'REQUIRES_REWORK';

export interface MaintenanceAsset {
  assetId: string;
  machineId: string;
  assetType: string;
  configurationVersion: string;
  currentHealthState: MachineState;
  reliabilityReference: string; // Pointer to SECP-065 record
}

export interface MaintenancePlan {
  planId: string;
  assetId: string;
  version: number;
  maintenanceType: string;
  intervalPolicy: string;
  triggerPolicy: string;
  requiredSkills: string[];
  requiredParts: string[];
  verificationRequirements: string[];
  isActive: boolean;
}

export interface MaintenanceTrigger {
  triggerId: string;
  assetId: string;
  triggerType: TriggerType;
  source: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  evidenceReference: string;
  detectedAt: string;
}

export interface MaintenanceWorkOrder {
  workOrderId: string;
  assetId: string;
  triggerId: string;
  priority: number;
  status: WorkOrderStatus;
  assignedTechnician?: string;
  requiredParts: string[];
  requiredProcedures: string[];
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface TechnicianAuthorization {
  technicianId: string;
  competencyClass: number; // 1-5
  authorizedOperations: string[];
  status: 'ACTIVE' | 'REVOKED' | 'EXPIRED';
  validityWindow: string;
}

export interface MaintenanceExecutionRecord {
  executionId: string;
  workOrderId: string;
  technicianId: string;
  procedureVersion: string;
  actions: string[];
  measurementsBefore: Record<string, number>;
  measurementsAfter: Record<string, number>;
  partsConsumed: string[];
  executionEvidenceHash: string;
  timestamp: string;
}

export interface MaintenanceVerificationRecord {
  verificationId: string;
  executionId: string;
  functionalTestResult: string;
  telemetryStabilityScore: number;
  verifiedBy: string;
  result: VerificationResult;
  timestamp: string;
}

export interface MaintenanceClosureRecord {
  closureId: string;
  workOrderId: string;
  verificationId: string;
  decision: MaintenanceDecision;
  residualRisk: string;
  closedBy: string;
  timestamp: string;
}

export interface MaintenanceProvenanceRecord {
  recordId: string;
  workOrderId: string;
  evidenceRootHash: string;
  signedBy: string;
  immutableSignature: string;
  timestamp: string;
}

export interface MaintenancePackage {
  packageId: string;
  assetId: string;
  workOrder: MaintenanceWorkOrder;
  plan: MaintenancePlan;
  trigger: MaintenanceTrigger;
  execution: MaintenanceExecutionRecord;
  verification: MaintenanceVerificationRecord;
  closure: MaintenanceClosureRecord;
  provenance: MaintenanceProvenanceRecord;
}
