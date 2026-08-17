/**
 * PATCH-SECP-083: Class-A Surfacing Core & NURBS Differential Geometry Engine
 * 
 * Provides 100% deterministic evaluation of NURBS / B-Spline surface points,
 * first partial derivatives (dS/du, dS/dv), second partial derivatives (d2S/du2, d2S/dudv, d2S/dv2),
 * unit normal vectors, and parameter domain bounds.
 */

import { NurbsSurfacePatch, SurfaceDerivatives, Vector3D } from './SECP083Types';

export class SECP083ClassASurfaceCore {

  /**
   * Helper: Cox-de Boor B-Spline Basis Function
   */
  public static evaluateBasis(i: number, p: number, u: number, knots: number[]): number {
    if (p === 0) {
      if (u >= knots[i] && u < knots[i + 1]) return 1.0;
      if (u === knots[knots.length - 1] && u === knots[i + 1]) return 1.0; // Right endpoint
      return 0.0;
    }

    let left = 0.0;
    const denom1 = knots[i + p] - knots[i];
    if (denom1 > 1e-12) {
      left = ((u - knots[i]) / denom1) * this.evaluateBasis(i, p - 1, u, knots);
    }

    let right = 0.0;
    const denom2 = knots[i + p + 1] - knots[i + 1];
    if (denom2 > 1e-12) {
      right = ((knots[i + p + 1] - u) / denom2) * this.evaluateBasis(i + 1, p - 1, u, knots);
    }

    return left + right;
  }

  /**
   * Helper: Basis Function Derivative
   */
  public static evaluateBasisDerivative(i: number, p: number, u: number, knots: number[]): number {
    if (p === 0) return 0.0;

    let term1 = 0.0;
    const denom1 = knots[i + p] - knots[i];
    if (denom1 > 1e-12) {
      term1 = (p / denom1) * this.evaluateBasis(i, p - 1, u, knots);
    }

    let term2 = 0.0;
    const denom2 = knots[i + p + 1] - knots[i + 1];
    if (denom2 > 1e-12) {
      term2 = (p / denom2) * this.evaluateBasis(i + 1, p - 1, u, knots);
    }

    return term1 - term2;
  }

  /**
   * Evaluate Surface Point, First and Second Partial Derivatives deterministically
   */
  public static evaluateSurfaceDerivatives(
    surf: NurbsSurfacePatch,
    u: number,
    v: number
  ): SurfaceDerivatives {
    // Clamp u, v to knot domain
    const minU = surf.knotVectorU[surf.degreeU];
    const maxU = surf.knotVectorU[surf.knotVectorU.length - 1 - surf.degreeU];
    const minV = surf.knotVectorV[surf.degreeV];
    const maxV = surf.knotVectorV[surf.knotVectorV.length - 1 - surf.degreeV];

    const clampedU = Math.min(Math.max(u, minU), maxU);
    const clampedV = Math.min(Math.max(v, minV), maxV);

    const numU = surf.controlPoints.length; // Count along U
    const numV = surf.controlPoints[0].length; // Count along V

    let S = { x: 0, y: 0, z: 0 };
    let dS_du = { x: 0, y: 0, z: 0 };
    let dS_dv = { x: 0, y: 0, z: 0 };
    let d2S_du2 = { x: 0, y: 0, z: 0 };
    let d2S_dudv = { x: 0, y: 0, z: 0 };
    let d2S_dv2 = { x: 0, y: 0, z: 0 };
    let totalWeight = 0;

    for (let i = 0; i < numU; i++) {
      const N_i = this.evaluateBasis(i, surf.degreeU, clampedU, surf.knotVectorU);
      const dN_i = this.evaluateBasisDerivative(i, surf.degreeU, clampedU, surf.knotVectorU);

      for (let j = 0; j < numV; j++) {
        const M_j = this.evaluateBasis(j, surf.degreeV, clampedV, surf.knotVectorV);
        const dM_j = this.evaluateBasisDerivative(j, surf.degreeV, clampedV, surf.knotVectorV);

        const w = surf.weights ? surf.weights[i][j] : 1.0;
        const cp = surf.controlPoints[i][j];

        const basis = N_i * M_j * w;
        totalWeight += basis;

        S.x += cp.x * basis;
        S.y += cp.y * basis;
        S.z += cp.z * basis;

        const basis_du = dN_i * M_j * w;
        dS_du.x += cp.x * basis_du;
        dS_du.y += cp.y * basis_du;
        dS_du.z += cp.z * basis_du;

        const basis_dv = N_i * dM_j * w;
        dS_dv.x += cp.x * basis_dv;
        dS_dv.y += cp.y * basis_dv;
        dS_dv.z += cp.z * basis_dv;
      }
    }

    if (totalWeight > 1e-12) {
      S = { x: S.x / totalWeight, y: S.y / totalWeight, z: S.z / totalWeight };
      dS_du = { x: dS_du.x / totalWeight, y: dS_du.y / totalWeight, z: dS_du.z / totalWeight };
      dS_dv = { x: dS_dv.x / totalWeight, y: dS_dv.y / totalWeight, z: dS_dv.z / totalWeight };
    }

    // Finite difference fallback for second derivatives to guarantee non-zero smooth curvature evaluation
    const h = 1e-4;
    const pU_plus = this.evaluateSimplePoint(surf, clampedU + h, clampedV);
    const pU_minus = this.evaluateSimplePoint(surf, clampedU - h, clampedV);
    const pV_plus = this.evaluateSimplePoint(surf, clampedU, clampedV + h);
    const pV_minus = this.evaluateSimplePoint(surf, clampedU, clampedV - h);

    d2S_du2 = {
      x: (pU_plus.x - 2 * S.x + pU_minus.x) / (h * h),
      y: (pU_plus.y - 2 * S.y + pU_minus.y) / (h * h),
      z: (pU_plus.z - 2 * S.z + pU_minus.z) / (h * h)
    };

    d2S_dv2 = {
      x: (pV_plus.x - 2 * S.x + pV_minus.x) / (h * h),
      y: (pV_plus.y - 2 * S.y + pV_minus.y) / (h * h),
      z: (pV_plus.z - 2 * S.z + pV_minus.z) / (h * h)
    };

    const pUV_plus = this.evaluateSimplePoint(surf, clampedU + h, clampedV + h);
    d2S_dudv = {
      x: (pUV_plus.x - pU_plus.x - pV_plus.x + S.x) / (h * h),
      y: (pUV_plus.y - pU_plus.y - pV_plus.y + S.y) / (h * h),
      z: (pUV_plus.z - pU_plus.z - pV_plus.z + S.z) / (h * h)
    };

    // Cross product dS_du x dS_dv
    const normalRaw = {
      x: dS_du.y * dS_dv.z - dS_du.z * dS_dv.y,
      y: dS_du.z * dS_dv.x - dS_du.x * dS_dv.z,
      z: dS_du.x * dS_dv.y - dS_du.y * dS_dv.x
    };

    const mag = Math.hypot(normalRaw.x, normalRaw.y, normalRaw.z);
    const normal = mag > 1e-12 ? {
      x: normalRaw.x / mag,
      y: normalRaw.y / mag,
      z: normalRaw.z / mag
    } : { x: 0, y: 0, z: 1 };

    return {
      point: S,
      dS_du,
      dS_dv,
      d2S_du2,
      d2S_dudv,
      d2S_dv2,
      normal
    };
  }

  public static evaluateSimplePoint(surf: NurbsSurfacePatch, u: number, v: number): Vector3D {
    const numU = surf.controlPoints.length;
    const numV = surf.controlPoints[0].length;

    let S = { x: 0, y: 0, z: 0 };
    let totalWeight = 0;

    for (let i = 0; i < numU; i++) {
      const N_i = this.evaluateBasis(i, surf.degreeU, u, surf.knotVectorU);
      for (let j = 0; j < numV; j++) {
        const M_j = this.evaluateBasis(j, surf.degreeV, v, surf.knotVectorV);
        const w = surf.weights ? surf.weights[i][j] : 1.0;
        const cp = surf.controlPoints[i][j];
        const basis = N_i * M_j * w;
        totalWeight += basis;
        S.x += cp.x * basis;
        S.y += cp.y * basis;
        S.z += cp.z * basis;
      }
    }

    if (totalWeight > 1e-12) {
      return { x: S.x / totalWeight, y: S.y / totalWeight, z: S.z / totalWeight };
    }
    return S;
  }
}
