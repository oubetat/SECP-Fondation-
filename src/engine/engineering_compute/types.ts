export type WorkloadClass =
  | 'INTERACTIVE'
  | 'BATCH'
  | 'SIMULATION'
  | 'OPTIMIZATION'
  | 'MONTE_CARLO'
  | 'PARAMETRIC_SWEEP'
  | 'MONITORING'
  | 'AI_INFERENCE'
  | 'AI_TRAINING'
  | 'POST_PROCESSING';

export type DeterminismClass =
  | 'STRICT_DETERMINISTIC'
  | 'REPRODUCIBLE'
  | 'NUMERICALLY_EQUIVALENT'
  | 'NON_DETERMINISTIC';

export type ExecutionState =
  | 'QUEUED'
  | 'ALLOCATED'
  | 'DISPATCHED'
  | 'RUNNING'
  | 'CHECKPOINTING'
  | 'PAUSED'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'RECOVERING'
  | 'INVALIDATED';

export type PartitionType =
  | 'GEOMETRIC_PARTITION'
  | 'MESH_PARTITION'
  | 'ELEMENT_PARTITION'
  | 'CELL_PARTITION'
  | 'PARAMETER_PARTITION'
  | 'TIME_PARTITION'
  | 'ASSEMBLY_PARTITION'
  | 'FEATURE_PARTITION';

export type ResourceType =
  | 'LOCAL_CPU'
  | 'LOCAL_GPU'
  | 'REMOTE_CPU'
  | 'REMOTE_GPU'
  | 'HPC_NODE'
  | 'CLOUD_VM'
  | 'CLOUD_GPU'
  | 'EDGE_NODE';

export type FailureType =
  | 'COMPUTE_FAILURE'
  | 'MEMORY_FAILURE'
  | 'NETWORK_FAILURE'
  | 'GPU_FAILURE'
  | 'NUMERICAL_FAILURE'
  | 'INPUT_FAILURE'
  | 'RESOURCE_TIMEOUT'
  | 'DEPENDENCY_FAILURE'
  | 'CHECKPOINT_FAILURE'
  | 'VALIDATION_FAILURE';

export interface ComputeResource {
  resourceId: string;
  type: ResourceType;
  cpuCount: number;
  gpuCount: number;
  memoryMB: number;
  gpuMemoryMB: number;
  architecture: string;
  capabilities: string[];
  availability: boolean;
  health: 'HEALTHY' | 'DEGRADED' | 'FAILED';
  location: string;
}

export interface EngineeringTask {
  taskId: string;
  workloadType: WorkloadClass;
  inputs: Record<string, any>;
  outputs?: Record<string, any>;
  dependencies: string[];
  resourceRequirements: {
    minCpu?: number;
    minGpu?: number;
    minMemoryMB?: number;
  };
  determinismClass: DeterminismClass;
  priority: number;
  state: ExecutionState;
  partitionType?: PartitionType;
  assignedResource?: string;
  checkpointId?: string;
}

export interface EngineeringCheckpoint {
  checkpointId: string;
  taskId: string;
  taskState: ExecutionState;
  inputHash: string;
  partialOutputHash: string;
  solverState: Record<string, any>;
  iteration: number;
  timeStep: number;
  workerId: string;
  resourceId: string;
  timestamp: string;
}

export interface ExecutionEvidence {
  executionId: string;
  taskId: string;
  inputsHash: string;
  outputsHash: string;
  resourceId: string;
  runtimeMs: number;
  solverVersion: string;
  validationStatus: 'VALIDATED' | 'NUMERICAL_DRIFT_DETECTED' | 'FAILED';
  timestamp: string;
}
