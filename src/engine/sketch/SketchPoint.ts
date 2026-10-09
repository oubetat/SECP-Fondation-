/**
 * SECP CAD Kernel — Sketch Point
 * Phase 2 (PATCH-024)
 */

import { Point2D } from './SketchGeometry';

export interface PointGeometry {
  readonly type: 'POINT';
  readonly x: number;
  readonly y: number;
}
