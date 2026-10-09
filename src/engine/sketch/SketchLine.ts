/**
 * SECP CAD Kernel — Sketch Line
 * Phase 2 (PATCH-024)
 */

import { Point2D } from './SketchGeometry';

export interface LineGeometry {
  readonly type: 'LINE';
  readonly start: Point2D;
  readonly end: Point2D;
}
