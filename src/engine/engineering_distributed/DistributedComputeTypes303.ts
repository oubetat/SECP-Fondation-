/**
 * SECP Industrial OS - PATCH-303 Distributed Compute Types
 * Protocol Version: DISTRIBUTED_PROTOCOL_V1
 */

export type NodeId = string;
export type JobId = string;
export type TaskId = string;
export type ProjectId = string;
export type RevisionId = string;

export type NodeType = 'LOCAL_WORKER' | 'REMOTE_NODE' | 'EDGE_GPU' | 'CLUSTER_PEER';

export type NodeStatus =
  | 'REGISTERING'
  | 'AVAILABLE'
  | 'BUSY'
  | 'DRAINING'
  | 'OFFLINE'
  | 'FAILED';

export type JobStatus =
  | 'QUEUED'
  | 'PLANNING'
  | 'DISPATCHING'
  | 'RUNNING'
  | 'AGGREGATING'
  | 'VALIDATING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export type TaskStatus =
  | 'PENDING'
  | 'READY'
  | 'DISPATCHED'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'RETRYING'
  | 'CANCELLED';

export type WorkloadType =
  | 'CFD_SOLVE'
  | 'FEM_SOLVE'
  | 'MESH_PARTITION'
  | 'DESIGN_SPACE_SWEEP'
  | 'CAM_TOOLPATH_BATCH'
  | 'MIXED_PHYSICS';

export type PartitionStrategy =
  | 'SPATIAL'
  | 'TEMPORAL'
  | 'ELEMENT'
  | 'CELL'
  | 'PARAMETER'
  | 'BATCH';

export type AggregationStrategy =
  | 'CONCATENATE'
  | 'REDUCE'
  | 'MERGE'
  | 'AVERAGE'
  | 'WEIGHTED_REDUCTION'
  | 'FIELD_ASSEMBLY';

export type PriorityLevel = 'HIGH' | 'NORMAL' | 'LOW';

export type FailureCategory =
  | 'TRANSIENT'
  | 'RESOURCE'
  | 'NUMERICAL'
  | 'LOGICAL'
  | 'SECURITY';

export interface NodeCapabilities {
  cpuCores: number;
  memoryBytes: number;
  hasWasm: boolean;
  hasWasmSimd: boolean;
  hasWebGpu: boolean;
  gpuDeviceName?: string;
  workerCount: number;
  supportedKernels: string[];
}

export interface ResourceAccounting {
  requestedCpuCores: number;
  requestedMemoryBytes: number;
  reservedCpuCores: number;
  reservedMemoryBytes: number;
  usedCpuCores: number;
  usedMemoryBytes: number;
  releasedCpuCores: number;
  releasedMemoryBytes: number;
  gpuReserved: boolean;
  wasmReserved: boolean;
}

export interface ComputeNode {
  nodeId: NodeId;
  nodeType: NodeType;
  capabilities: NodeCapabilities;
  status: NodeStatus;
  version: string; // 'DISTRIBUTED_PROTOCOL_V1'
  ipOrAddress: string;
  authTokenHash: string;
  lastHeartbeat: number;
  accounting: ResourceAccounting;
  activeTasks: TaskId[];
  totalCompletedTasks: number;
  totalFailedTasks: number;
}

export interface TaskLease {
  leaseId: string;
  taskId: TaskId;
  nodeId: NodeId;
  issuedAt: number;
  expiresAt: number;
  renewalCount: number;
}

export interface DistributedTask {
  taskId: TaskId;
  jobId: JobId;
  partitionId: number;
  dependencies: TaskId[];
  inputHash: string;
  requiredCapabilities: string[];
  assignedNodeId?: NodeId;
  status: TaskStatus;
  retryCount: number;
  maxRetries: number;
  lease?: TaskLease;
  progress: number; // 0 to 100
  inputPayload: Record<string, any>;
  outputPayload?: Record<string, any>;
  outputHash?: string;
  executionError?: string;
  failureCategory?: FailureCategory;
  startTime?: number;
  endTime?: number;
  isOptional?: boolean;
}

export interface SchedulingPolicy {
  localityWeight: number; // 0 to 1
  loadWeight: number; // 0 to 1
  capabilityMatchStrict: boolean;
  timeoutMs: number;
  allowRetries: boolean;
  maxTaskRetries: number;
}

export interface DistributedJob {
  jobId: JobId;
  projectId: ProjectId;
  revisionId: RevisionId;
  workloadType: WorkloadType;
  partitionStrategy: PartitionStrategy;
  aggregationStrategy: AggregationStrategy;
  inputHash: string;
  priority: PriorityLevel;
  tasks: Map<TaskId, DistributedTask>;
  policy: SchedulingPolicy;
  status: JobStatus;
  creationTime: number;
  startTime?: number;
  completionTime?: number;
  aggregatedResult?: Record<string, any>;
  validationResult?: {
    valid: boolean;
    numericalDivergence: number;
    tolerance: number;
    validationNodeId?: NodeId;
    message: string;
  };
  failureReason?: string;
  checkpointCount: number;
  lastCheckpointTime?: number;
}

export interface DistributedCheckpoint {
  checkpointId: string;
  jobId: JobId;
  jobState: JobStatus;
  taskStates: Array<{ taskId: TaskId; status: TaskStatus; progress: number }>;
  completedOutputs: Array<{ taskId: TaskId; outputHash: string; payload: any }>;
  inputHashes: Array<{ taskId: TaskId; hash: string }>;
  configurationHash: string;
  nodeAssignments: Array<{ taskId: TaskId; nodeId: NodeId }>;
  solverState?: Record<string, any>;
  timestamp: number;
  signatureSha256: string;
}

export interface EvidenceRecord303 {
  executionId: string;
  jobId: JobId;
  taskId: TaskId;
  nodeId: NodeId;
  backend: string;
  inputHash: string;
  outputHash: string;
  configurationHash: string;
  kernelVersion: string;
  status: TaskStatus;
  durationMs: number;
  retryCount: number;
  validationStatus: 'VALIDATED' | 'REJECTED' | 'PENDING';
  digitalThreadToken: string;
  timestamp: number;
}

export interface ScalingMetrics303 {
  nodesCount: number;
  workersCount: number;
  singleNodeTimeMs: number;
  distributedTimeMs: number;
  speedup: number;
  parallelEfficiency: number;
  communicationOverheadRatio: number;
  networkTransferBytes: number;
  throughputTasksPerSec: number;
}

export interface ProductionClassificationStatus303 {
  capability: string;
  status: 'PROVEN' | 'PARTIAL' | 'UNPROVEN' | 'SIMULATED' | 'ABSENT';
  verificationCount: number;
  lastVerifiedAt: number;
}
