/**
 * SECP CAD Kernel — Sketch Coordinate System
 * Phase 2 (PATCH-024)
 */

import { Point2D, Vector2D, Vector3D } from './SketchGeometry';

/**
 * Represents the 2D parametric plane where sketch geometry lives.
 */
export interface SketchCoordinateSystem {
  readonly origin: Point2D;
  readonly xAxis: Vector2D;
  readonly yAxis: Vector2D;
  readonly normal: Vector3D;
}
