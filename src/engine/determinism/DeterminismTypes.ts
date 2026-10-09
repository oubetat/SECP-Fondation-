/**
 * SECP Industrial OS v3 — PATCH-182: Deterministic Engineering Runtime Types
 * Defines data structures for canonicalization, stage hashes, floating-point monitors,
 * cross-runtime execution, divergence localization, and determinism artifacts.
 */

export type StrictnessLevel = 'STRICT' | 'NUMERIC' | 'RELAXED';

export type FloatingPointClassification =
  | 'EXACT_MATCH'
  | 'NUMERIC_EQUIVALENT'
  | 'ROUNDING_DRIFT'
  | 'SIGNIFICANT_FLOATING_POINT_DRIFT'
  | 'NUMERICAL_DIVERGENCE';

export type DeterminismFailureCategory =
  | 'INPUT_MISMATCH'
  | 'GEOMETRY_MISMATCH'
  | 'TOPOLOGY_MISMATCH'
  | 'MESH_MISMATCH'
  | 'SOLVER_CONFIG_MISMATCH'
  | 'SOLVER_STATE_MISMATCH'
  | 'FLOATING_POINT_DRIFT'
  | 'PARALLEL_REDUCTION_DRIFT'
  | 'CONVERGENCE_DIVERGENCE'
  | 'RESULT_MISMATCH'
  | 'HASH_MISMATCH'
  | 'ENVIRONMENT_MISMATCH';

export type RuntimeBackend = 'CPU_REF' | 'WORKER_THREAD' | 'WASM_SIMD' | 'WEBGPU_ACCEL';

export interface EnvironmentFingerprint {
  runtimeBackend: RuntimeBackend;
  cpuArchitecture: string;
  osName: string;
  compiler: string;
  wasmVersion: string;
  simdEnabled: boolean;
  mathBackend: string;
  floatingPrecisionBits: number; // 64 or 32
  runtimeVersion: string;
  fingerprintHash: string;
}

export interface DeterminismPolicy {
  policyId: string;
  strictnessLevel: StrictnessLevel;
  absoluteTolerance: number; // e.g. 1e-12
  relativeTolerance: number; // e.g. 1e-10
  floatingPointMode: 'IEEE_754_STRICT' | 'FAST_MATH_BOUNDED' | 'NUMERIC_ENVELOPE';
  reductionMode: 'ORDERED_KAHAN' | 'PAIRWISE_TREE' | 'DETERMINISTIC_PARALLEL' | 'STANDARD_SUM';
  randomSeed: number; // e.g. 421337
  quantizationPrecisionDigits: number; // e.g. 12
  maxReplayCount: number; // e.g. 5
}

export interface EngineeringInputManifest {
  manifestId: string;
  projectName: string;
  geometry: {
    units: string;
    cadModelId: string;
    boundingVolumeMM: [number, number, number];
    rawVertices: Array<[number, number, number]>;
    rawFaces: Array<Array<number>>;
  };
  topology: {
    bodyCount: number;
    faceCount: number;
    edgeCount: number;
    vertexCount: number;
    orientations: Array<number>;
  };
  materials: {
    materialName: string;
    densityKgM3: number;
    youngsModulusGPa: number;
    poissonsRatio: number;
    thermalConductivity: number;
  };
  constraints: Array<{
    constraintId: string;
    type: 'FIXED' | 'PRESCRIBED_DISPLACEMENT' | 'SLIDING';
    targetEntityId: string;
    values: [number, number, number];
  }>;
  boundaryConditions: Array<{
    bcId: string;
    type: 'PRESSURE' | 'TEMPERATURE' | 'FLUX' | 'FORCE';
    targetEntityId: string;
    value: number;
  }>;
  solverParameters: {
    solverType: 'DIRECT_SPARSE' | 'CG_ITERATIVE' | 'NONLINEAR_NEWTON_RAPHSON';
    maxIterations: number;
    convergenceTolerance: number;
    relaxationFactor: number;
  };
  meshParameters: {
    elementType: 'TET10' | 'HEX20' | 'TRI6' | 'QUAD8';
    targetElementSizeMM: number;
    minElementSizeMM: number;
    meshOrder: number;
  };
  runtimeParameters: {
    policy: DeterminismPolicy;
    seed: number;
  };
  canonicalInputHash: string;
}

export interface CanonicalGeometry {
  canonicalVertices: Array<[number, number, number]>;
  canonicalEdges: Array<[number, number]>;
  canonicalFaces: Array<Array<number>>;
  entityCount: number;
  normalizedTransformMatrix: number[];
  toleranceMM: number;
  geometryHash: string;
}

export interface CanonicalTopology {
  canonicalBodies: Array<{ bodyId: string; faceIds: string[] }>;
  canonicalFaces: Array<{ faceId: string; edgeIds: string[]; orientation: 1 | -1 }>;
  canonicalEdges: Array<{ edgeId: string; vertexIds: [string, string]; lengthMM: number }>;
  canonicalVertices: Array<{ vertexId: string; coords: [number, number, number] }>;
  orientationNormalizationsCount: number;
  detectedDriftFlags: string[];
  topologyHash: string;
}

export interface CanonicalMesh {
  nodes: Array<{ nodeId: number; coords: [number, number, number] }>;
  elements: Array<{ elementId: number; type: string; nodeIds: number[] }>;
  boundaryNodeGroups: Array<{ groupName: string; nodeIds: number[] }>;
  totalNodes: number;
  totalElements: number;
  connectivityHash: string;
}

export interface SolverStepResult {
  iteration: number;
  residualNorm: number;
  residualDelta: number;
  stateVectorChecksum: string;
  intermediateValues: number[];
  converged: boolean;
}

export interface CanonicalResult {
  resultId: string;
  fieldData: {
    displacementVector: Array<[number, number, number]>;
    vonMisesStressMPa: number[];
    temperatureKelvin: number[];
  };
  quantizedFields: {
    maxStressMPa: number;
    minStressMPa: number;
    maxDisplacementMM: number;
    strainEnergyJ: number;
  };
  units: Record<string, string>;
  resultHash: string;
}

export interface EngineeringDeterminismManifest {
  manifestId: string;
  timestamp: string;
  inputHash: string;
  geometryHash: string;
  topologyHash: string;
  meshHash: string;
  solverConfigHash: string;
  solverStateHash: string;
  resultHash: string;
  masterHash: string;
}

export interface FirstDivergenceLocation {
  divergenceFound: boolean;
  divergenceStage?: 'INPUT' | 'GEOMETRY' | 'TOPOLOGY' | 'MESH' | 'SOLVER_ITERATION' | 'RESULT';
  divergedIterationNumber?: number;
  variableName?: string;
  locationNodeOrElement?: number;
  referenceValue?: number;
  observedValue?: number;
  absoluteError?: number;
  relativeError?: number;
  classification?: FloatingPointClassification;
  runtimeA?: RuntimeBackend;
  runtimeB?: RuntimeBackend;
}

export interface ReplayVerificationStage {
  replayIndex: number;
  inputMatch: boolean;
  geometryMatch: boolean;
  topologyMatch: boolean;
  meshMatch: boolean;
  solverMatch: boolean;
  resultMatch: boolean;
  masterHash: string;
}

export interface DeterministicEngineeringArtifact {
  artifactId: string;
  timestamp: string;
  inputManifest: EngineeringInputManifest;
  geometryHash: string;
  topologyHash: string;
  meshHash: string;
  solverConfigHash: string;
  solverStateHash: string;
  resultHash: string;
  masterHash: string;
  environmentFingerprint: EnvironmentFingerprint;
  residualTrace: number[];
  floatingPointClassification: FloatingPointClassification;
  replays: ReplayVerificationStage[];
  oracleVerdict: 'PASS' | 'FAIL';
  failureCategory?: DeterminismFailureCategory;
}

export interface CrossRuntimeQualificationRow {
  stageName: 'Geometry' | 'Topology' | 'Mesh' | 'Solver' | 'Result' | 'Hash';
  cpuMatch: boolean;
  workerMatch: boolean;
  wasmMatch: boolean;
  gpuMatch: boolean;
  verdict: 'PASS' | 'FAIL';
}
