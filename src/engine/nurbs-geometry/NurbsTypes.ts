/**
 * PATCH-SECP-074: NURBS & Freeform Surface Types
 * Mathematical definitions for B-Splines, Rational Surfaces, UV spaces, and Trim boundaries.
 */

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export interface ControlPoint3D extends Vector3D {
  w: number; // Rational weight
}

export interface KnotVector {
  knots: number[];
  degree: number;
}

export interface NurbsCurve1D {
  id: string;
  degree: number;
  controlPoints: ControlPoint3D[];
  knots: number[]; // Knot vector length = cp.length + degree + 1
}

export interface NurbsSurface {
  id: string;
  degreeU: number;
  degreeV: number;
  controlPoints: ControlPoint3D[][]; // 2D grid [u][v]
  knotsU: number[];
  knotsV: number[];
  trimCurves?: TrimCurveUV[]; // Boundaries in parameter space
}

export interface TrimCurveUV {
  id: string;
  degree: number;
  controlPointsUV: { u: number; v: number; w: number }[];
  knots: number[];
  isOuterLoop: boolean;
}

export interface SurfaceQualityMetrics {
  maxGaussianCurvature: number;
  minGaussianCurvature: number;
  maxMeanCurvature: number;
  hasC0Discontinuities: boolean;
  hasC1Discontinuities: boolean;
}

export interface BRepShell {
  id: string;
  surfaces: NurbsSurface[];
  edgeStitches: EdgeStitch[];
  isWatertight: boolean;
  isManifold: boolean;
}

export interface EdgeStitch {
  surfaceIdA: string;
  surfaceIdB: string;
  maxDeviation: number;
  isG1Continuous: boolean;
}
