/**
 * SECP CAD Kernel — Sketch Circle
 * Phase 2 (PATCH-024)
 */

import { Point2D } from './SketchGeometry';

export interface CircleGeometry {
  readonly type: 'CIRCLE';
  readonly center: Point2D;
  readonly radius: number;
}
