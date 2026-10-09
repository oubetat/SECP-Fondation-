/**
 * SECP CAD Kernel — Sketch Arc
 * Phase 2 (PATCH-024)
 */

import { Point2D } from './SketchGeometry';

export interface ArcGeometry {
  readonly type: 'ARC';
  readonly center: Point2D;
  readonly radius: number;
  readonly startAngle: number;
  readonly endAngle: number;
  readonly direction: 'CCW' | 'CW';
}
