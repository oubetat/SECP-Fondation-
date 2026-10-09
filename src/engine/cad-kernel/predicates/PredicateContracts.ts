/**
 * SECP CAD Kernel — Geometric Predicate Contracts
 * Phase 2 (PATCH-018): Low-level geometric decision layer
 */
import { Point, Vector, Direction, Plane, BoundingBox } from '../geometry/GeometryContracts';

export type PredicateSemantics = 'EXACT' | 'ROBUST_NUMERICAL' | 'TOLERANCE_BASED';

export type GeneralClassification = 'TRUE' | 'FALSE' | 'INDETERMINATE' | 'INVALID';

export type Orientation2DClassification = 
  | 'CLOCKWISE' 
  | 'COUNTERCLOCKWISE' 
  | 'COLLINEAR' 
  | 'INDETERMINATE' 
  | 'INVALID';

export type Orientation3DClassification = 
  | 'POSITIVE' 
  | 'NEGATIVE' 
  | 'COPLANAR' 
  | 'INDETERMINATE' 
  | 'INVALID';

export type CollinearityClassification = 
  | 'TRUE_COLLINEAR' 
  | 'NOT_COLLINEAR' 
  | 'INDETERMINATE' 
  | 'INVALID';

export type CoplanarityClassification = 
  | 'COPLANAR' 
  | 'NOT_COPLANAR' 
  | 'INDETERMINATE' 
  | 'INVALID';

export type LineLineRelation3D = 
  | 'PARALLEL' 
  | 'COINCIDENT' 
  | 'INTERSECTING' 
  | 'SKEW' 
  | 'DEGENERATE' 
  | 'INDETERMINATE' 
  | 'INVALID';

export type PlanePlaneRelation = 
  | 'COINCIDENT' 
  | 'PARALLEL_DISTINCT' 
  | 'INTERSECTING' 
  | 'INDETERMINATE' 
  | 'INVALID';

export type LinePlaneRelation = 
  | 'INTERSECTS' 
  | 'PARALLEL' 
  | 'COPLANAR' 
  | 'INDETERMINATE' 
  | 'INVALID';

export type PointPlaneClassification = 
  | 'POSITIVE_SIDE' 
  | 'NEGATIVE_SIDE' 
  | 'ON_PLANE' 
  | 'INDETERMINATE' 
  | 'INVALID';

export type ContainmentClassification = 
  | 'INSIDE' 
  | 'OUTSIDE' 
  | 'BOUNDARY' 
  | 'INDETERMINATE' 
  | 'INVALID';

export type SegmentRelation2D = 
  | 'DISJOINT' 
  | 'PROPER_INTERSECTION' 
  | 'TOUCHING' 
  | 'OVERLAPPING' 
  | 'COLLINEAR_DISJOINT' 
  | 'INDETERMINATE' 
  | 'INVALID';

export type SegmentRelation3D = 
  | 'DISJOINT' 
  | 'INTERSECTING' 
  | 'COLLINEAR_OVERLAP' 
  | 'SKEW' 
  | 'INDETERMINATE' 
  | 'INVALID';

export type NurbsPointClassification = 
  | 'EXACT_ON' 
  | 'WITHIN_TOLERANCE' 
  | 'OUTSIDE_TOLERANCE' 
  | 'INDETERMINATE' 
  | 'INVALID';

export interface GeometricPredicateResult<TClassification extends string = GeneralClassification, TValue = any> {
  readonly classification: TClassification;
  readonly value?: TValue;
  readonly semantics: PredicateSemantics;
  readonly conditionNumber?: number;
  readonly diagnostics: readonly string[];
}

export interface Line3D {
  readonly origin: Point;
  readonly direction: Direction;
}

export interface Ray3D {
  readonly origin: Point;
  readonly direction: Direction;
}

export interface Segment3D {
  readonly start: Point;
  readonly end: Point;
}

export interface Segment2D {
  readonly start: { x: number; y: number };
  readonly end: { x: number; y: number };
}

export interface Triangle2D {
  readonly a: { x: number; y: number };
  readonly b: { x: number; y: number };
  readonly c: { x: number; y: number };
}

export interface Triangle3D {
  readonly a: Point;
  readonly b: Point;
  readonly c: Point;
}
