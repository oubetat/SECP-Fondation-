/**
 * SECP Industrial OS - PATCH-301: Worker Parallelism Types
 * Comprehensive type definitions for engineering worker pool, DAG scheduling,
 * resource-aware dispatch, GPU coordination, and deterministic aggregation.
 */

export type TaskType =
  | 'CAD'
  | 'MESH'
  | 'FEM'
  | 'CFD'
  | 'CAM'
  | 'GEOMETRY'
  | 'VALIDATION'
  | 'POST_PROCESSING'
  | 'PARAMETER_SWEEP'
  | 'DESIGN_SPACE_EXPLORATION'
  | 'COLLISION_DETECTION'
  | 'BENCHMARK';

export type TaskPriority = 'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW';

export type TaskStatus =
  | 'QUEUED'
  | 'DISPATCHED'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'BLOCKED'
  | 'TIMEOUT';

export type WorkerHealthStatus =
  | 'STARTING'
  | 'READY'
  | 'BUSY'
  | 'DRAINING'
  | 'FAILED'
  | 'TERMINATED';

export type SchedulerPolicy = 'FIFO' | 'PRIORITY' | 'FAIR' | 'WORK_STEALING';

export type ErrorClassification =
  | 'USER_ERROR'
  | 'RESOURCE_ERROR'
  | 'NUMERICAL_ERROR'
  | 'WORKER_ERROR'
  | 'GPU_ERROR'
  | 'SYSTEM_ERROR';

export interface WorkerCapabilities {
  cpuCores: number;
  memoryLimitBytes: number;
  hasWasm: boolean;
  hasWebGPU: boolean;
  supportedTaskTypes: TaskType[];
  supportsSharedArrayBuffer: boolean;
  supportsTransferables: boolean;
}

export interface ResourceRequirements {
  estimatedCostOps?: number;
  memoryRequirementBytes?: number;
  requiresGPU?: boolean;
  gpuMemoryBytes?: number;
  affinityWorkerId?: string;
}

export interface ExecutionPolicy {
  timeoutMs?: number;
  maxRetries?: number;
  retryCount?: number;
  allowCpuFallback?: boolean;
  deterministicReduction?: boolean;
  numericalTolerance?: number;
  priorityScore?: number;
}

export interface TaskNamespace {
  projectId: string;
  revisionId: string;
  caseId?: string;
}

export interface WorkerTaskModel<TPayload = any> {
  taskId: string;
  taskType: TaskType;
  payload: TPayload;
  priority: TaskPriority;
  dependencies: string[]; // task IDs that must complete first
  resourceRequirements: ResourceRequirements;
  executionPolicy: ExecutionPolicy;
  namespace?: TaskNamespace;
  inputHash: string;
  createdAt: number;
}

export interface TaskMetrics {
  queueTimeMs: number;
  dispatchTimeMs: number;
  executionTimeMs: number;
  cpuTimeMs: number;
  gpuTimeMs?: number;
  memoryPeakBytes?: number;
  bytesTransferred?: number;
  startedAt: number;
  completedAt: number;
}

export interface TaskProvenance {
  taskId: string;
  workerId: string;
  workerVersion: string;
  schedulerVersion: string;
  inputHash: string;
  resultHash: string;
  executionMode: 'CPU_WORKER' | 'GPU_ACCELERATED_WORKER' | 'INLINE_FALLBACK';
  codeVersion: string;
  timestamp: string;
}

export interface TaskError {
  classification: ErrorClassification;
  code: string;
  message: string;
  stack?: string;
  workerId: string;
  taskId: string;
  recoverable: boolean;
}

export interface TaskResult<TResult = any> {
  taskId: string;
  status: TaskStatus;
  result?: TResult;
  metrics: TaskMetrics;
  errors?: TaskError[];
  provenance: TaskProvenance;
  progressPercent: number;
}

export type ProtocolMessageType =
  | 'REGISTER'
  | 'WORKER_HEARTBEAT'
  | 'TASK_SUBMIT'
  | 'TASK_START'
  | 'TASK_PROGRESS'
  | 'TASK_COMPLETE'
  | 'TASK_FAIL'
  | 'TASK_CANCEL'
  | 'DRAIN'
  | 'TERMINATE';

export interface ProtocolMessage<T = any> {
  type: ProtocolMessageType;
  messageId: string;
  workerId?: string;
  taskId?: string;
  payload?: T;
  timestamp: number;
}

export interface WorkerTelemetry {
  workerId: string;
  workerIndex: number;
  status: WorkerHealthStatus;
  currentTaskId: string | null;
  tasksCompleted: number;
  tasksFailed: number;
  totalActiveTimeMs: number;
  totalIdleTimeMs: number;
  lastHeartbeat: number;
  capabilities: WorkerCapabilities;
  currentMemoryBytes: number;
}

export interface ConcurrencyOverlapInterval {
  taskId: string;
  workerId: string;
  start: number;
  end: number;
  durationMs: number;
}

export interface ConcurrencyProof {
  measuredConcurrency: number;
  requestedConcurrency: number;
  overlapDetected: boolean;
  overlappingIntervals: ConcurrencyOverlapInterval[];
  activeWorkersCount: number;
  isRealParallelism: boolean;
}

export interface ScalingBenchmarkPoint {
  workerCount: number;
  executionTimeMs: number;
  speedup: number;
  efficiency: number;
  throughputOpsPerSec: number;
}

export interface ParallelismStatusSeparation {
  workerRuntime: 'PROVEN' | 'PARTIAL' | 'NOT_PROVEN';
  workerPool: 'PROVEN' | 'PARTIAL' | 'NOT_PROVEN';
  taskScheduler: 'PROVEN' | 'PARTIAL' | 'NOT_PROVEN';
  realConcurrency: 'PROVEN' | 'PARTIAL' | 'NOT_PROVEN';
  dagScheduling: 'PROVEN' | 'PARTIAL' | 'NOT_PROVEN';
  cfdParallelism: 'PROVEN' | 'PARTIAL' | 'NOT_PROVEN';
  femParallelism: 'PROVEN' | 'PARTIAL' | 'NOT_PROVEN';
  meshParallelism: 'PROVEN' | 'PARTIAL' | 'NOT_PROVEN';
  camParallelism: 'PROVEN' | 'PARTIAL' | 'NOT_PROVEN';
  gpuCoordination: 'PROVEN' | 'PARTIAL' | 'NOT_PROVEN';
  deterministicAggregation: 'PROVEN' | 'PARTIAL' | 'NOT_PROVEN';
  performanceScaling: 'PROVEN' | 'PARTIAL' | 'NOT_PROVEN';
}
