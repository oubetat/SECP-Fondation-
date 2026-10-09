/**
 * PATCH-SECP-060 — Shop-Floor Manufacturing Execution & Production Traceability Core
 * Structural definitions for shop-floor execution sessions, machine states,
 * events, tool consumption, material lots, physical part instances, and safety gates.
 */

export type MachineExecutionState =
  | 'OFFLINE'
  | 'AVAILABLE'
  | 'SETUP'
  | 'READY'
  | 'RUNNING'
  | 'PAUSED'
  | 'FAULT'
  | 'MAINTENANCE'
  | 'COMPLETED';

export type OperationExecutionState =
  | 'NOT_STARTED'
  | 'STARTED'
  | 'RUNNING'
  | 'PAUSED'
  | 'COMPLETED'
  | 'FAILED'
  | 'REWORKED';

export type ExecutionEventType =
  | 'SESSION_INITIALIZED'
  | 'MACHINE_STATE_SHIFT'
  | 'OPERATION_STATE_SHIFT'
  | 'TOOL_CONSUMED'
  | 'MATERIAL_LOT_VERIFIED'
  | 'SAFETY_GATE_TRIGGERED'
  | 'MACHINE_FAULT_RECORDED'
  | 'MACHINE_FAULT_RECOVERED'
  | 'PART_INSTANCE_COMPLETED'
  | 'SESSION_FINALIZED';

export interface ToolConsumptionRecord {
  toolId: string;
  originalRevision: string;
  measuredOffsetOffsetMm: number;
  initialFeedUsageSec: number;
  totalSpindleSecondsLimit: number;
  currentSpindleSecondsUsed: number;
}

export interface MaterialLotRecord {
  materialLotId: string;
  materialType: string;
  dimensionsMm: string;
  millCertificateId: string;
  hardnessBrinell: number;
}

export interface ManufacturedPartInstance {
  partInstanceId: string;
  partId: string;
  partRevision: string;
  parentJobId: string;
  serialNumber: string;
  lotId: string;
  toolUsedIds: string[];
  machineUsedId: string;
  clDataHash: string;
  ncProgramHash: string;
  timestampCompleted: string;
  metrologyReportId?: string;
}

export interface ManufacturingExecutionSession {
  sessionId: string;
  jobId: string;
  machineId: string;
  operatorId: string;
  loadedNCOrPackageHash: string;
  plannedNCProgramHash: string;
  machineState: MachineExecutionState;
  currentOperationId?: string;
  currentOperationState?: OperationExecutionState;
  toolConsumption: Record<string, ToolConsumptionRecord>;
  verifiedMaterialLot?: MaterialLotRecord;
  partInstances: ManufacturedPartInstance[];
  sessionStatus: 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'HALTED';
  timestampStart: string;
  timestampEnd?: string;
}

export interface ManufacturingExecutionEvent {
  eventId: string;
  executionSessionId: string;
  jobId: string;
  operationId?: string;
  machineId: string;
  eventType: ExecutionEventType;
  timestamp: string;
  previousState?: string;
  newState?: string;
  source: 'CNC_CONTROLLER' | 'BARCODE_SCANNER' | 'OPERATOR_CONSOLE' | 'SAFETY_GATE_DAEMON';
  payloadHash: string;
  provenanceHash: string;
}

export interface ExecutionSafetyGateReport {
  sessionId: string;
  isReadyToRun: boolean;
  ncProgramVerified: boolean;
  machineAvailable: boolean;
  machineCapabilityCompatible: boolean;
  toolingAvailable: boolean;
  fixtureAvailable: boolean;
  materialAvailable: boolean;
  operatorAuthorized: boolean;
  jobNotSuperseded: boolean;
  ncProgramHashMatches: boolean;
  unresolvedChangesCount: number;
  rejectionReason?: string;
}
