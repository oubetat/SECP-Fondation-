export type SurfaceType321A = 'PLANE' | 'CYLINDER' | 'SPHERE' | 'CONE';

export interface SurfaceParameters321A {
  // Common
  centroid?: [number, number, number];
  
  // Plane
  normal?: [number, number, number];
  d?: number; // n * x + d = 0
  extents?: [number, number]; // [half-width, half-height]

  // Cylinder / Cone
  axisOrigin?: [number, number, number];
  axisDirection?: [number, number, number];
  radius?: number;
  height?: number;

  // Sphere
  center?: [number, number, number];

  // Cone
  apex?: [number, number, number];
  halfAngleDeg?: number;
}

export interface ResidualStatistics321A {
  mean: number;
  stdDev: number;
  percentile90: number;
}

export interface AnalyticalSurface321A {
  surfaceId: string;
  sourceRegionId?: string;
  surfaceType: SurfaceType321A;
  coordinateFrame?: string;
  units?: string;
  parameters: SurfaceParameters321A;
  fittingMethod?: string;
  sampleCount?: number;
  rmsResidual?: number;
  maxResidual?: number;
  residualStatistics?: ResidualStatistics321A;
  confidence?: number;
  validationStatus?: 'VALID' | 'DEGENERATE' | 'UNDER_CONSTRAINED' | 'FIT_FAILED' | 'OUT_OF_TOLERANCE';
  provenance: {
    parentMeshId: string;
    parentRegionId: string;
    fittingAlgorithm?: string;
    timestamp?: string;
    vertexIndices?: number[];
  };
}

export interface AnalyticalReconstructionSettings321A {
  maxRmsToleranceMm: number;
  maxErrorToleranceMm: number;
  minPointsRequired: number;
}
