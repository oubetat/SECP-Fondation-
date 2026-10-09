/**
 * SECP CAD Kernel — Sketch Geometry Primitives
 * Phase 2 (PATCH-024)
 */

export interface Point2D {
  readonly x: number;
  readonly y: number;
}

export interface Vector2D {
  readonly x: number;
  readonly y: number;
}

export interface Vector3D {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export type SketchGeometryType =
  | 'POINT'
  | 'LINE'
  | 'ARC'
  | 'CIRCLE'
  | 'ELLIPSE'
  | 'POLYLINE'
  | 'SPLINE';

import { PointGeometry } from './SketchPoint';
import { LineGeometry } from './SketchLine';
import { ArcGeometry } from './SketchArc';
import { CircleGeometry } from './SketchCircle';
import { EllipseGeometry } from './SketchEllipse';
import { PolylineGeometry } from './SketchPolyline';
import { SplineGeometry } from './SketchSpline';

export type SketchGeometry =
  | PointGeometry
  | LineGeometry
  | ArcGeometry
  | CircleGeometry
  | EllipseGeometry
  | PolylineGeometry
  | SplineGeometry;
