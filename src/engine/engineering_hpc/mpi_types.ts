import { PrecisionMode } from '../engineering_gpu/types';

export type MPIThreadLevel = 'SINGLE' | 'FUNNELED' | 'SERIALIZED' | 'MULTIPLE';

export interface MPIVersionFingerprint {
  implementation: 'OpenMPI' | 'MPICH' | 'IntelMPI' | 'HPC-X';
  version: string;
  abi: string;
  runtimeHash: string;
}

export interface MPIProcessTopology {
  worldSize: number;
  rank: number;
  localRank: number;
  nodeId: string;
  cpuSet: number[];
  numaNode: number;
  gpuId?: string;
}

// 1. Asynchronous Collectives Stats
export interface MPIAsyncCollectiveStats {
  collectiveStart: number;
  collectiveCompletion: number;
  waitTime: number;
  overlapTime: number;
  tailLatency: number;
  isAsynchronous: boolean;
  overlapRatio: number; // overlapTime / (collectiveCompletion - collectiveStart)
}

// 2. Straggler Metrics
export interface MPIStragglerMetrics {
  rank: number;
  nodeId: string;
  executionLatencyMs: number;
  communicationLatencyMs: number;
  collectiveWaitMs: number;
  synchronizationWaitMs: number;
  memoryPressureBytes: number;
  networkLatencyVarianceMs: number;
  isStraggler: boolean;
}

// 3. Hierarchical Checkpointing Types
export type GlobalCheckpointConsistencyModel = 'COORDINATED' | 'HIERARCHICAL' | 'ASYNC_WITH_GLOBAL_EPOCH';

export interface MPIDistributedCheckpoint {
  globalEpoch: number;
  globalIteration: number;
  consistencyModel: GlobalCheckpointConsistencyModel;
  partitionHash: string;
  rankCheckpoints: {
    [rank: number]: {
      rankStateHash: string;
      dependencyStateHash: string;
      timestamp: string;
    };
  };
}

// 4. Halo Aggregation Types
export type HaloStrategy = 'DIRECT' | 'PACKED' | 'PACKED_AGGREGATED';

export interface MPIHaloAggregationMetrics {
  strategy: HaloStrategy;
  messageCount: number;
  bytes: number;
  latencyMs: number;
  packingTimeMs: number;
  unpackingTimeMs: number;
  totalExchangeTimeMs: number;
}

// Domain Decomposition & Partitioning Quality
export interface MPILoadBalanceMetric {
  partitionId: string;
  elementCount: number;
  estimatedWork: number;
  memoryLoadBytes: number;
  communicationLoadBytes: number;
  maxLoadToAverageRatio: number; // maxLoad / averageLoad
  edgeCut: number;
}

export interface MPIDomainPartition {
  partitionId: string;
  rank: number;
  localElementsCount: number;
  neighborRanks: number[];
  boundaryEntitiesCount: number;
  partitionHash: string;
}

// Consolidated MPI Engineering Evidence
export interface MPIEngineeringEvidence {
  executionId: string;
  mpiFingerprint: MPIVersionFingerprint;
  topology: MPIProcessTopology[];
  partitionHash: string;
  communicationVolumeBytes: number;
  reductionDeterminism: 'STRICT' | 'REPRODUCIBLE' | 'STANDARD';
  scalingEfficiency: number;
  validationResult: 'VALIDATED' | 'MPI_CONSISTENCY_FAILURE';
  timestamp: string;
  asyncCollectiveStats?: MPIAsyncCollectiveStats;
  stragglers?: MPIStragglerMetrics[];
  checkpoint?: MPIDistributedCheckpoint;
  haloAggregation?: MPIHaloAggregationMetrics;
  loadBalance?: MPILoadBalanceMetric;
  globalConservationError?: number;
}

export interface MPIQualificationRecord {
  qualificationId: string;
  mpiVersion: string;
  transport: string;
  rankCount: number;
  latencyMs: number;
  bandwidthGBs: number;
  status: 'QUALIFIED' | 'FAILED';
}
