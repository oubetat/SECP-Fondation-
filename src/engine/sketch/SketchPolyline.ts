/**
 * SECP CAD Kernel — Sketch Polyline
 * Phase 2 (PATCH-024)
 */

import { Point2D } from './SketchGeometry';

export interface PolylineGeometry {
  readonly type: 'POLYLINE';
  readonly points: readonly Point2D[];
  readonly closed: boolean;
}
