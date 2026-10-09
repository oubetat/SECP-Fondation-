/**
 * SECP CAD Kernel — Sketch Ellipse
 * Phase 2 (PATCH-024)
 */

import { Point2D } from './SketchGeometry';

export interface EllipseGeometry {
  readonly type: 'ELLIPSE';
  readonly center: Point2D;
  readonly majorRadius: number;
  readonly minorRadius: number;
  readonly rotation: number;
}
