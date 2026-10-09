import { PrecisionMode } from '../../engine/engineering_gpu/types';
import { MPIProcessTopology, MPIVersionFingerprint, MPILoadBalanceMetric } from '../../engine/engineering_hpc/mpi_types';

export type BoundaryType = 'wall' | 'inlet' | 'outlet' | 'symmetry' | 'periodic' | 'far-field' | 'interface';
export type FieldLayout = 'cell-centered' | 'node-centered' | 'face-centered';
export type PrecisionLevel = 'FP32' | 'FP64' | 'HIGHER';
export type DiscretizationScheme = 'FIRST_ORDER_UPWIND' | 'SECOND_ORDER_UPWIND' | 'QUICK' | 'CENTRAL_DIFFERENCE';
export type PressureVelocityCoupling = 'SIMPLE' | 'SIMPLEC' | 'PISO' | 'Coupled';
export type TimeIntegrationMethod = 'Euler' | 'BDF' | 'Runge-Kutta' | 'Crank-Nicolson';
export type SolverDeterminismMode = 'STRICT_DETERMINISTIC' | 'REPRODUCIBLE' | 'STANDARD';
export type StragglerClass = 'NORMAL' | 'WARNING' | 'PERFORMANCE_STRAGGLER' | 'CRITICAL';
export type FailureClass = 
  | 'NODE_FAILURE' 
  | 'PROCESS_FAILURE' 
  | 'NETWORK_FAILURE' 
  | 'NUMERICAL_FAILURE' 
  | 'PHYSICAL_MODEL_FAILURE' 
  | 'INPUT_FAILURE' 
  | 'RESOURCE_FAILURE';

export type QualificationState = 'PENDING' | 'TESTING' | 'QUALIFIED' | 'FAILED' | 'REQUALIFICATION_REQUIRED';

/**
 * 4. DISTRIBUTED EXECUTION CONTRACT
 */
export interface DistributedCFDExecutionContract {
  executionId: string;
  jobId: string;
  attemptId: string;
  solverId: string;
  meshId: string;
  partitionId: string;
  worldSize: number;
}

/**
 * 5. GLOBAL MESH IDENTITY & OWNERSHIP
 */
export interface GlobalEntityIdentity {
  globalId: number;
  localId: number;
  ownerRank: number;
}

export interface CFDGhostCellMetadata extends GlobalEntityIdentity {
  localId: number;
}

/**
 * 7. DOMAIN DECOMPOSITION
 */
export type DecompositionStrategy = 'structured' | 'unstructured' | 'hybrid' | 'graph-based' | 'geometry-aware';

/**
 * 10. PARTITION RECORD
 */
export interface CFDPartitionRecord {
  partitionHash: string;
  rankCount: number;
  partitionQuality: MPILoadBalanceMetric;
  edgeCut: number;
  haloVolume: number;
  loadBalance: number; // maxCompute / averageCompute
  strategy: DecompositionStrategy;
}

/**
 * 20. DISTRIBUTED FIELDS
 */
export interface DistributedFieldSpec {
  fieldId: string;
  name: 'pressure' | 'velocity' | 'temperature' | 'density' | 'energy' | 'turbulence_k' | 'turbulence_epsilon' | 'species' | string;
  layout: FieldLayout;
  precision: PrecisionLevel;
}

export interface DistributedFieldValue {
  globalId: number;
  ownerRank: number;
  location: FieldLayout;
  value: number; // For scalars
  vectorValue?: { x: number; y: number; z: number }; // For vectors
}

/**
 * 24. PRECISION POLICY
 */
export interface CFDPrecisionPolicy {
  computePrecision: PrecisionLevel;
  communicationPrecision: PrecisionLevel;
  accumulationPrecision: PrecisionLevel;
}

/**
 * 26. DISTRIBUTED BOUNDARIES
 */
export interface DistributedBoundaryEntity {
  globalId: number;
  boundaryId: string;
  boundaryType: BoundaryType;
  ownerRank: number;
  periodicPairGlobalId?: number; // 29. PERIODIC BOUNDARIES (globally identifiable, partition-independent)
}

/**
 * 32. FINITE VOLUME SUPPORT
 */
export interface FVCellGeometry {
  globalId: number;
  volume: number;
  centroid: { x: number; y: number; z: number };
}

export interface FVFaceGeometry {
  globalId: number;
  area: number;
  normal: { x: number; y: number; z: number };
  centroid: { x: number; y: number; z: number };
  ownerCellGlobalId: number;
  neighborCellGlobalId: number; // -1 if boundary
  isInterfaceFace: boolean;
  interfaceNeighborRank?: number;
}

/**
 * 33. FLUX CALCULATION
 */
export interface FaceFluxValue {
  faceGlobalId: number;
  ownerCellGlobalId: number;
  neighborCellGlobalId: number;
  orientation: number; // 1 or -1
  flux: number;
}

/**
 * 36. CONSERVATION ERRORS
 */
export interface CFDConservationReport {
  mass: {
    localError: number;
    globalError: number;
    reconciliationError: number; // sum(local contributions) - global contribution
    massIn: number;
    massOut: number;
    massAccumulation: number;
  };
  momentum: {
    localError: number;
    globalError: number;
    momentumIn: number;
    momentumOut: number;
    bodyForces: number;
    wallForces: number;
    accumulation: number;
  };
  energy?: {
    localError: number;
    globalError: number;
    energyIn: number;
    energyOut: number;
    heat: number;
    work: number;
    accumulation: number;
  };
  passed: boolean;
  tolerance: number;
}

/**
 * 40. RESIDUAL SPECS
 */
export interface CFDResidualRecord {
  localResidual: number;
  globalResidual: number;
  normalizedResidual: number;
  relativeResidual: number;
  reductionOverlapMs?: number;
  reductionWaitMs?: number;
}

/**
 * 61. STRAGGLER METRICS & EVIDENCE
 */
export interface CFDStragglerRecord {
  rank: number;
  nodeId: string;
  iteration: number;
  classification: StragglerClass;
  computeTimeMs: number;
  haloTimeMs: number;
  collectiveWaitMs: number;
  memoryPressureBytes: number;
  networkLatencyMs: number;
  baselineMs: number;
  deviationMs: number;
}

export interface CFDLoadBalanceReport {
  loadImbalance: number; // maxCompute / averageCompute
  memoryBalance: number; // maxMemory / averageMemory
  communicationBalance: number; // maxCommunication / averageCommunication
}

export interface RepartitionEvent {
  oldPartitionHash: string;
  newPartitionHash: string;
  iteration: number;
  reason: string;
}

/**
 * 79. CHECKPOINT & RESTART
 */
export interface CFDCheckpointRecord {
  globalIteration: number;
  simulationTime: number;
  dt: number;
  partitionHash: string;
  meshHash: string;
  fieldHash: string;
  solverStateHash: string;
  consistencyModel: 'coordinated' | 'hierarchical' | 'async-with-global-epoch';
  timestamp: string;
}

/**
 * 85. FAILURE METRICS
 */
export interface CFDFailureRecord {
  executionId: string;
  iteration: number;
  rank?: number;
  nodeId?: string;
  type: FailureClass;
  message: string;
  timestamp: string;
}

/**
 * 97. CONVERGENCE MONITORING
 */
export interface CFDConvergenceReport {
  initialResidual: number;
  finalResidual: number;
  residualHistory: number[];
  iterations: number;
  tolerance: number;
  convergenceStatus: 'CONVERGED' | 'DIVERGED' | 'MAX_ITERATIONS_REACHED' | 'STABLE_ITERATING';
}

/**
 * 150. PROVENANCE RECORD
 */
export interface DistributedCFDProvenance {
  executionId: string;
  jobId: string;
  attemptId: string;
  solverVersion: string;
  binaryHash: string;
  meshHash: string;
  partitionHash: string;
  mpiVersion: string;
  mpiEnvironmentHash: string;
  topologyHash: string;
  inputHash: string;
  configurationHash: string;
  fieldHash: string;
  outputHash: string;
  solverHash: string;
  numericalConfigurationHash: string;
  distributedCFDExecutionHash: string;
}

/**
 * 155. DISTRIBUTED CFD EVIDENCE
 */
export interface DistributedCFDEvidence {
  evidenceHash: string;
  executionContract: DistributedCFDExecutionContract;
  provenance: DistributedCFDProvenance;
  partition: CFDPartitionRecord;
  precision: CFDPrecisionPolicy;
  discretization: {
    scheme: DiscretizationScheme;
    order: number;
  };
  timestep: {
    iteration: number;
    dt: number;
    localTimeStepping: boolean;
    cfl: {
      localCFL: number;
      globalCFL: number;
      maximumCFL: number;
    };
  };
  convergence: CFDConvergenceReport;
  conservation: CFDConservationReport;
  restart?: {
    restarted: boolean;
    fromIteration: number;
    equivalenceDrift: number;
  };
  performance: {
    singleRankBaselineMs: number;
    totalTimeMs: number;
    speedup: number;
    parallelEfficiency: number;
    communicationFraction: number; // communicationTime / totalTime
    haloFraction: number; // haloTime / totalTime
    synchronizationFraction: number; // synchronizationTime / totalTime
    solverComputeFraction: number; // solverComputeTime / totalTime
    loadImbalance: number;
  };
  gpuAware?: {
    enabled: boolean;
    directPathValidated: boolean;
    gpusAllocated: number;
    transferMs: number;
  };
}

export interface DistributedCFDQualificationRecord {
  qualificationId: string;
  timestamp: string;
  state: QualificationState;
  passedCount: number;
  failedCount: number;
  evidence?: DistributedCFDEvidence;
}

/**
 * ==========================================
 * PATCH-147 REV.A — ADDITIONAL ENGINEERING TYPES
 * ==========================================
 */

export type RepartitionOutcome = 
  | 'REPARTITION_ACCEPTED' 
  | 'REPARTITION_REJECTED' 
  | 'REPARTITION_DEFERRED' 
  | 'REPARTITION_FORCED';

export interface CFDRepartitionCost {
  estimatedMigrationTime: number;
  estimatedSynchronizationCost: number;
  estimatedRepartitionCost: number;
  projectedLoadBalanceGain: number;
  projectedCommunicationGain: number;
}

export interface RepartitionDecisionEvidence {
  type: 'REPARTITION_DECISION';
  currentPartitionHash: string;
  proposedPartitionHash: string;
  estimatedCost: number;
  projectedGain: number;
  decision: RepartitionOutcome;
  policyVersion: string;
  iteration: number;
  simulationTime: number;
}

export interface RepartitionEquivalenceVerification {
  globalIdStabilityPassed: boolean;
  fieldConservationPassed: boolean;
  interfaceConsistencyPassed: boolean;
  boundaryConsistencyPassed: boolean;
  solverStateConsistencyPassed: boolean;
  passed: boolean;
}

export interface MeshMotionProvenance {
  meshMotionModel: string;
  meshMotionVersion: string;
  coordinateHash: string;
  deformationHash: string;
  motionFieldHash: string;
  meshEpoch: number;
}

export interface GCLEvidence {
  meshEpoch: number;
  iteration: number;
  localGCL: number;
  globalGCL: number;
  tolerance: number;
  validationStatus: 'PASSED' | 'FAILED' | 'WORKLOAD_QUALIFIED';
}

export interface AMGStrategyShift {
  type: 'SOLVER_STRATEGY_SHIFT';
  previousSolver: string;
  newSolver: string;
  reason: string;
  coarseGridSize: number;
  worldSize: number;
  iteration: number;
}

export interface AMGStrategyProvenance {
  hierarchyHash: string;
  coarseGridSizes: number[];
  aggregationPolicy: string;
  solverPolicy: string;
  strategyVersion: string;
}

export interface PeriodicPairIdentity {
  periodicPairId: string;
  sourceGlobalId: number;
  targetGlobalId: number;
  sourceRank: number;
  targetRank: number;
}

export interface PeriodicCouplingMap {
  periodicCouplingHash: string;
  pairs: PeriodicPairIdentity[];
  isRestartStable: boolean;
  isRankDeterministic: boolean;
  isPartitionIndependent: boolean;
}

