/**
 * PHASE 29 — REVERSE ENGINEERING
 * PATCH-316 — Noise Filtering Engine
 * Type Definitions & Data Structures
 * 
 * CORE RULES ENFORCED:
 * - Rule 2 & 3: RAW POINT CLOUD IS IMMUTABLE — MUST NEVER BE OVERWRITTEN.
 * - Rule 4: DERIVED CLEAN DATASET references ParentPointCloudId.
 * - Rule 14: No Hidden Threshold (Explicit parameters in settings & provenance).
 * - Rule 22 & 23: Classification (KEEP, REMOVE, UNCERTAIN) — Conservative filtering.
 * - Rule 35 & 36: GPU Truth Rule — Record actual execution backend (e.g. CPU).
 * - Rule 53: InputCount = OutputCount + RemovedCount.
 */

import { Point3D, PointCloudBounds, PointCloudCoordinateSystem } from '../point_cloud/PointCloudTypes315';

export type FilterType =
  | 'STATISTICAL_OUTLIER'
  | 'RADIUS_OUTLIER'
  | 'SPATIAL_VOXEL'
  | 'RANGE_BOX'
  | 'DENSITY_THRESHOLD';

export type FilterMode = 'PREVIEW' | 'ANALYSIS' | 'APPLY';

export type PointClassification = 'KEEP' | 'REMOVE' | 'UNCERTAIN';

export type ExecutionBackend = 'CPU_SINGLE_THREAD' | 'CPU_WORKER' | 'GPU_ACCELERATED';

export interface PointCloudFilterSettings {
  algorithm: FilterType;
  filterMode: FilterMode;
  
  // Statistical Outlier Removal Parameters
  kNeighbors?: number;            // Default: 20
  stdDevMultiplier?: number;      // Alpha (e.g., 2.0). Threshold = mean + alpha * stdDev
  
  // Radius Outlier Removal Parameters
  searchRadiusMm?: number;        // Radius R in mm (e.g., 5.0)
  minNeighbors?: number;          // Min neighbors count N (e.g., 6)
  
  // Spatial Voxel Grid Downsampling Parameters
  voxelSizeMm?: number;           // Voxel grid leaf size (e.g., 1.0 mm)
  
  // Range Box Parameters
  minBounds?: [number, number, number];
  maxBounds?: [number, number, number];

  // Preservation & Safety Safeguards
  conservativeMode?: boolean;     // If true, UNCERTAIN points are preserved (KEEP)
  edgePreservationRatio?: number; // Protection threshold for sharp features / thin walls
  aggressiveThresholdRatio?: number; // Warning trigger if > 30% points removed (default: 0.30)
  
  // Large Dataset Chunk Settings
  chunkAware?: boolean;
  haloMarginMm?: number;          // Overlap boundary halo to prevent edge artifacts between chunks
  
  // Execution Context
  executionBackendRequested?: ExecutionBackend;
  units: 'mm' | 'cm' | 'm' | 'in' | 'ft' | 'UNIT_UNKNOWN';
}

export interface OutlierMask {
  pointIndex: number;
  classification: PointClassification;
  noiseScore: number;            // Normalized 0.0 (clean) to 1.0 (severe noise)
  reason: string;
  metricValue?: number;          // e.g. mean neighbor distance or neighbor count
}

export interface GeometryPreservationMetrics {
  spatialBoundsDeltaMm: number;
  diagonalChangeMm: number;
  densityRatio: number;          // Output density / Input density
  geometryPreserved: boolean;
  thinFeatureAlert: boolean;
}

export interface FilterProcessingProvenance {
  filterRunId: string;
  parentDatasetId: string;
  algorithm: FilterType;
  algorithmVersion: string;
  executionBackend: ExecutionBackend;
  timestamp: string;
  executionTimeMs: number;
  pointsProcessed: number;
  settingsHash: string;
  outputHash: string;
  filterSettings: PointCloudFilterSettings;
}

export interface NoiseFilteringReport {
  inputPointCount: number;
  outputPointCount: number;
  removedPointCount: number;
  removalRatio: number;
  isAggressiveFilter: boolean;
  globalMeanDistanceMm: number;
  globalStdDevMm: number;
  processingTimeMs: number;
  executionBackend: ExecutionBackend;
  warnings: string[];
  errors: string[];
  preservationMetrics: GeometryPreservationMetrics;
}

export interface FilteredPointCloud {
  datasetId: string;
  parentDatasetId: string;
  filterRunId: string;
  algorithm: FilterType;
  filterSettings: PointCloudFilterSettings;
  
  inputPointCount: number;
  outputPointCount: number;
  removedPointCount: number;
  removalRatio: number;
  
  bounds: PointCloudBounds;
  units: 'mm' | 'cm' | 'm' | 'in' | 'ft' | 'UNIT_UNKNOWN';
  coordinateSystem: PointCloudCoordinateSystem;
  
  points: Point3D[];             // Clean, retained points
  removedPoints: Point3D[];      // Outliers separated for audit/visualization
  outlierMasks: OutlierMask[];
  
  integrityHash: string;         // SHA-256 result hash
  provenance: FilterProcessingProvenance;
  report: NoiseFilteringReport;
  createdAt: string;
}

export interface FilterAnalysisResult {
  estimatedNoiseCount: number;
  estimatedNoiseRatio: number;
  suggestedAlpha: number;
  suggestedRadiusMm: number;
  globalMeanDistanceMm: number;
  globalStdDevMm: number;
  outlierCandidates: OutlierMask[];
  previewSample: {
    cleanCount: number;
    noiseCount: number;
  };
}
