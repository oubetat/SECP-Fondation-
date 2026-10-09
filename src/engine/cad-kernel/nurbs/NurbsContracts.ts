/**
 * SECP CAD Kernel — NURBS Contracts
 */
import { Point, Curve, Surface } from '../geometry/GeometryContracts';

export interface NurbsControlPoint extends Point {
  w: number; // weights MUST be explicitly represented
}

export interface NurbsCurve {
  readonly id?: string;
  readonly degree: number;
  readonly knots: readonly number[];
  readonly controlPoints: readonly NurbsControlPoint[];
  readonly isRational?: boolean;
  evaluate?(u: number): Point;
  domain?(): { uMin: number; uMax: number };
}

export interface NurbsSurface {
  readonly id?: string;
  readonly degreeU: number;
  readonly degreeV: number;
  readonly knotsU: readonly number[];
  readonly knotsV: readonly number[];
  readonly controlPoints: readonly NurbsControlPoint[][];
  readonly isRational?: boolean;
  type?: string;
  evaluate?(u: number, v: number): Point;
  domain?(): { uMin: number; uMax: number; vMin: number; vMax: number };
}

export interface NurbsTolerance {
  absolute: number;
  relative: number;
  angular?: number;
}

export interface NurbsValidationError {
  code: string;
  message: string;
  location?: string;
  expected?: any;
  actual?: any;
}

export interface NurbsValidationResult {
  isValid: boolean;
  errors: NurbsValidationError[];
}

export interface NurbsEvaluationResult {
  status: "OK" | "INVALID" | "SINGULAR";
  point: Point;
  parameter?: number;
  u?: number;
  v?: number;
  denominator: number;
  diagnostics?: string[];
}
