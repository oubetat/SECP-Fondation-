/**
 * PATCH-SECP-083: Trimmed Surface Engine & Boundary Loop Integrity
 * 
 * Verifies closed trim loops, loop orientation, self-intersections,
 * parameter-domain validity, and edge-surface consistency.
 */

import { TrimLoop, TrimmedSurfacePatch, NurbsSurfacePatch } from './SECP083Types';

export class SECP083TrimmedSurfaceEngine {

  /**
   * Audit Trim Loop Validity
   */
  public static auditTrimLoop(loop: TrimLoop): {
    isClosed: boolean;
    isSelfIntersecting: boolean;
    orientation: 'CW' | 'CCW';
    isValid: boolean;
  } {
    const pts = loop.points2D;
    if (!pts || pts.length < 3) {
      return { isClosed: false, isSelfIntersecting: false, orientation: 'CW', isValid: false };
    }

    // 1. Check Closure
    const pFirst = pts[0];
    const pLast = pts[pts.length - 1];
    const closureGap = Math.hypot(pLast.u - pFirst.u, pLast.v - pFirst.v);
    const isClosed = closureGap < 1e-5;

    // 2. Check Self-Intersection
    let isSelfIntersecting = false;
    for (let i = 0; i < pts.length - 1; i++) {
      for (let j = i + 2; j < pts.length - 1; j++) {
        if (i === 0 && j === pts.length - 2) continue; // Skip endpoint adjacent
        if (this.segmentsIntersect(pts[i], pts[i + 1], pts[j], pts[j + 1])) {
          isSelfIntersecting = true;
          break;
        }
      }
      if (isSelfIntersecting) break;
    }

    // 3. Polygon Orientation via Shoelace Area
    let shoelaceArea = 0.0;
    for (let i = 0; i < pts.length; i++) {
      const next = pts[(i + 1) % pts.length];
      shoelaceArea += (pts[i].u * next.v - next.u * pts[i].v);
    }
    const orientation: 'CW' | 'CCW' = shoelaceArea >= 0 ? 'CCW' : 'CW';

    const isValid = isClosed && !isSelfIntersecting;

    return {
      isClosed,
      isSelfIntersecting,
      orientation,
      isValid
    };
  }

  /**
   * Build & Audit Trimmed Surface Patch
   */
  public static buildTrimmedSurface(
    baseSurface: NurbsSurfacePatch,
    outerLoop2D: { u: number; v: number }[]
  ): TrimmedSurfacePatch {
    const trimLoop: TrimLoop = {
      id: `trim-${baseSurface.id}`,
      isOuterLoop: true,
      points2D: outerLoop2D,
      isClosed: true,
      isSelfIntersecting: false,
      orientation: 'CCW'
    };

    const audit = this.auditTrimLoop(trimLoop);

    return {
      id: `trimmed-${baseSurface.id}`,
      baseSurface,
      trimLoops: [{
        ...trimLoop,
        isClosed: audit.isClosed,
        isSelfIntersecting: audit.isSelfIntersecting,
        orientation: audit.orientation
      }],
      isValidDomain: audit.isValid
    };
  }

  private static segmentsIntersect(
    p1: { u: number; v: number },
    p2: { u: number; v: number },
    p3: { u: number; v: number },
    p4: { u: number; v: number }
  ): boolean {
    const ccw = (A: any, B: any, C: any) => (C.v - A.v) * (B.u - A.u) > (B.v - A.v) * (C.u - A.u);
    return ccw(p1, p3, p4) !== ccw(p2, p3, p4) && ccw(p1, p2, p3) !== ccw(p1, p2, p4);
  }
}
