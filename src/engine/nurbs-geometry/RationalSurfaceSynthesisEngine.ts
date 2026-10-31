import { NurbsSurface, ControlPoint3D } from './NurbsTypes';
import { CoxDeBoorEvaluatorEngine } from './CoxDeBoorEvaluatorEngine';

export class RationalSurfaceSynthesisEngine {
  /**
   * Evaluates a rational B-spline (NURBS) surface point S(u, v) using Cox-de Boor basis functions.
   * Based on Piegl & Tiller, The NURBS Book, Algorithm A4.3 (SurfacePoint).
   */
  public static evaluatePoint(
    surface: NurbsSurface,
    u: number,
    v: number
  ): { x: number; y: number; z: number } {
    const pU = surface.degreeU;
    const pV = surface.degreeV;
    const knotsU = surface.knotsU;
    const knotsV = surface.knotsV;
    const cp = surface.controlPoints;

    if (!cp || cp.length === 0 || !cp[0] || cp[0].length === 0) {
      return { x: 0, y: 0, z: 0 };
    }

    // Clamp u and v to valid knot domain
    const uMin = knotsU[pU];
    const uMax = knotsU[knotsU.length - 1 - pU];
    const vMin = knotsV[pV];
    const vMax = knotsV[knotsV.length - 1 - pV];

    const clampedU = Math.min(Math.max(u, uMin), uMax);
    const clampedV = Math.min(Math.max(v, vMin), vMax);

    const spanU = CoxDeBoorEvaluatorEngine.findKnotSpan(clampedU, pU, knotsU);
    const Nu = CoxDeBoorEvaluatorEngine.evaluateBasisFunctions(clampedU, pU, knotsU);

    const spanV = CoxDeBoorEvaluatorEngine.findKnotSpan(clampedV, pV, knotsV);
    const Nv = CoxDeBoorEvaluatorEngine.evaluateBasisFunctions(clampedV, pV, knotsV);

    let swX = 0;
    let swY = 0;
    let swZ = 0;
    let swW = 0;

    for (let l = 0; l <= pV; l++) {
      let tempX = 0;
      let tempY = 0;
      let tempZ = 0;
      let tempW = 0;
      const colIdx = spanV - pV + l;

      for (let k = 0; k <= pU; k++) {
        const rowIdx = spanU - pU + k;
        const pt = cp[rowIdx]?.[colIdx] || { x: 0, y: 0, z: 0, w: 1.0 };
        const w = (pt as any).w ?? 1.0;
        const basisU = Nu[k];

        tempX += basisU * pt.x * w;
        tempY += basisU * pt.y * w;
        tempZ += basisU * pt.z * w;
        tempW += basisU * w;
      }

      const basisV = Nv[l];
      swX += basisV * tempX;
      swY += basisV * tempY;
      swZ += basisV * tempZ;
      swW += basisV * tempW;
    }

    if (Math.abs(swW) < 1e-12) {
      return { x: swX, y: swY, z: swZ };
    }

    return {
      x: swX / swW,
      y: swY / swW,
      z: swZ / swW
    };
  }
}

