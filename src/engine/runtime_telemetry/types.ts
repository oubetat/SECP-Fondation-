// SECP Industrial OS v2 — Runtime Telemetry Core Types & Data Definitions

export type SessionState = 'STARTING' | 'RUNNING' | 'DEGRADED' | 'STOPPING' | 'COMPLETED' | 'FAILED' | 'ABORTED' | 'INVALID';
export type JobState = 'QUEUED' | 'STARTING' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'TIMEOUT' | 'INVALID';
export type RuntimeHealthState = 'HEALTHY' | 'DEGRADED' | 'OVERLOADED' | 'UNSTABLE' | 'FAILED' | 'UNKNOWN';
export type WorkerState = 'STARTING' | 'IDLE' | 'BUSY' | 'DRAINING' | 'DEGRADED' | 'FAILED' | 'OFFLINE' | 'UNKNOWN';
export type CompletenessVerdict = 'COMPLETE' | 'PARTIAL' | 'INCOMPLETE' | 'INVALID';

export interface RuntimeTelemetry {
  telemetryId: string;
  runtimeSessionId: string;
  jobId?: string;
  componentId: string;
  componentVersion: string;
  timestamp: string;
  sequenceNumber: number;
  eventType: string;
  metricType: string;
  value: number;
  unit: string;
  source: string;
  hostId: string;
  processId: string;
  threadId: string;
  correlationId: string;
  parentEventId?: string;
  schemaVersion: string;
  payloadHash: string;
  signature: string;
  status: string;
}

export interface RuntimeSession {
  runtimeSessionId: string;
  startTime: string;
  endTime?: string;
  environment: string;
  deploymentVersion: string;
  gitCommit: string;
  buildId: string;
  configurationHash: string;
  hostId: string;
  operatorId: string;
  sessionHash: string;
  state: SessionState;
}

export interface TelemetryEvent {
  eventId: string;
  runtimeSessionId: string;
  timestamp: string;
  sequenceNumber: number;
  eventType: string;
  source: string;
  schemaVersion: string;
  payload: any;
  payloadHash: string;
  previousEventHash: string;
  eventHash: string;
}

export interface RuntimeResourceSnapshot {
  snapshotId: string;
  runtimeSessionId: string;
  timestamp: string;
  cpuUsage: number;
  memoryUsage: number;
  gpuUsage: number;
  gpuMemory: number;
  diskUsage: number;
  networkRx: number;
  networkTx: number;
  threads: number;
  processes: number;
  snapshotHash: string;
}

export interface JobRuntimeTelemetry {
  jobId: string;
  runtimeSessionId: string;
  jobType: string;
  submittedAt: string;
  startedAt?: string;
  completedAt?: string;
  duration?: number;
  queueTime?: number;
  computeTime?: number;
  status: JobState;
  workerId?: string;
  inputHash: string;
  outputHash?: string;
}

export interface RuntimeEvidence {
  evidenceId: string;
  runtimeSessionId: string;
  sourceEventId: string;
  payloadHash: string;
  previousEvidenceHash: string;
  evidenceHash: string;
  timestamp: string;
}

export interface TelemetryMetricDefinition {
  metricId: string;
  name: string;
  type: string;
  unit: string;
  description: string;
  source: string;
  samplingInterval: number;
  aggregation: string;
  schemaVersion: string;
}

export interface RuntimeTrace {
  traceId: string;
  runtimeSessionId: string;
  jobId: string;
  operationType: string;
  inputHash: string;
  outputHash?: string;
  duration?: number;
  status: string;
}
