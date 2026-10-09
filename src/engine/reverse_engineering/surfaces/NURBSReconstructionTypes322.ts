export interface NURBSControlPoint {
  x: number;
  y: number;
  z: number;
  weight: number;
}

export interface NURBSSurfaceMetrics {
  fitRmseMm: number;
  maxDeviationMm: number;
  parameterizationQuality: number;
}

export interface NURBSSurfaceProvenance {
  sourceSurfaceId: string;
  algorithm: string;
  timestamp: string;
  isExact: boolean;
}

export interface NURBSSurface {
  surfaceId: string;
  degreeU: number;
  degreeV: number;
  controlPoints: NURBSControlPoint[][];
  knotsU: number[];
  knotsV: number[];
  domainU: [number, number];
  domainV: [number, number];
  isRational: boolean;
  trimLoops: Array<{
    curves: Array<{
      degree: number;
      knots: number[];
      controlPoints: { x: number; y: number; w: number }[];
    }>;
  }>;
  metrics: NURBSSurfaceMetrics;
  provenance: NURBSSurfaceProvenance;
  status: 'CANDIDATE' | 'VALIDATED' | 'REJECTED';
}

export interface NURBSReconstructionSession {
  sessionId: string;
  sourceSurfaceModelId: string;
  surfaces: NURBSSurface[];
  status: 'ANALYZING' | 'FITTING' | 'VALIDATED' | 'COMPLETED' | 'FAILED';
  createdAt: string;
}
