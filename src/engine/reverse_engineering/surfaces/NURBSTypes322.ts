
export interface NURBSPoint322 {
  x: number;
  y: number;
  z: number;
}

export interface NURBSSurfaceData322 {
  degreeU: number;
  degreeV: number;
  knotsU: number[];
  knotsV: number[];
  controlPoints: NURBSPoint322[][]; // Grid [u][v]
  weights: number[][]; // Grid [u][v]
  isRational: boolean;
}

export interface NURBSSurface322 {
  surfaceId: string;
  sourceSurfaceId: string; // From 321A
  data: NURBSSurfaceData322;
  reconstructionMethod: 'EXACT_ANALYTICAL_CONVERSION' | 'APPROXIMATION_FIT';
  maxDeviationMm: number;
  rmsDeviationMm: number;
  confidence: number;
  validationStatus: 'VALID' | 'INVALID' | 'SUSPECT';
  provenance: {
    parentMeshId: string;
    parentRegionId: string;
    sourceSurfaceType: string;
    timestamp: string;
  };
}

export interface NURBSEvaluationResult322 {
  point: [number, number, number];
  normal: [number, number, number];
}
