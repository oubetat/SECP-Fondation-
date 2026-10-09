/**
 * PATCH-151 — Massive Assembly Performance Types
 * SECP Industrial OS v2 — Phase 12 (HPC / GPU / Cloud)
 */

export enum AssemblyLoadState {
  UNLOADED = 'UNLOADED',
  PENDING = 'PENDING',
  LOADING = 'LOADING',
  PARTIAL = 'PARTIAL',
  LOADED = 'LOADED',
  DEFERRED = 'DEFERRED',
  EVICTED = 'EVICTED',
  UNAVAILABLE = 'UNAVAILABLE'
}

export enum AssemblyLODLevel {
  LOD0_FULL_ENGINEERING = 'LOD0_FULL_ENGINEERING',
  LOD1_REDUCED_REPRESENTATION = 'LOD1_REDUCED_REPRESENTATION',
  LOD2_LIGHTWEIGHT_ENGINEERING = 'LOD2_LIGHTWEIGHT_ENGINEERING',
  LOD3_SPATIAL_ENVELOPE = 'LOD3_SPATIAL_ENVELOPE'
}

export interface AssemblyWorkloadProfile {
  componentCount: number;
  uniqueGeometryCount: number;
  instanceCount: number;
  constraintCount: number;
  dependencyCount: number;
  estimatedGeometryCost: number; // Simulated weight
  estimatedMemoryCost: number; // in MB
  estimatedConstraintCost: number;
  estimatedStreamingCost: number;
  profileHash: string;
}

export interface PartInstanceIdentity {
  instanceId: string;
  partDefinitionId: string;
  transform: number[]; // 4x4 Matrix
  configurationId: string;
  revisionId: string;
  occurrencePath: string[];
  parentAssemblyId: string;
  geometryHash: string;
}

export interface AssemblyPartition {
  partitionId: string;
  componentIds: string[];
  boundingVolume: any;
  topologyComplexity: number;
  constraintDensity: number;
  memoryFootprint: number;
  loadState: AssemblyLoadState;
}

export interface PerformanceMeasurement {
  parseTime: number;
  graphConstructionTime: number;
  geometryLoadTime: number;
  geometryDecodeTime: number;
  spatialIndexTime: number;
  constraintSolveTime: number;
  memoryAllocationTime: number;
  cacheLookupTime: number;
  streamingTime: number;
  renderingTime: number;
  engineeringOperationTime: number;
}

export interface MassiveAssemblyEvidenceRecord {
  assemblyId: string;
  assemblyHash: string;
  revisionHash: string;
  configurationHash: string;
  workloadProfileHash: string;
  geometryManifestHash: string;
  dependencyGraphHash: string;
  spatialIndexHash: string;
  constraintGraphHash: string;
  cacheManifestHash: string;
  performanceProfileHash: string;
  runtimeFingerprint: string;
  timestamp: string;
  provenanceHash: string;
}

export interface MassiveAssemblyQualificationRecord {
  qualificationId: string;
  timestamp: string;
  state: 'QUALIFIED' | 'FAILED' | 'UNPROVEN' | 'INCONCLUSIVE' | 'INVALID';
  checks: {
    assemblyIdentityIntegrity: boolean;
    geometryFidelityIntegrity: boolean;
    instanceIdentityIntegrity: boolean;
    bomIntegrity: boolean;
    revisionIntegrity: boolean;
    configurationIntegrity: boolean;
    constraintIntegrity: boolean;
    dependencyGraphIntegrity: boolean;
    spatialIndexCorrectness: boolean;
    streamingCorrectness: boolean;
    cacheCorrectness: boolean;
    memorySafety: boolean;
    incrementalUpdateCorrectness: boolean;
    parallelExecutionCorrectness: boolean;
    determinism: boolean;
    failureRecovery: boolean;
    scalingMeasurement: boolean;
    rawPerformanceEvidence: boolean;
    provenanceCompleteness: boolean;
    evidenceChainIntegrity: boolean;
  };
  criticalFailures: string[];
}
