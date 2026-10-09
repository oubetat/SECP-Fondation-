export type JobStatus =
  | 'PLANNED'
  | 'READY'
  | 'QUEUED'
  | 'DISPATCHED'
  | 'IN_PROGRESS'
  | 'COMPLETED';

export interface ResourceAvailability {
  resourceId: string;
  type: 'MACHINE' | 'TOOL' | 'FIXTURE' | 'MATERIAL';
  isAvailable: boolean;
  quantityOnHand?: number;
}

export interface RoutingOperation {
  operationId: string;
  sequenceNumber: number;
  name: string;
  workCenterId: string;
  estimatedSetupTimeMin: number;
  estimatedRunTimePerUnitMin: number;
  resources: {
    machineId: string;
    requiredCapabilities: string[];
    toolIds: string[];
    fixtureId: string;
    materialType: string;
    requiredOperatorQualification: string;
    requiresCMMInspection: boolean;
  };
  dependencyOperationIds: string[];
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
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  status: JobStatus;
  routing: RoutingOperation[];
  provenanceHash: string;
  timestamp: string;
}
