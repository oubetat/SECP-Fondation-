/**
 * SECP Industrial OS — EPC-012: Result Reproducibility Types
 */

import { EvidenceVerdictStatus } from '../epc/evidence/EngineeringEvidencePackageTypes';

export enum ReproducibilityStatus {
  PASS = 'PASS',
  FAIL = 'FAIL',
  INCONCLUSIVE = 'INCONCLUSIVE',
  BASELINE_CHANGED = 'BASELINE_CHANGED'
}

export interface TolerancePolicy {
  absoluteTolerance: number;
  relativeTolerance: number;
  referenceFloor?: number; // Minimum value for relative comparison to avoid division by zero
}

export interface ComparisonMetric {
  quantity: string;
  referenceValue: any;
  reproducedValue: any;
  absoluteError: number;
  relativeError: number;
  status: ReproducibilityStatus;
  details?: string;
}

export interface ComparisonResult {
  overallStatus: ReproducibilityStatus;
  metrics: ComparisonMetric[];
  maxError: number;
  rmsError: number;
  deterministicStatus: boolean;
  violations: string[];
}

export interface ReproducibilityContract {
  contractId: string;
  workflowId: string;
  caseId: string;
  baselineId: string;
  modelId: string;
  solverId: string;
  solverVersion: string;
  meshId: string;
  parameterSetId: string;
  inputHash: string; // Hash of CAD, Materials, Parameters, BCs, Loads
  configurationHash: string;
  executionEnvironmentHash: string;
  randomSeed?: number;
  deterministicMode: boolean;
  tolerancePolicy: Record<string, TolerancePolicy>;
  referenceResultId: string;
  comparisonResultId?: string;
  status: ReproducibilityStatus;
  createdAt: string;
}

export interface ReproducibilityRun {
  runId: string;
  workflowId: string;
  contractId: string;
  startedAt: string;
  completedAt?: string;
  inputHash: string;
  configurationHash: string;
  environmentHash: string;
  solverVersion: string;
  seed?: number;
  resultHash?: string;
  status: ReproducibilityStatus;
  failureReason?: string;
}

export interface EnvironmentFingerprint {
  os: string;
  runtime: string;
  cpu: string;
  gpu?: string;
  solverVersion: string;
  libraryVersions: Record<string, string>;
  numericalBackend?: string;
  hash: string;
}

export type EngineeringDomain = 'FEM' | 'CFD' | 'DEM' | 'SPH';

export interface ModelPackage {
  cadModelId: string;
  cadFormat: string;
  geometryData: {
    boundingVolumeMM: number[];
    vertices: number[][];
    faces: number[][];
  };
  topologyData: {
    bodyCount: number;
    faceCount: number;
    edgeCount: number;
    orientations: number[];
  };
  units: string;
  coordinateSystem: string;
  modelRevision: string;
  modelHash: string;
}

export interface MaterialsPackage {
  materialId: string;
  materialName: string;
  materialRevision: string;
  standard: string;
  properties: Record<string, { name: string; value: number; unit: string }>;
  constitutiveModel: string;
  units: Record<string, string>;
  provenance: {
    supplier: string;
    certifyingBody: string;
    sourceBatchId: string;
  };
  materialHash: string;
}

export interface BoundaryCondition {
  bcId: string;
  type: string;
  targetEntityId: string;
  targetEntityType: string;
  values: number[];
  unit: string;
}

export interface BoundaryConditionsPackage {
  boundaryConditions: BoundaryCondition[];
  initialConditions: {
    initialTemperatureKelvin: number;
    initialDisplacementMM: number[];
  };
  boundaryHash: string;
}

export interface MeshPackage {
  totalNodes: number;
  totalElements: number;
  nodeCoordinates: number[][];
  elementConnectivity: Array<{
    elementId: number;
    type: string;
    nodeIds: number[];
  }>;
  boundaryNodeGroups: Array<{
    groupName: string;
    nodeIds: number[];
  }>;
  qualityMetrics: {
    minJacobianRatio: number;
    maxAspectMetric: number;
    orthogonalityScore: number;
  };
  meshParameters: {
    targetElementSizeMM: number;
    minElementSizeMM: number;
    meshOrder: number;
  };
  meshGeneratorVersion: string;
  meshHash: string;
}

export interface SolverSettingsPackage {
  solverType: string;
  precisionMode: string;
  absoluteTolerance: number;
  relativeTolerance: number;
  iterationLimits: number;
  convergenceCriteria: string;
  relaxationFactor: number;
  timeStepSec: number;
  linearSolver: string;
  preconditioner: string;
  turbulenceModel: string;
  solverVersion: string;
  solverHash: string;
}

export interface DeterministicSeedPackage {
  masterSeed: number;
  meshSeed: number;
  solverSeed: number;
  randomizedAlgorithms: string[];
  seedPolicy: string;
  seedHash: string;
}

export interface RuntimeSpecPackage {
  os: string;
  cpuArchitecture: string;
  runtimeVersion: string;
  compiler: string;
  nodeWasmVersion: string;
  simdEnabled: boolean;
  precisionMode: string;
  backend: string;
  runtimeFingerprint: string;
  containerSpecification: {
    containerImage: string;
    entrypointCommand: string;
    environmentVariables: Record<string, string>;
    memoryRequiredGB: number;
    cpusRequired: number;
  };
  runtimeHash: string;
}

export interface ResultPackage {
  fieldData: {
    displacementVector: number[][];
    vonMisesStressMPa: number[];
    temperatureKelvin: number[];
  };
  scalars: {
    maxStressMPa: number;
    minStressMPa: number;
    maxDisplacementMM: number;
    strainEnergyJ: number;
  };
  vectors: {
    reactionForcesN: number[];
  };
  residuals: number[];
  convergenceState: string;
  conservationMetrics: {
    massConservationError: number;
    momentumConservationError: number;
  };
  resultHash: string;
}

export interface EvidenceItem {
  evidenceId: string;
  type: string;
  payloadSummary: string;
  cryptographicSignature: string;
  timestamp: string;
}

export interface EvidencePackage {
  inputManifestHash: string;
  executionLogs: string[];
  solverLogs: string[];
  residualHistory: number[];
  convergenceHistory: Array<{
    iteration: number;
    norm: number;
    converged: boolean;
  }>;
  conservationMetrics: {
    massBalanceError: number;
    energyBalanceError: number;
  };
  warnings: string[];
  errors: string[];
  evidenceItems: EvidenceItem[];
  evidenceHash: string;
}

export interface ReproducibilityManifest {
  packageId: string;
  caseId: string;
  packageVersion: string;
  creationTimestamp: string;
  engineeringDomain: EngineeringDomain;
  schemaVersion: string;
  masterPackageHash: string;
  hashes: Record<string, string>;
  isSealed: boolean;
  sealingTimestamp?: string;
  authorSignature?: string;
}

export interface ReproducibleEngineeringPackage {
  manifest: ReproducibilityManifest;
  model: ModelPackage;
  materials: MaterialsPackage;
  boundaryConditions: BoundaryConditionsPackage;
  mesh: MeshPackage;
  solverSettings: SolverSettingsPackage;
  deterministicSeed: DeterministicSeedPackage;
  runtimeSpecification: RuntimeSpecPackage;
  result: ResultPackage;
  evidence: EvidencePackage;
}
