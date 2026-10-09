/**
 * GPUMeshingTypes.ts
 * Core types, data structures, and verification metrics for GPU Meshing (PATCH-300)
 */

export interface CADSurfaceDefinition {
  surfaceId: string;
  cadFaceId: string;
  type: 'PLANE' | 'CYLINDER' | 'SPHERE' | 'CONE' | 'HIGH_CURVATURE' | 'NURBS';
  uMin: number;
  uMax: number;
  vMin: number;
  vMax: number;
  isPeriodicU?: boolean;
  isPeriodicV?: boolean;
  featureEdges?: Array<{ edgeId: string; isSharp: boolean; curvePoints: number[][] }>;
  parameters?: {
    width?: number;
    height?: number;
    radius?: number;
    amplitude?: number;
    [key: string]: any;
  };
}

export interface CADBRepGeometry {
  geometryId: string;
  name: string;
  revision: string;
  type: string;
  surfaces: CADSurfaceDefinition[];
  boundingBox: { min: [number, number, number]; max: [number, number, number] };
  hasSharpFeatures?: boolean;
  isClosedSolid?: boolean;
  // Legacy fields
  id?: string;
  facesCount?: number;
  verticesCount?: number;
}

export interface GPUMeshData {
  meshId: string;
  geometryId: string;
  geometryRevision: string;
  elementType: 'TRI3' | 'QUAD4' | 'TET4';
  numVertices: number;
  positions: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  numElements: number;
  indices: Uint32Array;
  // Compatibility fields
  nodeCount?: number;
  elementCount?: number;
  aspectRatios?: Float32Array;
}

export interface ElementQualityMetrics {
  aspectRatio: number;
  skewness: number;
  minAngleDeg: number;
  maxAngleDeg: number;
  area: number;
  isDegenerate: boolean;
  isInverted: boolean;
}

export interface MeshQualityReport {
  meshId: string;
  totalElements: number;
  validElements: number;
  degenerateElements: number;
  invertedElements: number;
  aspectRatioStats: { min: number; max: number; mean: number; p95: number };
  skewnessStats: { min: number; max: number; mean: number; p95: number };
  minAngleStats: { min: number; max: number; mean: number };
  maxAngleStats: { min: number; max: number; mean: number };
  histogramBins: Array<{
    metricName: string;
    binEdges: number[];
    counts: number[];
  }>;
  worstElementIndex: number;
  overallStatus: 'PASSED' | 'FAILED';
  // Legacy fields
  minAspectRatio?: number;
  maxAspectRatio?: number;
  meanAspectRatio?: number;
  invertedElementsCount?: number;
  passedQualityCheck?: boolean;
}

export interface MeshBenchmarkMetrics {
  geometryId: string;
  geometryName: string;
  numVertices: number;
  numElements: number;
  cpuTimeMs: number;
  gpuTimeMs: number;
  speedup: number;
  throughputVertsPerSec: number;
  transferOverheadPercent: number;
  memoryAllocatedBytes: number;
  // Legacy fields
  speedupFactor?: number;
  nodeCount?: number;
  elementCount?: number;
}

export interface GeometricDeviationMetrics {
  maxHausdorffDistance: number;
  meanChordalError: number;
  maxChordalError: number;
  boundaryDeviationMax: number;
  featurePreservationScore: number;
}

export interface MeshComparisonResult {
  operatorId: string;
  meshId: string;
  geometryId: string;
  passed: boolean;
  maxAbsoluteError: number;
  relativeL2Error: number;
  topologyEquivalence: boolean;
  qualityDeviation: number;
  geometricDeviation: GeometricDeviationMetrics;
  cpuDurationMs: number;
  gpuDurationMs: number;
  speedup: number;
  // Legacy fields
  equivalent?: boolean;
  maxHausdorffDistance?: number;
  meanNodeDelta?: number;
}

export interface MeshingEvidenceRecord {
  evidenceId: string;
  timestamp: string;
  jobId: string;
  geometryId: string;
  geometryRevision: string;
  meshId: string;
  kernelVersion: string;
  shaderHashes: Record<string, string>;
  gpuDeviceInfo: {
    vendor: string;
    renderer: string;
  };
  metrics: {
    vertices: number;
    elements: number;
    elementType?: string;
    maxChordalError: number;
    worstAspectRatio: number;
    worstSkewness: number;
    invertedCount: number;
  };
  verificationStatus: 'VERIFIED' | 'DISCREPANCY_DETECTED';
  digitalThreadSignatures: {
    geometryHash: string;
    meshHash: string;
    kernelHash: string;
    resultSignature: string;
  };
}

export type MeshKernelType =
  | 'SURFACE_DISCRETIZATION'
  | 'NORMAL_COMPUTATION'
  | 'QUALITY_EVALUATION'
  | 'SPATIAL_PARTITION';
