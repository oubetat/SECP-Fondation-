/**
 * PHASE 29 — REVERSE ENGINEERING
 * PATCH-318 — Scan-to-Mesh Engine Types & Interfaces
 * 
 * DATATYPES:
 * - Registered Point Cloud (Input) -> Derived ScanMeshDataset (Output)
 * - Triangulated Mesh Model: Vertices, Triangles, Half-Edges, Adjacency Maps
 * - Normal Estimation & Orientation Confidence
 * - Topology Validation (Manifold, Boundaries, Watertightness, Degeneracy)
 * - Point-to-Mesh Deviation Analysis & Quality Metrics
 * - Evidence & Provenance Traceability Chain
 */

import { Point3D } from '../point_cloud/PointCloudTypes315';
import { RegisteredPointCloud } from '../registration/PointCloudRegistrationTypes317';

export type MeshReconstructionMode = 'BALL_PIVOTING' | 'ALPHA_SHAPE' | 'DELAUNAY_25D' | 'POISSON_SURFACE';

export type ExecutionBackend = 'CPU_SINGLE_THREAD' | 'CPU_MULTI_THREAD' | 'WASM' | 'WEBGPU';

export type ReconstructionStatus = 'PREPARED' | 'RECONSTRUCTING' | 'VALIDATED' | 'COMMITTED' | 'PARTIAL' | 'FAILED' | 'CANCELLED';

export interface PointNormal318 {
  nx: number;
  ny: number;
  nz: number;
  confidence: number; // 0.0 - 1.0 based on PCA anisotropy
  isOriented: boolean;
}

export interface Vertex318 {
  vertexId: number;
  x: number;
  y: number;
  z: number;
  normal?: PointNormal318;
  sourceType: 'MEASURED' | 'DERIVED' | 'INTERPOLATED';
  sourcePointIndex?: number; // Traceability back to registered point cloud
  confidence: number;
}

export interface Triangle318 {
  triangleId: number;
  v0: number; // Index into vertices array
  v1: number;
  v2: number;
  normal: [number, number, number];
  area: number;
  isDegenerate: boolean;
  isInterpolated: boolean; // True if bridging occluded/unmeasured gap
}

export interface HalfEdge318 {
  edgeId: string;
  vStart: number;
  vEnd: number;
  triangleIndices: number[]; // Triangles sharing this directed edge
}

export interface ScanToMeshSettings {
  algorithm: MeshReconstructionMode;
  ballRadiusMm?: number; // For Ball Pivoting Algorithm
  alphaRadiusMm?: number; // For Alpha Shape
  knnNeighbors?: number; // For normal estimation PCA (default 10)
  enableNormalReorientation?: boolean;
  sharpEdgePreservation?: boolean;
  allowHoleFilling?: boolean; // Explicit optional hole filling
  maxFillHoleRadiusMm?: number;
  cleanupDegenerateTriangles?: boolean;
  engineeringToleranceMm: number; // Explicit tolerance (e.g., 0.05 mm)
  units: 'mm' | 'm' | 'in';
  executionBackend: ExecutionBackend;
}

export interface MeshTopologyMetrics {
  vertexCount: number;
  triangleCount: number;
  edgeCount: number;
  boundaryEdgeCount: number;
  nonManifoldEdgeCount: number;
  duplicateVertexCount: number;
  duplicateTriangleCount: number;
  degenerateTriangleCount: number;
  connectedComponentsCount: number;
  isManifold: boolean;
  isWatertight: boolean;
  hasOpenBoundaries: boolean;
  minTriangleAreaMm2: number;
  maxTriangleAreaMm2: number;
  meanTriangleAreaMm2: number;
  aspectRatioMin: number;
  aspectRatioMax: number;
  aspectRatioMean: number;
}

export interface MeshDeviationReport {
  referenceDatasetId: string;
  meshDatasetId: string;
  pointCountEvaluated: number;
  meanDeviationMm: number;
  rmseMm: number;
  medianDeviationMm: number;
  maxDeviationMm: number;
  percentile90DeviationMm: number;
  stdDevMm: number;
  outOfToleranceCount: number;
  toleranceMm: number;
}

export interface MeshSourceMap {
  vertexSourceIndices: Map<number, number>; // VertexId -> Original Point Index
  triangleAlgorithms: Map<number, string>; // TriangleId -> Algorithm step
  interpolatedTriangles: number[];
}

export interface MeshProvenance {
  meshId: string;
  parentPointCloudId: string;
  registrationId: string;
  algorithm: MeshReconstructionMode;
  algorithmVersion: string;
  executionBackend: ExecutionBackend;
  timestamp: string;
  executionTimeMs: number;
  settingsHash: string;
  meshHash: string;
  topologyHash: string;
}

export interface ScanMeshDataset {
  meshId: string;
  parentPointCloudId: string;
  registrationId: string;
  vertices: Vertex318[];
  triangles: Triangle318[];
  halfEdges: HalfEdge318[];
  bounds: {
    minX: number; maxX: number;
    minY: number; maxY: number;
    minZ: number; maxZ: number;
    diagonalMm: number;
  };
  units: 'mm' | 'm' | 'in';
  globalCoordinateFrame: string; // Preserves PATCH-317 coordinate frame exactly
  topologyMetrics: MeshTopologyMetrics;
  deviationReport: MeshDeviationReport;
  provenance: MeshProvenance;
  sourceMap: MeshSourceMap;
  status: ReconstructionStatus;
  createdAt: string;
}
