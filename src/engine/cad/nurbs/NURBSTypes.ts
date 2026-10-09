/**
 * SECP CAD Kernel — NURBS Surface Editing Types & Data Models
 * PATCH-203: Phase 18 — Professional Modeling
 */

import { Point } from '../../cad-kernel/geometry/GeometryContracts';

export interface TrimLoop {
  id: string;
  isOuter: boolean;
  curves: {
    start: { u: number; v: number };
    end: { u: number; v: number };
    degree: number;
    controlPoints2D: { u: number; v: number }[];
  }[];
}

export interface NURBSSurfaceData {
  surfaceId?: string;
  id?: string;
  [key: string]: any;
  degreeU: number;
  degreeV: number;
  controlPoints: Point[][];
  weights: number[][];
  knotsU: number[];
  knotsV: number[];
  domainU: [number, number];
  domainV: [number, number];
  trimLoops: TrimLoop[];
  continuity: 'C0' | 'C1' | 'C2' | 'G0' | 'G1' | 'G2';
  tolerance: number;
  coordinateSystem: {
    origin: Point;
    xAxis: Point;
    yAxis: Point;
    zAxis: Point;
  };
  parentFeature?: string;
  dependencies: string[];
  revision: number;
  evidence: {
    createdTimestamp: string;
    lastModifiedTimestamp: string;
    geometryHash: string;
    topologyHash: string;
    status: 'VALID' | 'TRIM_INVALIDATED' | 'GEOMETRY_INVALIDATED' | 'OUT_OF_TOLERANCE';
  };
}

export interface ControlNetSelection {
  selectedPoints: { i: number; j: number }[];
  selectedRowsU: number[];
  selectedColsV: number[];
  boxSelection?: { minU: number; maxU: number; minV: number; maxV: number };
}

export interface TransformationMatrix {
  elements: number[]; // 4x4 matrix row-major
}

export interface DeviationAnalysis {
  maxDeviation: number;
  meanDeviation: number;
  rmsDeviation: number;
  isWithinTolerance: boolean;
  status: 'WITHIN_TOLERANCE' | 'OUT_OF_TOLERANCE' | 'INVALID_COMPARISON';
  deviationPoints: { u: number; v: number; deviation: number }[];
}

export interface CurvatureAnalysis {
  gaussianCurvature: number;
  meanCurvature: number;
  principalCurvatures: [number, number];
  principalDirections: [{ x: number; y: number; z: number }, { x: number; y: number; z: number }];
  normal: Point;
  fundamentalForms?: {
    first: { E: number; F: number; G: number };
    second: { e: number; f: number; g: number };
  };
  classification?: 'ELLIPTIC' | 'HYPERBOLIC' | 'PARABOLIC' | 'PLANAR' | 'SINGULAR';
  continuity: 'C0' | 'C1' | 'C2' | 'G0' | 'G1' | 'G2';
}

export interface CurvatureCombData {
  isoParameter: number;
  direction: 'U' | 'V';
  samples: {
    u: number;
    v: number;
    point: Point;
    curvatureVector: Point;
    magnitude: number;
  }[];
  maxCurvatureSpike: number;
  isFair: boolean;
}

export interface ZebraAnalysisData {
  stripeFrequency: number;
  lightDirections: Point[];
  intensityMap: { u: number; v: number; intensity: number }[];
  visualContinuityConfirmed: boolean;
}

export interface ContinuityCheckResult {
  positionMaxError: number;
  tangentMaxAngleDeg: number;
  curvatureMaxDifference: number;
  achievedContinuity: 'C0' | 'C1' | 'C2' | 'G0' | 'G1' | 'G2' | 'DISCONTINUOUS';
  meetsTarget: boolean;
}

export interface STEPIGESFidelityReport {
  surfaceType: string;
  degreeU: number;
  degreeV: number;
  controlPointCount: number;
  weightsMatched: boolean;
  knotsMatched: boolean;
  trimBoundariesPreserved: boolean;
  topologyMatched: boolean;
  maxRoundTripDeviation: number;
  fidelityStatus: 'EXACT_MATCH' | 'HIGH_FIDELITY' | 'FIDELITY_LOSS';
  stepRepresentationString: string;
}

export type NurbsOperationType =
  | 'CREATE'
  | 'MOVE_CONTROL_POINTS'
  | 'TRANSFORM'
  | 'CHANGE_WEIGHT'
  | 'ELEVATE_DEGREE'
  | 'REDUCE_DEGREE'
  | 'INSERT_KNOT'
  | 'REMOVE_KNOT'
  | 'REFINE_KNOTS'
  | 'FAIRING'
  | 'ENFORCE_SYMMETRY'
  | 'TRIM_UPDATE'
  | 'CONTINUITY_ALIGN';

export interface NurbsFeatureRecord {
  featureId: string;
  name: string;
  type: NurbsOperationType;
  parameters: any;
  suppressed: boolean;
  timestamp: string;
  outputRevision: number;
}

export type IndustrialEventType =
  | 'NURBS_SURFACE_CREATED'
  | 'NURBS_CONTROL_POINT_MOVED'
  | 'NURBS_WEIGHT_CHANGED'
  | 'NURBS_DEGREE_CHANGED'
  | 'NURBS_KNOT_INSERTED'
  | 'NURBS_KNOT_REMOVED'
  | 'NURBS_SURFACE_REFINED'
  | 'NURBS_SURFACE_FAIRING'
  | 'NURBS_SURFACE_INVALIDATED'
  | 'NURBS_SURFACE_RECOMPUTED';

export interface IndustrialOSEvent {
  eventId: string;
  type: IndustrialEventType;
  surfaceId: string;
  timestamp: string;
  payload: any;
  evidenceHash: string;
}
