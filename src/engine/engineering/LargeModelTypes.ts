export type ModelScaleClass = 'SMALL' | 'MEDIUM' | 'LARGE' | 'VERY_LARGE' | 'EXTREME';

export interface LargeModelTestId {
  modelId: string;
  modelRevision: string;
  datasetId: string;
  datasetVersion: string;
  configuration: string;
  featureTreeVersion: string;
  kernelVersion: string;
  hardware: string;
  software: string;
  benchmarkVersion: string;
  qualificationRunId: string;
  evidencePackageId: string;
}

export interface LargeModelWorkload {
  bodyCount: number;
  solidCount: number;
  surfaceCount: number;
  faceCount: number;
  edgeCount: number;
  vertexCount: number;
  featureCount: number;
  sketchCount: number;
  constraintCount: number;
  nurbsPatchCount: number;
  topologyComplexity: number; // e.g. loops, shells
  referenceCount: number;
  patternCount: number;
  configurationCount: number;
  materialCount: number;
  massPropertiesComplexity: number;
}

export interface ModelComplexityProfile {
  geometryComplexity: number; // 1-100 score
  topologyComplexity: number; // 1-100 score
  featureComplexity: number;  // 1-100 score
  parametricComplexity: number;// 1-100 score
  referenceComplexity: number; // 1-100 score
  surfaceComplexity: number;   // 1-100 score
}

export interface LargeModelDatasetId {
  source: string;
  license: string;
  version: string;
  hash: string;
  revision: string;
  geometryStatistics: {
    vertices: number;
    faces: number;
    edges: number;
  };
  featureStatistics: {
    features: number;
    constraints: number;
  };
}

export interface ModelFingerprint {
  geometryHash: string;
  topologyHash: string;
  featureTreeHash: string;
  parameterHash: string;
  materialHash: string;
  referenceHash: string;
}

export interface FeatureTreeFingerprint {
  featureCount: number;
  treeDepth: number;
  fingerprintHash: string;
  orderedFeatures: string[];
}

export interface LargeModelDependencyGraph {
  nodes: { id: string; type: 'Feature' | 'Sketch' | 'Reference' | 'Body' | 'Assembly' | 'Drawing' | 'Simulation' | 'CAM' | 'PLM'; label: string }[];
  edges: { source: string; target: string; type: string }[];
  circularDetected: boolean;
  danglingReferences: string[];
}

export interface LargeModelKernelHealth {
  kernelVersion: string;
  operationsRun: number;
  failuresIsolated: number;
  transactionActive: boolean;
  healthVerdict: 'EXCELLENT' | 'DEGRADED' | 'CRITICAL';
}

export interface LargeModelPerformanceEnvelope {
  maxTestedComplexityScore: number;
  maxTestedVertices: number;
  maxTestedFeatures: number;
  fpsDegradationCurve: { items: number; fps: number }[];
}

export interface LargeModelEvidencePackage {
  qualificationRunId: string;
  dataset: LargeModelDatasetId;
  fingerprint: ModelFingerprint;
  environment: {
    os: string;
    cpu: string;
    ramGb: number;
    gpu: string;
    vramMb: number;
    workers: number;
  };
  operations: { stage: string; status: 'SUCCESS' | 'FAILED' | 'STALE' | 'REPAIR_EVIDENCE'; durationMs: number; memoryDeltaMb: number }[];
  performanceMetrics: {
    loadTimeMs: number;
    regenerationTimeMs: number;
    interactionLatencyMs: number;
    fps: number;
    undoTimeMs: number;
    redoTimeMs: number;
    switchConfigTimeMs: number;
  };
  resourceMetrics: {
    peakCpuUsage: number;
    peakRamMb: number;
    gpuVramUsedMb: number;
  };
  integrityResults: {
    geometryIntegrity: boolean;
    topologyConsistency: boolean;
    referenceValidation: boolean;
    featureValidation: boolean;
    massVerified: boolean;
  };
  regressionResults: {
    isRegressionDetected: boolean;
    regressionMagnitude: number; // percentage slower
    isCritical: boolean;
  };
  qualificationScope: string;
  verdict: 'PASS' | 'FAIL' | 'INCONCLUSIVE';
  timestamp: string;
}

export interface LargeModelClaimId {
  claimId: string;
  statement: string;
  evidencePackageId: string;
  status: 'VERIFIED' | 'UNVERIFIED';
}
