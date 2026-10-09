/**
 * SECP CAD Kernel — Trim Repair Engine
 * PATCH-205: Phase 18 — Professional Modeling
 *
 * Validates, repairs, and reconstructs trim boundary loops for trimmed surfaces.
 */

import { Point } from '../../../cad-kernel/geometry/GeometryContracts';

export interface UVPoint {
  u: number;
  v: number;
}

export interface TrimLoop {
  loopId: string;
  points: UVPoint[];
  isClosed: boolean;
  isSelfIntersecting: boolean;
  orientation: 'CW' | 'CCW';
}

export class TrimRepairEngine {
  /**
   * Validate a Trim Loop's closure, self-intersection, and orientation
   */
  public static validateTrimLoop(points: UVPoint[], tolerance: number = 1e-4): TrimLoop {
    if (points.length < 3) {
      return {
        loopId: `LOOP_${Math.random().toString(36).substring(2, 8)}`,
        points,
        isClosed: false,
        isSelfIntersecting: false,
        orientation: 'CCW'
      };
    }

    const first = points[0];
    const last = points[points.length - 1];
    const dist = Math.sqrt((first.u - last.u) ** 2 + (first.v - last.v) ** 2);
    const isClosed = dist <= tolerance;

    const isSelfIntersecting = this.checkSelfIntersection(points);
    const orientation = this.calculateOrientation(points);

    return {
      loopId: `LOOP_${Math.random().toString(36).substring(2, 8)}`,
      points,
      isClosed,
      isSelfIntersecting,
      orientation
    };
  }

  /**
   * Heal/Repair an invalid trim loop
   */
  public static repairTrimLoop(points: UVPoint[], tolerance: number = 1e-4): {
    repairedLoop: TrimLoop;
    pointsModified: boolean;
  } {
    if (points.length < 3) {
      // Reconstruct default square boundary loop
      const defaultSquare: UVPoint[] = [
        { u: 0, v: 0 },
        { u: 1, v: 0 },
        { u: 1, v: 1 },
        { u: 0, v: 1 },
        { u: 0, v: 0 }
      ];
      return {
        repairedLoop: this.validateTrimLoop(defaultSquare, tolerance),
        pointsModified: true
      };
    }

    const pts = [...points];

    // Ensure closure
    const first = pts[0];
    const last = pts[pts.length - 1];
    const dist = Math.sqrt((first.u - last.u) ** 2 + (first.v - last.v) ** 2);
    let modified = false;

    if (dist > tolerance) {
      pts.push({ u: first.u, v: first.v });
      modified = true;
    }

    // Clamp UV domain to [0, 1]
    for (let i = 0; i < pts.length; i++) {
      if (pts[i].u < 0 || pts[i].u > 1 || pts[i].v < 0 || pts[i].v > 1) {
        pts[i].u = Math.max(0, Math.min(1, pts[i].u));
        pts[i].v = Math.max(0, Math.min(1, pts[i].v));
        modified = true;
      }
    }

    return {
      repairedLoop: this.validateTrimLoop(pts, tolerance),
      pointsModified: modified
    };
  }

  private static checkSelfIntersection(pts: UVPoint[]): boolean {
    const n = pts.length;
    for (let i = 0; i < n - 1; i++) {
      for (let j = i + 2; j < n - 1; j++) {
        if (i === 0 && j === n - 2) continue; // Connected endpoints
        if (this.segmentsIntersect(pts[i], pts[i + 1], pts[j], pts[j + 1])) {
          return true;
        }
      }
    }
    return false;
  }

  private static calculateOrientation(pts: UVPoint[]): 'CW' | 'CCW' {
    let area = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      area += (pts[i + 1].u - pts[i].u) * (pts[i + 1].v + pts[i].v);
    }
    return area > 0 ? 'CW' : 'CCW';
  }

  private static segmentsIntersect(p1: UVPoint, p2: UVPoint, p3: UVPoint, p4: UVPoint): boolean {
    const ccw = (a: UVPoint, b: UVPoint, c: UVPoint) =>
      (c.v - a.v) * (b.u - a.u) > (b.v - a.v) * (c.u - a.u);

    return (
      ccw(p1, p3, p4) !== ccw(p2, p3, p4) &&
      ccw(p1, p2, p3) !== ccw(p1, p2, p4)
    );
  }
}
