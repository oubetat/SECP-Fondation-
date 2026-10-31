/**
 * SECP CAD Kernel — NURBS Derivatives & Differential Geometry Engine
 * WP-02 Advanced Surface Modeling
 */

import { NurbsCurve, NurbsSurface, NurbsTolerance } from './NurbsContracts';
import { NurbsEvaluator } from './NurbsEvaluator';

export interface SurfaceCurvatureResult {
  status: 'OK' | 'SINGULAR' | 'INVALID';
  gaussianCurvature?: number;
  meanCurvature?: number;
  principalCurvature1?: number;
  principalCurvature2?: number;
  diagnostics?: string[];
}

export class NurbsDerivatives {
  /**
   * Evaluates first derivative tangent vector of a NURBS curve at parameter u.
   */
  public static evaluateCurveDerivative(
    curve: NurbsCurve,
    u: number,
    tol: NurbsTolerance
  ): { status: string; derivative?: { x: number; y: number; z: number }; method: string; diagnostics?: string[] } {
    const p = curve.degree;
    const n = curve.controlPoints.length - 1;
    const uMin = curve.knots[p];
    const uMax = curve.knots[n + 1];

    if (u < uMin - tol.absolute || u > uMax + tol.absolute) {
      return { status: 'INVALID', method: 'CENTRAL_DIFFERENCE', diagnostics: [`Parameter u=${u} outside domain [${uMin}, ${uMax}]`] };
    }

    const h = Math.max(1e-6, tol.absolute * 10);
    const u1 = Math.max(uMin, u - h);
    const u2 = Math.min(uMax, u + h);
    const du = u2 - u1;

    if (du <= 1e-12) {
      return { status: 'SINGULAR', method: 'CENTRAL_DIFFERENCE', diagnostics: ['Domain interval too small for derivative evaluation'] };
    }

    const res1 = NurbsEvaluator.evaluateCurve(curve, u1, tol);
    const res2 = NurbsEvaluator.evaluateCurve(curve, u2, tol);

    if (res1.status !== 'OK' || res2.status !== 'OK') {
      return { status: 'INVALID', method: 'CENTRAL_DIFFERENCE', diagnostics: ['Curve evaluation failed at derivative boundary steps'] };
    }

    return {
      status: 'OK',
      derivative: {
        x: (res2.point.x - res1.point.x) / du,
        y: (res2.point.y - res1.point.y) / du,
        z: (res2.point.z - res1.point.z) / du
      },
      method: 'CENTRAL_DIFFERENCE'
    };
  }

  /**
   * Evaluates the unit normal vector of a NURBS surface at parameters (u, v).
   */
  public static evaluateSurfaceNormal(
    surface: NurbsSurface,
    u: number,
    v: number,
    tol: NurbsTolerance
  ): { status: string; normal?: { x: number; y: number; z: number }; method: string; diagnostics?: string[] } {
    const pU = surface.degreeU;
    const pV = surface.degreeV;
    const nU = surface.controlPoints.length - 1;
    const nV = surface.controlPoints[0].length - 1;

    const uMin = surface.knotsU[pU];
    const uMax = surface.knotsU[nU + 1];
    const vMin = surface.knotsV[pV];
    const vMax = surface.knotsV[nV + 1];

    if (u < uMin - tol.absolute || u > uMax + tol.absolute || v < vMin - tol.absolute || v > vMax + tol.absolute) {
      return { status: 'INVALID', method: 'DIFFERENTIAL_GEOMETRY', diagnostics: [`Parameters (u=${u}, v=${v}) outside domain`] };
    }

    const h = Math.max(1e-6, tol.absolute * 10);
    const u1 = Math.max(uMin, u - h);
    const u2 = Math.min(uMax, u + h);
    const du = u2 - u1;

    const v1 = Math.max(vMin, v - h);
    const v2 = Math.min(vMax, v + h);
    const dv = v2 - v1;

    if (du <= 1e-12 || dv <= 1e-12) {
      return { status: 'SINGULAR', method: 'DIFFERENTIAL_GEOMETRY', diagnostics: ['Domain step interval too small'] };
    }

    const resU1 = NurbsEvaluator.evaluateSurface(surface, u1, v, tol);
    const resU2 = NurbsEvaluator.evaluateSurface(surface, u2, v, tol);
    const resV1 = NurbsEvaluator.evaluateSurface(surface, u, v1, tol);
    const resV2 = NurbsEvaluator.evaluateSurface(surface, u, v2, tol);

    if (resU1.status !== 'OK' || resU2.status !== 'OK' || resV1.status !== 'OK' || resV2.status !== 'OK') {
      return { status: 'INVALID', method: 'DIFFERENTIAL_GEOMETRY', diagnostics: ['Surface evaluation failed during normal calculation'] };
    }

    const Su = {
      x: (resU2.point.x - resU1.point.x) / du,
      y: (resU2.point.y - resU1.point.y) / du,
      z: (resU2.point.z - resU1.point.z) / du
    };

    const Sv = {
      x: (resV2.point.x - resV1.point.x) / dv,
      y: (resV2.point.y - resV1.point.y) / dv,
      z: (resV2.point.z - resV1.point.z) / dv
    };

    // Cross product Su x Sv
    const nx = Su.y * Sv.z - Su.z * Sv.y;
    const ny = Su.z * Sv.x - Su.x * Sv.z;
    const nz = Su.x * Sv.y - Su.y * Sv.x;
    const len = Math.hypot(nx, ny, nz);

    if (len <= 1e-9) {
      return { status: 'SINGULAR', method: 'DIFFERENTIAL_GEOMETRY', diagnostics: ['Surface normal is degenerate (singular tangent vectors)'] };
    }

    return {
      status: 'OK',
      normal: {
        x: nx / len,
        y: ny / len,
        z: nz / len
      },
      method: 'DIFFERENTIAL_GEOMETRY'
    };
  }

  /**
   * Evaluates first and second fundamental forms to calculate Gaussian and Mean Curvatures.
   */
  public static evaluateSurfaceCurvatures(
    surface: NurbsSurface,
    u: number,
    v: number,
    tol: NurbsTolerance
  ): SurfaceCurvatureResult {
    const normalRes = this.evaluateSurfaceNormal(surface, u, v, tol);
    if (normalRes.status !== 'OK' || !normalRes.normal) {
      return { status: normalRes.status as any, diagnostics: normalRes.diagnostics };
    }

    const norm = normalRes.normal;
    const h = Math.max(1e-5, tol.absolute * 10);

    const P = NurbsEvaluator.evaluateSurface(surface, u, v, tol).point;
    const Pu_p = NurbsEvaluator.evaluateSurface(surface, u + h, v, tol).point;
    const Pu_m = NurbsEvaluator.evaluateSurface(surface, u - h, v, tol).point;
    const Pv_p = NurbsEvaluator.evaluateSurface(surface, u, v + h, tol).point;
    const Pv_m = NurbsEvaluator.evaluateSurface(surface, u, v - h, tol).point;

    const Puv_pp = NurbsEvaluator.evaluateSurface(surface, u + h, v + h, tol).point;
    const Puv_pm = NurbsEvaluator.evaluateSurface(surface, u + h, v - h, tol).point;
    const Puv_mp = NurbsEvaluator.evaluateSurface(surface, u - h, v + h, tol).point;
    const Puv_mm = NurbsEvaluator.evaluateSurface(surface, u - h, v - h, tol).point;

    // First partial derivatives
    const Su = { x: (Pu_p.x - Pu_m.x) / (2 * h), y: (Pu_p.y - Pu_m.y) / (2 * h), z: (Pu_p.z - Pu_m.z) / (2 * h) };
    const Sv = { x: (Pv_p.x - Pv_m.x) / (2 * h), y: (Pv_p.y - Pv_m.y) / (2 * h), z: (Pv_p.z - Pv_m.z) / (2 * h) };

    // Second partial derivatives
    const Suu = {
      x: (Pu_p.x - 2 * P.x + Pu_m.x) / (h * h),
      y: (Pu_p.y - 2 * P.y + Pu_m.y) / (h * h),
      z: (Pu_p.z - 2 * P.z + Pu_m.z) / (h * h)
    };
    const Svv = {
      x: (Pv_p.x - 2 * P.x + Pv_m.x) / (h * h),
      y: (Pv_p.y - 2 * P.y + Pv_m.y) / (h * h),
      z: (Pv_p.z - 2 * P.z + Pv_m.z) / (h * h)
    };
    const Suv = {
      x: (Puv_pp.x - Puv_pm.x - Puv_mp.x + Puv_mm.x) / (4 * h * h),
      y: (Puv_pp.y - Puv_pm.y - Puv_mp.y + Puv_mm.y) / (4 * h * h),
      z: (Puv_pp.z - Puv_pm.z - Puv_mp.z + Puv_mm.z) / (4 * h * h)
    };

    // First fundamental form
    const E = Su.x * Su.x + Su.y * Su.y + Su.z * Su.z;
    const F = Su.x * Sv.x + Su.y * Sv.y + Su.z * Sv.z;
    const G = Sv.x * Sv.x + Sv.y * Sv.y + Sv.z * Sv.z;

    const denom = E * G - F * F;
    if (denom <= 1e-12) {
      return { status: 'SINGULAR', diagnostics: ['Singular first fundamental form denominator'] };
    }

    // Second fundamental form
    const L = Suu.x * norm.x + Suu.y * norm.y + Suu.z * norm.z;
    const M = Suv.x * norm.x + Suv.y * norm.y + Suv.z * norm.z;
    const N = Svv.x * norm.x + Svv.y * norm.y + Svv.z * norm.z;

    const K = (L * N - M * M) / denom;
    const H = (E * N - 2 * F * M + G * L) / (2 * denom);

    const disc = Math.max(0, H * H - K);
    const k1 = H + Math.sqrt(disc);
    const k2 = H - Math.sqrt(disc);

    return {
      status: 'OK',
      gaussianCurvature: K,
      meanCurvature: H,
      principalCurvature1: k1,
      principalCurvature2: k2
    };
  }
}
