import { PrecisionLevel } from './distributed_cfd_types';

export enum FEMAnalysisType {
  LINEAR_STATIC = 'LINEAR_STATIC',
  NONLINEAR_STATIC = 'NONLINEAR_STATIC',
  MODAL = 'MODAL',
  HARMONIC = 'HARMONIC',
  TRANSIENT = 'TRANSIENT',
  THERMAL = 'THERMAL',
  THERMOMECHANICAL = 'THERMOMECHANICAL',
  BUCKLING = 'BUCKLING',
  CONTACT = 'CONTACT',
  MULTIPHYSICS = 'MULTIPHYSICS'
}

export enum FEMElementType {
  BAR = 'BAR',
  BEAM = 'BEAM',
  TRUSS = 'TRUSS',
  SHELL = 'SHELL',
  SOLID = 'SOLID',
  TETRAHEDRAL = 'TETRAHEDRAL',
  HEXAHEDRAL = 'HEXAHEDRAL',
  WEDGE = 'WEDGE',
  PYRAMID = 'PYRAMID'
}

export enum FEMDOFType {
  UX = 'UX',
  UY = 'UY',
  UZ = 'UZ',
  RX = 'RX',
  RY = 'RY',
  RZ = 'RZ',
  TEMPERATURE = 'TEMPERATURE',
  PRESSURE = 'PRESSURE',
  DAMAGE = 'DAMAGE',
  PHASE = 'PHASE',
  CUSTOM = 'CUSTOM'
}

export enum FEMSparseFormat {
  CSR = 'CSR',
  CSC = 'CSC',
  BCSR = 'BCSR',
  DISTRIBUTED = 'DISTRIBUTED'
}

export enum FEMConstraintType {
  DIRICHLET = 'DIRICHLET',
  MPC = 'MPC',
  SYMMETRY = 'SYMMETRY',
  PERIODIC = 'PERIODIC',
  COUPLING = 'COUPLING',
  RIGID_BODY = 'RIGID_BODY',
  USER_DEFINED = 'USER_DEFINED'
}

export enum FEMContactType {
  SURFACE_TO_SURFACE = 'SURFACE_TO_SURFACE',
  NODE_TO_SURFACE = 'NODE_TO_SURFACE',
  MORTAR = 'MORTAR',
  PENALTY = 'PENALTY',
  AUGMENTED_LAGRANGIAN = 'AUGMENTED_LAGRANGIAN'
}

export enum FEMLoadType {
  NODAL = 'NODAL',
  DISTRIBUTED = 'DISTRIBUTED',
  SURFACE = 'SURFACE',
  BODY = 'BODY',
  THERMAL = 'THERMAL',
  PRESSURE = 'PRESSURE',
  GRAVITY = 'GRAVITY',
  CENTRIFUGAL = 'CENTRIFUGAL',
  USER_DEFINED = 'USER_DEFINED'
}

export enum FEMFailureClass {
  NODE_FAILURE = 'NODE_FAILURE',
  PROCESS_FAILURE = 'PROCESS_FAILURE',
  NETWORK_FAILURE = 'NETWORK_FAILURE',
  NUMERICAL_FAILURE = 'NUMERICAL_FAILURE',
  MATERIAL_FAILURE = 'MATERIAL_FAILURE',
  CONTACT_FAILURE = 'CONTACT_FAILURE',
  INPUT_FAILURE = 'INPUT_FAILURE',
  RESOURCE_FAILURE = 'RESOURCE_FAILURE'
}

export interface FEMGlobalEntityIdentity {
  globalId: number;
  ownerRank: number;
}

export interface FEMPartitionRecord {
  partitionHash: string;
  rankCount: number;
  elementCount: number;
  nodeCount: number;
  ghostCount: number;
  edgeCut: number;
  loadBalance: number;
}

export interface FEMDOFMap {
  globalDofId: number;
  nodeId: number;
  dof: FEMDOFType;
  ownerRank: number;
  isConstrained: boolean;
  constrainedValue?: number;
}

export interface FEMGhostNode extends FEMGlobalEntityIdentity {
  coordinates: number[];
}

export interface FEMGhostElement extends FEMGlobalEntityIdentity {
  type: FEMElementType;
  nodeIds: number[];
}

export interface FEMElementKernel {
  elementId: number;
  type: FEMElementType;
  order: 'linear' | 'quadratic' | 'higher-order';
  nodeIds: number[];
  materialId: string;
  integrationPointsCount: number;
}

export interface FEMMaterialState {
  elementId: number;
  integrationPointId: number;
  stress: number[];
  strain: number[];
  plasticStrain: number[];
  temperature: number;
  internalVariables: number[];
}

export interface FEMConstraint {
  constraintId: string;
  type: FEMConstraintType;
  ownerRank: number;
  affectedDOFs: number[];
  masterDOFs?: number[];
  slaveDOFs?: number[];
  coefficients?: number[];
  prescribedValues?: number[];
}

export interface FEMContactPair {
  globalContactId: string;
  type: FEMContactType;
  status: 'ACTIVE' | 'INACTIVE';
  gap: number;
  normal: number[];
  traction: number[];
  frictionState: string;
}

export interface FEMLoad {
  loadId: string;
  type: FEMLoadType;
  ownerRank: number;
  targetGlobalIds: number[];
  magnitude: number[];
}

export interface FEMCheckpointRecord {
  globalIteration: number;
  simulationTime: number;
  partitionHash: string;
  meshHash: string;
  dofMapHash: string;
  matrixPatternHash: string;
  solutionHash: string;
  materialStateHash: string;
  constraintHash: string;
  contactStateHash: string;
}

export interface FEMCommunicationProfile {
  iteration: number;
  rank: number;
  operation: string;
  bytes: number;
  durationMs: number;
}

export interface FEMProvenance {
  executionId: string;
  jobId: string;
  attemptId: string;
  solverVersion: string;
  binaryHash: string;
  meshHash: string;
  partitionHash: string;
  dofMapHash: string;
  sparsityPatternHash: string;
  materialHash: string;
  constraintHash: string;
  contactHash: string;
  mpiVersion: string;
  mpiEnvironmentHash: string;
  topologyHash: string;
  inputHash: string;
  configurationHash: string;
  solutionHash: string;
  outputHash: string;
}

export interface DistributedFEMEvidence {
  evidenceHash: string;
  meshId: string;
  elementsCount: number;
  materialModelId: string;
  dofMapId: string;
  partitionId: string;
  mpiRanks: number;
  hasGPU: boolean;
  precision: PrecisionLevel;
  solverType: string;
  preconditionerType: string;
  constraintsCount: number;
  hasContact: boolean;
  timestep: number;
  convergenceStatus: 'CONVERGED' | 'DIVERGED';
  globalEquilibriumNorm: number;
  restartVerified: boolean;
  parallelEfficiency: number;
  provenance: FEMProvenance;
}

export interface DistributedFEMQualificationRecord {
  qualificationId: string;
  timestamp: string;
  state: 'PENDING' | 'TESTING' | 'QUALIFIED' | 'FAILED' | 'REQUALIFICATION_REQUIRED';
  passedCount: number;
  criticalFailures: string[];
}

// ============================================================================
// PATCH-148 — REV.A — Distributed FEM Integrity Extensions Types
// ============================================================================

export enum FEMPartitioningAlgorithm {
  ELEMENT_COUNT = 'ELEMENT_COUNT',
  WEIGHTED_PARTITIONING = 'WEIGHTED_PARTITIONING'
}

export interface FEMWorkloadEvidence {
  elementId: number;
  workloadWeight: number;
  weightingFactors: {
    formulation: string;
    order: 'linear' | 'quadratic' | 'higher-order';
    integrationPoints: number;
    materialModel: string;
    nonlinearState: string;
    contactParticipation: boolean;
    tangentMatrixCost: number;
    internalVariableUpdateCost: number;
  };
  estimatorVersion: string;
  estimatorHash: string;
}

export interface FEMPartitionProvenance {
  partitionHash: string;
  elementOwnership: Record<number, number>;
  dofOwnership: Record<number, number>;
  interfaceTopology: string;
  workloadWeights: Record<number, number>;
  partitionAlgorithm: string;
  partitionVersion: string;
  workloadEstimatorVersion: string;
}

export interface SparsityRebuildProvenance {
  oldSparsityPatternHash: string;
  newSparsityPatternHash: string;
  rowOwnership: Record<number, number>;
  columnOwnership: Record<number, number>;
  ghostStructureHash: string;
  migrationMap: Record<number, number>;
  rebuildTime: number;
  solveTime: number;
  migrationTime: number;
  patternConstructionTime: number;
  sparsityRebuildStrategy: 'INCREMENTAL_REBUILD' | 'FULL_REBUILD';
  sparsityRebuildOverhead: number;
}

export interface FEMContactSearchStrategy {
  hierarchyType: string;
  boundingRepresentation: string;
  candidateRankMap: Record<number, number[]>;
  fineSearchAlgorithm: string;
  searchVersion: string;
  contactSearchStrategy: string;
}

export interface MeasuredElementWorkload {
  elementId: number;
  newtonIterations: number;
  elementUpdateCost: number;
  materialUpdateCost: number;
  contactIterations: number;
  solverIterations: number;
  localConvergenceBehavior: string;
  measuredCost: number;
}

export interface FEMRepartitionDecision {
  currentWorkloadDistribution: Record<number, number>;
  measuredImbalance: number;
  migrationCostEstimate: number;
  projectedGain: number;
  decision: 'REPARTITION' | 'NO_REPARTITION';
  decisionReason: string;
  previousPartitionHash: string;
  newPartitionHash: string;
}

export interface DistributedFEMREVAGateRecord {
  qualificationId: string;
  timestamp: string;
  state: 'PENDING' | 'QUALIFIED' | 'FAILED';
  checks: {
    weightedWorkloadPartitioning: boolean;
    stableGlobalDofOwnership: boolean;
    correctSparsityMigrationOrRebuild: boolean;
    correctCrossRankContactDiscovery: boolean;
    stableContactIdentities: boolean;
    measuredNonlinearWorkload: boolean;
    traceableRepartitionDecisions: boolean;
    completePartitionProvenance: boolean;
  };
  criticalFailures: string[];
}

// ============================================================================
// PATCH-148 — REV.B — Distributed FEM Numerical Integrity Extensions Types
// ============================================================================

export enum FEMReductionStrategy {
  STANDARD = 'STANDARD',
  COMPENSATED_SUMMATION = 'COMPENSATED_SUMMATION',
  DOUBLE_DOUBLE = 'DOUBLE_DOUBLE'
}

export interface FEMReductionEvidence {
  reductionId: string;
  result: number;
  precision: string;
  reductionTree: string;
  operandOrdering: string;
  accumulationStrategy: FEMReductionStrategy;
  floatingPointMode: string;
  numericalConfigurationHash: string;
}

export enum MPCStrategy {
  MASTER_SLAVE_ELIMINATION = 'MASTER_SLAVE_ELIMINATION',
  PENALTY = 'PENALTY'
}

export interface MPCEvidence {
  globalConstraintId: string;
  masterDOFs: number[];
  slaveDOFs: number[];
  coefficients: number[];
  eliminationStrategy: MPCStrategy;
  penaltyParameters?: {
    factor: number;
    formulation: string;
    scalingStrategy: string;
    conditioningImpact: number;
  };
  constraintOrdering: string;
  constraintStateHash: string;
}

export enum PostProcessingStrategy {
  LOCAL_AGGREGATION_WITH_OPTIONAL_BROADCAST = 'LOCAL_AGGREGATION_WITH_OPTIONAL_BROADCAST',
  CENTRALIZED = 'CENTRALIZED'
}

export interface PostProcessingPerformance {
  recoveryTime: number;
  solveTime: number;
  aggregationTime: number;
  ioTime: number;
  broadcastTime: number;
}

export interface PostProcessingProvenance {
  postProcessingHash: string;
  recoveryStrategy: string;
  aggregationStrategy: PostProcessingStrategy;
  requestedOutputs: string[];
  localStorageStrategy: string;
  broadcastPolicy: string;
  postProcessingVersion: string;
  performance: PostProcessingPerformance;
}

export interface NumericalConfiguration {
  floatingPointPrecision: string;
  reductionStrategy: FEMReductionStrategy;
  accumulationStrategy: string;
  solverConfiguration: string;
  preconditionerConfiguration: string;
  mpcStrategy: MPCStrategy;
  numericalMode: string;
  numericalConfigurationHash: string;
}

export interface DistributedFEMREVBGateRecord {
  qualificationId: string;
  timestamp: string;
  state: 'PENDING' | 'QUALIFIED' | 'FAILED';
  checks: {
    deterministicReductionOrdering: boolean;
    definedNumericalAccumulation: boolean;
    numericalConfigurationProvenance: boolean;
    mpcStrategyIntegrity: boolean;
    mpcStateReproducibility: boolean;
    distributedStressRecovery: boolean;
    postProcessingProvenance: boolean;
    measuredIOBehavior: boolean;
    restartNumericalCompatibility: boolean;
  };
  criticalFailures: string[];
}

