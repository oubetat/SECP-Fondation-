/**
 * PATCH-SECP-059 — Manufacturing Job Orchestration & Production Planning Core
 * Definitions for Jobs, Operation Routing, Resource requirements, Scheduling structures,
 * State Machine stages, Traceability nodes, and Production Readiness check reports.
 */

import { ManufacturingExecutionPackage } from '../nc/NCExecutionTypes';

export type JobStatus = 
  | 'PLANNED'
  | 'READY'
  | 'QUEUED'
  | 'DISPATCHED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'BLOCKED'
  | 'HOLD'
  | 'FAILED'
  | 'CANCELLED';

export interface ResourceRequirements {
  machineId: string;
  requiredCapabilities: string[];
  toolIds: string[];
  fixtureId: string;
  materialType: string;
  requiredOperatorQualification: 'APPRENTICE' | 'JOURNEYMAN' | 'MASTER';
  requiresCMMInspection: boolean;
}

export interface RoutingOperation {
  operationId: string;
  sequenceNumber: number; // e.g. 10, 20, 30, 40, 50
  name: string; // e.g. "Sawing Raw Stock", "OP20 rough milling"
  workCenterId: string;
  estimatedSetupTimeMin: number;
  estimatedRunTimePerUnitMin: number;
  resources: ResourceRequirements;
  dependencyOperationIds: string[]; // operations that must complete before this sequence
}

export interface ManufacturingJob {
  jobId: string;
  partId: string;
  partRevision: string;
  executionPackageId: string;
  ncProgramHash: string;
  machineId: string;
  materialType: string;
  quantityOrdered: number;
  quantityCompleted: number;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: JobStatus;
  routing: RoutingOperation[];
  provenanceHash: string;
  timestamp: string;
}

export interface ResourceAvailability {
  resourceId: string; // machineId, toolId, fixtureId, operatorId
  type: 'MACHINE' | 'TOOL' | 'FIXTURE' | 'MATERIAL' | 'OPERATOR';
  isAvailable: boolean;
  quantityOnHand?: number;
  nextAvailableTime?: string;
}

export interface ScheduledTask {
  taskId: string;
  jobId: string;
  operationId: string;
  sequenceNumber: number;
  machineId: string;
  startTime: string;
  endTime: string;
}

export interface ScheduleConflict {
  conflictType: 'MACHINE_OVERLAP' | 'DEPENDENCY_VIOLATION' | 'CAPACITY_OVERLOAD' | 'IMPOSSIBLE_DUE_DATE';
  description: string;
  affectedTaskIds: string[];
  severity: 'WARNING' | 'CRITICAL';
}

export interface ProductionSchedule {
  scheduleId: string;
  tasks: ScheduledTask[];
  conflicts: ScheduleConflict[];
  scheduledAt: string;
  scheduleHash: string;
}

export interface ProductionTraceabilityNode {
  traceabilityId: string;
  jobId: string;
  productionOrderId: string;
  operationId: string;
  machineId: string;
  operatorId: string;
  executionPackageHash: string;
  producedPartSerialNumber: string;
  inspectionResult: 'PASS' | 'FAIL';
  clDataHash: string;
  ncProgramHash: string;
  timestamp: string;
}

export interface JobChangeImpactReport {
  jobId: string;
  oldNCOrPackageHash: string;
  newNCOrPackageHash: string;
  isNCPackageModified: boolean;
  isMachineIdModified: boolean;
  isTopologyModified: boolean;
  actionRequired: 'NONE' | 'REVIEW_SCHEDULE' | 'REVALIDATE_MACHINE' | 'REPLAN_JOB' | 'FULL_REGENERATION';
  description: string;
}

export interface ProductionReadinessReport {
  jobId: string;
  designValid: boolean;
  manufacturable: boolean;
  toolpathVerified: boolean;
  ncVerified: boolean;
  resourcesAvailable: boolean;
  routingValid: boolean;
  scheduleValid: boolean;
  isProductionReady: boolean;
  gateStateReport: Record<string, 'PASS' | 'FAIL'>;
}
