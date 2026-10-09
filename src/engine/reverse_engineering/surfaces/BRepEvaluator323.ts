import { NURBSSurface322, NURBSSurfaceData322 } from './NURBSTypes322';
import { NURBSUtils322 } from './NURBSUtils322';
import { BRepEdgeCurve, BRepPoint3D, BRepCoEdge } from './BRepReconstructionTypes323';

export class BRepEvaluator323 {
  /**
   * Evaluates a 3D point on a face's underlying NURBS surface.
   */
  public static evaluateFace(surfaceData: NURBSSurfaceData322, u: number, v: number): BRepPoint3D {
    const pt = NURBSUtils322.evaluateSurface(surfaceData, u, v).point;
    return { x: pt[0], y: pt[1], z: pt[2] };
  }

  /**
   * Maps a parameter t in [tMin, tMax] to the UV coordinates on the NURBS surface for a given boundary.
   */
  public static mapEdgeParameterToUV(curve: BRepEdgeCurve, surfaceData: NURBSSurfaceData322, t: number): { u: number, v: number } {
    const u0 = surfaceData.knotsU[0];
    const u1 = surfaceData.knotsU[surfaceData.knotsU.length - 1];
    const v0 = surfaceData.knotsV[0];
    const v1 = surfaceData.knotsV[surfaceData.knotsV.length - 1];

    // Compute normalized fraction s in [0, 1] from parameter t in [tMin, tMax]
    const span = curve.tMax - curve.tMin;
    const s = Math.abs(span) < 1e-12 ? 0 : Math.max(0, Math.min(1, (t - curve.tMin) / span));

    switch (curve.boundaryType) {
      case 'V_MIN':
        return { u: u0 + s * (u1 - u0), v: v0 };
      case 'U_MAX':
        return { u: u1, v: v0 + s * (v1 - v0) };
      case 'V_MAX':
        return { u: u0 + s * (u1 - u0), v: v1 };
      case 'U_MIN':
        return { u: u0, v: v0 + s * (v1 - v0) };
      default:
        throw new Error(`Unsupported boundary type: ${curve.boundaryType}`);
    }
  }

  /**
   * Evaluates the 3D point of an edge at parameter t in [curve.tMin, curve.tMax].
   */
  public static evaluateEdge(curve: BRepEdgeCurve, surfaceData: NURBSSurfaceData322, t: number): BRepPoint3D {
    if (curve.type === 'DEGENERATE') {
      // For degenerate edges (such as sphere/cone apex poles), evaluate at parameter t.
      // All t in [tMin, tMax] should map to the collapsed point.
      const uv = this.mapEdgeParameterToUV(curve, surfaceData, t);
      return this.evaluateFace(surfaceData, uv.u, uv.v);
    }

    const uv = this.mapEdgeParameterToUV(curve, surfaceData, t);
    return this.evaluateFace(surfaceData, uv.u, uv.v);
  }

  /**
   * Evaluates a CoEdge at fraction s in [0, 1], properly accounting for coedge orientation traversal
   * without mutating the underlying canonical edge geometry.
   */
  public static evaluateCoEdgeAtFraction(
    curve: BRepEdgeCurve, 
    surfaceData: NURBSSurfaceData322, 
    coedgeOrientation: 'FORWARD' | 'REVERSED', 
    s: number
  ): BRepPoint3D {
    const clampedS = Math.max(0, Math.min(1, s));
    const effectiveS = coedgeOrientation === 'FORWARD' ? clampedS : (1 - clampedS);
    const t = curve.tMin + effectiveS * (curve.tMax - curve.tMin);
    return this.evaluateEdge(curve, surfaceData, t);
  }

  public static distance3D(p1: BRepPoint3D, p2: BRepPoint3D): number {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    const dz = p1.z - p2.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
}
