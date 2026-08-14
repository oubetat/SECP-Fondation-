/**
 * SECP-054 Industrial Surface & NURBS / Class-A Geometry Types
 */

import { Vector2D } from '../sketch/IndustrialConstraintTypes';

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export interface NurbsCurveDefinition {
  id: string;
  name: string;
  degree: number;               // p >= 1 (e.g., 3 for cubic)
  controlPoints: Vector3D[];   // P_i
  weights: number[];            // w_i (for rational NURBS)
  knots: number[];              // U = [u_0, ..., u_{m}] where m = n + p + 1
  isRational: boolean;
  isPeriodic: boolean;
  unit: string;                 // e.g., 'mm'
}

export interface NurbsSurfaceDefinition {
  id: string;
  name: string;
  degreeU: number;
  degreeV: number;
  controlPoints: Vector3D[][]; // Matrix [u][v]
  weights: number[][];          // Matrix [u][v]
  knotsU: number[];
  knotsV: number[];
  isRational: boolean;
  isPeriodicU: boolean;
  isPeriodicV: boolean;
  trimmed: boolean;
  trimmingLoops?: { points: Vector2D[] }[];
  unit: string;                 // e.g., 'mm'
}

export type SurfaceOperationType =
  | 'EXTRUDE'
  | 'REVOLVE'
  | 'LOFT'
  | 'SWEEP'
  | 'OFFSET'
  | 'FILLET_BLEND'
  | 'TRIM'
  | 'SPLIT'
  | 'SEW'
  | 'EXTEND'
  | 'SURFACE_TO_SOLID';

export interface SurfaceOperationParams {
  opType: SurfaceOperationType;
  sourceSurfaceIds: string[];
  guideCurveIds?: string[];
  distanceMm?: number;
  angleDeg?: number;
  blendRadiusMm?: number;
  thicknessMm?: number;
  toleranceMm?: number;
}

export type ContinuityType = 'G0' | 'G1' | 'G2';

export interface SurfaceContinuityReport {
  patchAId: string;
  patchBId: string;
  sharedEdgeId: string;
  isG0Satisfied: boolean;
  maxG0PositionGapMm: number;
  g0ToleranceMm: number;
  isG1Satisfied: boolean;
  maxG1TangentAngleDeg: number;
  g1ToleranceDeg: number;
  isG2Satisfied: boolean;
  maxG2CurvatureDev: number;
  g2Tolerance: number;
  passedContinuity: ContinuityType;
}

export interface ZebraStripesAnalysis {
  stripeCount: number;
  stripeAngleDeg: number;
  reflectionSmoothness: number; // 0.0 to 1.0
  discontinuityCount: number;
  isClassACompliant: boolean;
}

export interface CurvatureAnalysisReport {
  minRadiusMm: number;
  maxGaussianCurvature: number;
  maxMeanCurvature: number;
  fairnessScore: number;       // Lower is smoother (0.0 to 100.0)
  inflectionPointCount: number;
}

export interface ClassASurfaceQualityReport {
  surfaceId: string;
  geometricValidity: boolean;
  continuity: SurfaceContinuityReport;
  curvature: CurvatureAnalysisReport;
  zebra: ZebraStripesAnalysis;
  manufacturingSuitability: {
    minToolRadiusMm: number;
    minDraftAngleDeg: number;
    isManufacturable: boolean;
  };
  overallQualityGrade: 'CLASS_A' | 'INDUSTRIAL_A' | 'STANDARD_B' | 'NON_COMPLIANT';
  signature: string;
}

export interface SurfaceProvenanceRecord {
  systemVersion: string;
  timestamp: string;
  surfaceRevision: number;
  surfaceGraphHash: string;
  topologyIdentityHash: string;
  continuityGrade: 'G0' | 'G1' | 'G2';
  classACompliant: boolean;
  resultHash: string;
  signature: string;
}
