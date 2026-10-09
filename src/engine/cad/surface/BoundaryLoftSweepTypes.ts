/**
 * SECP CAD Kernel — Boundary, Loft, & Sweep Surface Types
 * PATCH-204: Phase 18 — Professional Modeling
 */

import { Point, Vector, Curve } from '../../cad-kernel/geometry/GeometryContracts';
import { BRepNURBSSurface } from '../../cad-kernel/geometry/BRepGeometry';
import { NURBSSurfaceData } from '../nurbs/NURBSTypes';

// --- Diagnostic & Error Types ---

export type SurfaceConstructionErrorCode =
  | 'SURFACE_CONSTRUCTION_REJECTED'
  | 'BOUNDARY_ORIENTATION_CONFLICT'
  | 'LOFT_FAILED'
  | 'SECTION_DISCONTINUITY'
  | 'INVALID_PARAMETERIZATION'
  | 'GUIDE_CURVE_MISMATCH'
  | 'SELF_INTERSECTION'
  | 'DEGENERATE_SECTION'
  | 'EXCESSIVE_CURVATURE'
  | 'NUMERICAL_CONDITIONING_FAILURE'
  | 'SWEEP_SELF_INTERSECTION'
  | 'RAIL_VALIDATION_FAILED';

export class SurfaceConstructionError extends Error {
  constructor(
    public code: SurfaceConstructionErrorCode,
    message: string,
    public details?: any
  ) {
    super(`[${code}] ${message}`);
    this.name = 'SurfaceConstructionError';
  }
}

// --- Industrial OS Event Types ---

export type SurfaceIndustrialEventType =
  | 'BOUNDARY_SURFACE_CREATED'
  | 'BOUNDARY_SURFACE_MODIFIED'
  | 'LOFT_CREATED'
  | 'LOFT_SECTION_CHANGED'
  | 'LOFT_GUIDE_CHANGED'
  | 'SWEEP_CREATED'
  | 'SWEEP_PROFILE_CHANGED'
  | 'SWEEP_PATH_CHANGED'
  | 'SWEEP_RAIL_CHANGED'
  | 'SURFACE_REBUILT'
  | 'SURFACE_INVALIDATED'
  | 'SURFACE_VALIDATED'
  | 'SURFACE_SEWN';

export interface SurfaceIndustrialEvent {
  eventId: string;
  type: SurfaceIndustrialEventType;
  featureId: string;
  timestamp: string;
  revision: number;
  inputHash: string;
  outputHash: string;
  payload: any;
  evidence: {
    status: 'VALID' | 'INVALIDATED' | 'RECOMPUTED';
    statusMessage?: string;
  };
}

// --- Parameterization & Frame Options ---

export type LoftParameterizationType = 'UNIFORM' | 'CHORD_LENGTH' | 'CENTRIPETAL' | 'CUSTOM';

export type SweepOrientationMode =
  | 'FIXED'
  | 'FRENET'
  | 'PARALLEL_TRANSPORT'
  | 'NORMAL_TO_PATH'
  | 'CUSTOM';

export type LoftEndConditionType =
  | 'FREE'
  | 'TANGENT'
  | 'NORMAL_TO_PROFILE'
  | 'CURVATURE_CONTINUOUS';

export interface LoftEndCondition {
  type: LoftEndConditionType;
  tangentMagnitude?: number;
  customVector?: Vector;
}

export type TwistLawType = 'CONSTANT' | 'LINEAR' | 'CUSTOM';

export interface TwistLaw {
  type: TwistLawType;
  angleStartDeg: number;
  angleEndDeg: number;
  customLawFn?: (u: number) => number; // Returns angle in radians
}

export type ScaleLawType = 'CONSTANT' | 'LINEAR' | 'CUSTOM';

export interface ScaleLaw {
  type: ScaleLawType;
  scaleStart: number;
  scaleEnd: number;
  customLawFn?: (u: number) => number; // Returns scale multiplier
}

// --- Options Interfaces ---

export interface BoundarySurfaceOptions {
  tolerance?: number;
  reorientIfNecessary?: boolean;
  uGridDensity?: number;
  vGridDensity?: number;
  surfaceDegree?: number;
}

export interface LoftSurfaceOptions {
  parameterization?: LoftParameterizationType;
  guides?: Curve[];
  startCondition?: LoftEndCondition;
  endCondition?: LoftEndCondition;
  isClosed?: boolean;
  isPeriodic?: boolean;
  tolerance?: number;
  uSamples?: number;
  vDegree?: number;
}

export interface SweepSurfaceOptions {
  orientationMode?: SweepOrientationMode;
  twistLaw?: TwistLaw;
  scaleLaw?: ScaleLaw;
  rails?: Curve[];
  tolerance?: number;
  uSamples?: number;
  vSamples?: number;
}

// --- Quality & Stitching Types ---

export interface SurfaceQualityReport {
  surfaceId: string;
  isClosed: boolean;
  hasSelfIntersections: boolean;
  hasFoldOver: boolean;
  minCurvature: number;
  maxCurvature: number;
  curvatureOscillations: number;
  inflectionAnomalies: number;
  controlNetIrregularities: number;
  continuityGrade: 'C0' | 'C1' | 'C2' | 'G0' | 'G1' | 'G2';
  isValid: boolean;
  diagnostics: string[];
}

export interface SewResult {
  shellId: string;
  surfacesCount: number;
  isClosedShell: boolean;
  matchedEdgesCount: number;
  maxGapDistance: number;
  isSolid: boolean;
  topologyHash: string;
}

// --- Feature Records ---

export type SurfaceFeatureType = 'BOUNDARY_SURFACE' | 'LOFT_SURFACE' | 'SWEEP_SURFACE' | 'SEW_SURFACES';

export interface SurfaceFeatureRecord {
  featureId: string;
  name: string;
  type: SurfaceFeatureType;
  inputs: Record<string, any>;
  suppressed: boolean;
  revision: number;
  timestamp: string;
  status: 'VALID' | 'INVALIDATED' | 'FAILED';
  errorMessage?: string;
  outputSurface?: BRepNURBSSurface;
  outputData?: NURBSSurfaceData;
}
