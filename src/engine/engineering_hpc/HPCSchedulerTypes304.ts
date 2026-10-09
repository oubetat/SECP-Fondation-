/**
 * SECP Industrial OS - PATCH-304 HPC Scheduler Types & Interfaces
 * Resource-Aware Placement, Topology Manifests, Fair-Share Quotas,
 * Preemption & Backfill Policies, Provenance & Evidence Structures
 */

export type HPCJobState =
  | 'SUBMITTED'
  | 'QUEUED'
  | 'ADMITTED'
  | 'ALLOCATING'
  | 'RUNNING'
  | 'CHECKPOINTING'
  | 'PREEMPTED'
  | 'RECOVERING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export type QueueClass = 'INTERACTIVE' | 'NORMAL' | 'HIGH_PRIORITY' | 'BATCH' | 'HPC';

export type WorkloadType =
  | 'CFD_SOLVE'
  | 'FEM_SOLVE'
  | 'MESH_PARTITION'
  | 'DESIGN_SPACE_SWEEP'
  | 'CAM_TOOLPATH_BATCH'
  | 'POSTPROCESS';

export type PreemptionClass = 'PREEMPTIBLE' | 'NON_PREEMPTIBLE' | 'CHECKPOINTABLE';

export type FailureCategory =
  | 'TRANSIENT'
  | 'RESOURCE'
  | 'NUMERICAL'
  | 'INFRASTRUCTURE'
  | 'SECURITY'
  | 'LOGICAL';

export type ReservationStatus = 'REQUESTED' | 'RESERVED' | 'ALLOCATED' | 'RELEASED';

export type SchedulerState = 'STARTING' | 'READY' | 'DEGRADED' | 'RECOVERING' | 'FAILED';

export type NodeHealthState = 'HEALTHY' | 'DEGRADED' | 'FAILED' | 'QUARANTINED' | 'DRAINING' | 'OFFLINE';

export type GpuType = 'NVIDIA_A100' | 'NVIDIA_H100' | 'WEBGPU_GENERIC' | 'NONE';

export interface HPCResourceRequest {
  cpus: number; // CPU Cores
  memoryGb: number; // GB Memory
  gpus: number; // GPU Count
  gpuType: GpuType;
  gpuMemoryGb: number; // GB GPU RAM
  wasmWorkers: number; // WASM Worker Threads
  nodes: number; // Node count
  storageGb: number; // Storage GB
  requestedWallTimeSec: number; // Max Wall Time
}

export interface HPCResourceReservation {
  reservationId: string;
  jobId: string;
  projectId: string;
  request: HPCResourceRequest;
  assignedNodes: string[];
  status: ReservationStatus;
  reservedAt: number;
  allocatedAt?: number;
  releasedAt?: number;
}

export interface HPCQueueConfig {
  queueClass: QueueClass;
  maxJobs: number;
  maxRuntimeSec: number;
  maxResources: HPCResourceRequest;
  basePriority: number;
  fairnessPolicy: 'WEIGHTED_FAIR_SHARE' | 'FIFO' | 'PRIORITY_STRICT';
  allowBackfill: boolean;
  allowPreemption: boolean;
}

export interface ProjectQuota {
  projectId: string;
  maxCpus: number;
  maxMemoryGb: number;
  maxGpus: number;
  maxConcurrentJobs: number;
  usedCpus: number;
  usedMemoryGb: number;
  usedGpus: number;
  activeJobsCount: number;
}

export interface HPCExecutionManifest {
  jobId: string;
  allocatedNodes: string[];
  allocatedCpus: number;
  allocatedMemoryGb: number;
  allocatedGpus: number;
  gpuType: GpuType;
  allocatedWasmWorkers: number;
  schedulingPolicyVersion: string;
  schedulingDecisionReason: string;
  candidateNodes: string[];
  rejectedNodes: { nodeId: string; reason: string }[];
  topologyLocalityScore: number;
  timestamp: number;
}

export interface HPCJob {
  jobId: string;
  projectId: string;
  userId: string;
  revisionId: string;
  workloadType: WorkloadType;
  priority: number; // Dynamic after priority aging
  basePriority: number;
  queueClass: QueueClass;
  resourceRequest: HPCResourceRequest;
  preemptionClass: PreemptionClass;
  dependencies: string[]; // List of required antecedent jobIds
  checkpointPolicy: {
    enabled: boolean;
    intervalSec: number;
    maxCheckpoints: number;
  };
  status: HPCJobState;
  submittedAt: number;
  admittedAt?: number;
  allocatedAt?: number;
  startedAt?: number;
  completedAt?: number;
  actualRuntimeSec?: number;
  assignedNodeIds: string[];
  reservationId?: string;
  checkpointHash?: string;
  retryCount: number;
  maxRetries: number;
  inputHash: string;
  outputHash?: string;
  arrayIndex?: number;
  arrayJobId?: string;
  executionManifest?: HPCExecutionManifest;
  validationStatus?: 'PENDING' | 'VALIDATED' | 'REJECTED';
  validationMessage?: string;
}

export interface NodeTopologyManifest {
  nodeId: string;
  hostname: string;
  status: NodeHealthState;
  cpusTotal: number;
  cpusAvailable: number;
  memoryGbTotal: number;
  memoryGbAvailable: number;
  gpusTotal: number;
  gpusAvailable: number;
  gpuType: GpuType;
  gpuMemoryGb: number;
  wasmWorkersAvailable: number;
  numaNodes: number;
  hasWebGpu: boolean;
  hasWasmSimd: boolean;
  rackId: string;
  networkBandwidthGbps: number;
  versionProtocol: string;
  leaseId?: string;
  leaseRenewedAt?: number;
}

export interface HPCSchedulerEvidenceRecord {
  evidenceId: string;
  jobId: string;
  projectId: string;
  revisionId: string;
  schedulerVersion: string;
  nodeIds: string[];
  resourceRequest: HPCResourceRequest;
  resourceAllocation: {
    cpus: number;
    memoryGb: number;
    gpus: number;
    wasmWorkers: number;
  };
  queueClass: QueueClass;
  priority: number;
  startTime: number;
  endTime: number;
  runtimeSec: number;
  checkpointHash: string;
  retries: number;
  status: HPCJobState;
  outputHash: string;
  validationStatus: string;
  digitalThreadToken: string;
  signatureSha256: string;
}

export interface HPCSchedulerTelemetry {
  queueDepth: Record<QueueClass, number>;
  activeJobsCount: number;
  completedJobsCount: number;
  failedJobsCount: number;
  preemptedJobsCount: number;
  backfilledJobsCount: number;
  avgWaitTimeMs: number;
  longestWaitTimeMs: number;
  cpuUtilizationPercent: number;
  gpuUtilizationPercent: number;
  memoryUtilizationPercent: number;
  workerUtilizationPercent: number;
  schedulingDecisionLatencyMs: number;
  backfillEfficiencyPercent: number;
  fairnessStarvationScore: number;
}

export interface ProductionClassificationStatus304 {
  capability: string;
  status: 'PROVEN' | 'PARTIAL' | 'UNPROVEN' | 'SIMULATED' | 'ABSENT';
  verificationCount: number;
  lastVerifiedAt: number;
}
