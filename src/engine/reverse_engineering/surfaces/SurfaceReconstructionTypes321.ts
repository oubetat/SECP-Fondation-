/**
 * PHASE 29 — REVERSE ENGINEERING
 * PATCH-321 — Surface Reconstruction Types
 */

import { PrimitiveType, EngineeringFeatureType, FittingMetrics, FeatureSourceMap } from '../features/FeatureRecognitionTypes320';

export type SurfaceType = PrimitiveType | 'NURBS' | 'B_SPLINE';

export type ContinuityType = 'C0' | 'C1' | 'C2' | 'DISCONTINUOUS' | 'UNKNOWN';

export interface SurfaceBoundary {
  boundaryId: string;
  edgeIndices: number[];
  curveType: 'LINE' | 'ARC' | 'SPLINE' | 'INTERSECTION';
  continuity: ContinuityType;
  deviationMm: number;
}

export interface ReconstructedSurface {
  surfaceId: string;
  type: SurfaceType;
  parameters: Record<string, number | string | boolean | number[]>;
  metrics: FittingMetrics;
  sourceRegion: FeatureSourceMap;
  boundaries: SurfaceBoundary[];
  quality: {
    parameterizationQuality: number; // 0-1
    boundaryConsistency: number; // 0-1
    continuityStatus: ContinuityType;
  };
  provenance: {
    algorithm: string;
    algorithmVersion: string;
    timestamp: string;
    settingsHash: string;
  };
  status: 'CANDIDATE' | 'VALIDATED' | 'REJECTED';
}

export interface SurfaceNetwork {
  networkId: string;
  surfaces: ReconstructedSurface[];
  intersections: {
    surfaceAId: string;
    surfaceBId: string;
    curveId: string;
    continuity: ContinuityType;
  }[];
  gaps: {
    surfaceAId: string;
    surfaceBId: string;
    maxGapMm: number;
    meanGapMm: number;
  }[];
}

export interface SurfaceReconstructionSession {
  sessionId: string;
  inputMeshId: string;
  inputPointCloudId?: string;
  featureRecognitionSessionId?: string;
  surfaces: ReconstructedSurface[];
  network?: SurfaceNetwork;
  totalAreaAnalyzedMm2: number;
  reconstructedAreaMm2: number;
  status: 'ANALYZING' | 'SEGMENTED' | 'FITTED' | 'RECONSTRUCTED' | 'VALIDATED' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  createdAt: string;
}

export interface SurfaceReconstructionSettings {
  fitToleranceMm: number;
  maxNurbsDegree: number;
  minCoverageRatio: number;
  preserveSharpEdges: boolean;
  continuityRequired: ContinuityType;
  outlierPolicy: 'REJECT' | 'ROBUST_WEIGHT' | 'IGNORE';
}

export interface SurfaceDeviationReport {
  surfaceId: string;
  meanDeviationMm: number;
  rmseMm: number;
  maxDeviationMm: number;
  percentile95Mm: number;
  outOfToleranceCount: number;
  totalSampleCount: number;
}
