/**
 * PATCH-150 — Cloud Simulation Orchestrator Types
 * SECP Industrial OS v2 — Phase 12 (HPC / GPU / Cloud)
 */

export enum SimulationJobState {
  QUEUED = 'QUEUED',
  RESERVED = 'RESERVED',
  PROVISIONING = 'PROVISIONING',
  READY = 'READY',
  RUNNING = 'RUNNING',
  CHECKPOINTING = 'CHECKPOINTING',
  RESTARTING = 'RESTARTING',
  FINALIZING = 'FINALIZING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  BUDGET_EXCEEDED = 'BUDGET_EXCEEDED',
  EVICTED = 'EVICTED'
}

export enum ExecutionBackendType {
  LOCAL_CPU = 'LOCAL_CPU',
  LOCAL_GPU = 'LOCAL_GPU',
  CLOUD_CPU = 'CLOUD_CPU',
  CLOUD_GPU = 'CLOUD_GPU',
  HYBRID_CLUSTER = 'HYBRID_CLUSTER'
}

export interface SimulationResourceRequirement {
  cpuCores: number;
  gpuCount: number;
  memory: number; // GB
  mpiRanks: number;
  maxBudget: number; // USD
  requiredStorageGb: number;
  timeoutMinutes: number;
}

export interface CloudSimulationManifest {
  manifestId: string;
  manifestHash: string;
  workloadHash: string;
  solverHash: string;
  meshHash: string;
  resourceRequirements: SimulationResourceRequirement;
  solverName: string;
  parameters: Record<string, any>;
}

export interface SimulationJobIdentity {
  jobId: string;
  projectId: string;
  tenantId: string;
  userId: string;
  submittedAt: string;
}

export interface PlacementDecisionRecord {
  placementHash: string;
  requestedResources: SimulationResourceRequirement;
  selectedResources: {
    nodes: string[];
    interconnect: string;
  };
  placementPolicy: string;
  schedulerDecision: string;
  actualAllocation: {
    cpu: number;
    gpu: number;
  };
  region: string;
  availabilityZone: string;
  nodePool: string;
  isPreemptible: boolean;
}

export interface ResourceScalingEvent {
  eventId: string;
  timestamp: string;
  previousNodes: number;
  newNodes: number;
  reason: string;
}

export interface SimulationCostRecord {
  jobId: string;
  cumulativeCostUSD: number;
  burnRatePerHourUSD: number;
  maxBudgetUSD: number;
  isBudgetExceeded: boolean;
}

export interface CloudSimulationProvenance {
  manifestHash: string;
  orchestratorVersion: string;
  executionEnvironmentHash: string;
  signedAttestation: string;
}

export interface SimulationExecutionTimelineEvent {
  eventId: string;
  timestamp: string;
  logicalClock: number;
  type: string;
  state: SimulationJobState;
  message: string;
  sequence: number;
  previousEventHash: string;
  eventHash: string;
}

export interface CloudSimulationQualificationRecord {
  qualificationId: string;
  timestamp: string;
  state: 'QUALIFIED' | 'FAILED';
  checks: Record<string, boolean>;
  criticalFailures: string[];
}
