/**
 * SECP CAD Kernel — Sketch Spline
 * Phase 2 (PATCH-024)
 */

import { Point2D } from './SketchGeometry';

export interface SplineGeometry {
  readonly type: 'SPLINE';
  readonly degree: number;
  readonly controlPoints: readonly Point2D[];
  readonly knots: readonly number[];
  readonly weights?: readonly number[];
  readonly periodic: boolean;
}
