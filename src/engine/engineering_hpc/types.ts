import { BackendType, PrecisionMode } from '../engineering_gpu/types';

export type HPCErrorType =
  | 'HPC_BINARY_REJECTED'
  | 'HPC_MPI_FAILURE'
  | 'HPC_NUMA_ERROR'
  | 'HPC_RESOURCE_EXHAUSTED'
  | 'HPC_EXECUTION_TIMEOUT'
  | 'HPC_SECURITY_VIOLATION'
  | 'HPC_NUMERICAL_FAILURE'
  | 'HPC_VALIDATION_FAILED'
  | 'HPC_ABI_CONFLICT';

export interface CPUCapabilityFingerprint {
  architecture: 'x86_64' | 'ARM64';
  vendor: string;
  model: string;
  instructionSets: string[]; // SSE, AVX2, AVX-512, NEON
  coreCount: number;
  threadCount: number;
}

export interface NativeBuildFingerprint {
  sourceRevision: string;
  compiler: string;
  compilerVersion: string;
  buildFlags: string[];
  targetArchitecture: string;
  binaryHash: string;
}

export interface HPCJob {
  jobId: string;
  workloadId: string;
  priority: number;
  resources: {
    cores: number;
    ramMB: number;
    gpus: number;
    nodes: number;
  };
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'TIMEOUT';
}

export interface HPCEngineeringEvidence {
  executionId: string;
  jobId: string;
  workloadId: string;
  binaryHash: string;
  buildFingerprint: NativeBuildFingerprint;
  cpuFingerprint: CPUCapabilityFingerprint;
  mpiFingerprint?: {
    version: string;
    ranks: number;
    nodes: number;
  };
  inputHash: string;
  outputHash: string;
  precision: PrecisionMode;
  validationResult: 'VALIDATED' | 'NUMERICAL_DRIFT_DETECTED' | 'HPC_VALIDATION_FAILED';
  convergence: {
    residual: number;
    iterations: number;
    converged: boolean;
  };
  timing: {
    computeTimeMs: number;
    commTimeMs: number;
    totalTimeMs: number;
  };
  evidenceHash: string;
  timestamp: string;
}

export interface HPCQualificationRecord {
  qualificationId: string;
  binaryHash: string;
  environmentHash: string;
  precision: PrecisionMode;
  scalingEfficiency: number; // parallel efficiency
  status: 'QUALIFIED' | 'FAILED' | 'PENDING';
  timestamp: string;
}
