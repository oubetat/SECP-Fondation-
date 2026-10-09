/**
 * PATCH-SECP-068: Distributed Engineering Compute & Worker Orchestration Types
 * Defines the core models for deterministic distributed task execution.
 */

export type JobStatus = 'QUEUED' | 'ASSIGNED' | 'RUNNING' | 'VERIFYING' | 'COMPLETED' | 'FAILED' | 'RETRYING' | 'REJECTED';

export type WorkerStatus = 'ACTIVE' | 'IDLE' | 'BUSY' | 'OFFLINE' | 'DEGRADED';

export interface EngineeringJob {
  jobId: string;
  type: string;
  payloadHash: string;
  inputData: any;
  priority: number;
  requiredCapabilities: string[];
  executionPolicy: {
    maxRetries: number;
    timeoutSeconds: number;
    resourceLimits: {
      cpuCores: number;
      memoryMb: number;
    };
  };
  status: JobStatus;
  createdAt: string;
}

export interface ComputeWorker {
  workerId: string;
  version: string;
  status: WorkerStatus;
  capabilities: string[];
  totalResources: {
    cpuCores: number;
    memoryMb: number;
  };
  availableResources: {
    cpuCores: number;
    memoryMb: number;
  };
  trustScore: number; // 0.0 - 1.0
  lastHeartbeat: string;
}

export interface ExecutionRecord {
  executionId: string;
  jobId: string;
  workerId: string;
  startTime: string;
  endTime?: string;
  metrics: {
    cpuUsed: number;
    memoryUsed: number;
    durationMs: number;
  };
  outputHash?: string;
  error?: string;
}

export interface ComputeResult {
  resultId: string;
  jobId: string;
  output: any;
  outputHash: string;
  verified: boolean;
  timestamp: string;
}

export interface ComputeProvenanceRecord {
  recordId: string;
  jobId: string;
  executionId: string;
  workerId: string;
  inputHash: string;
  outputHash: string;
  signedBy: string;
  immutableSignature: string;
  timestamp: string;
}

export interface ComputePackage {
  packageId: string;
  job: EngineeringJob;
  worker: ComputeWorker;
  execution: ExecutionRecord;
  result: ComputeResult;
  provenance: ComputeProvenanceRecord;
}
