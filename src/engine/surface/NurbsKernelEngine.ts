/**
 * SECP-054 NURBS & BSpline Math Kernel Engine
 */

import { Vector3D, NurbsCurveDefinition, NurbsSurfaceDefinition } from './IndustrialSurfaceTypes';

export class NurbsKernelEngine {

  /**
   * Validate knot vector properties:
   * 1. Non-decreasing order
   * 2. Length must equal numControlPoints + degree + 1
   */
  public static validateKnotVector(knots: number[], numControlPoints: number, degree: number): boolean {
    const expectedLen = numControlPoints + degree + 1;
    if (knots.length !== expectedLen) return false;
    for (let i = 1; i < knots.length; i++) {
      if (knots[i] < knots[i - 1]) return false;
    }
    return true;
  }

  /**
   * Cox-de Boor recursion algorithm to compute B-Spline basis function N_{i,p}(u)
   */
  public static computeBasis(i: number, p: number, u: number, knots: number[]): number {
    if (p === 0) {
      if (u >= knots[i] && u < knots[i + 1]) return 1.0;
      // Handle boundary condition for u = knots[end]
      if (u === knots[knots.length - 1] && u === knots[i + 1] && knots[i] < knots[i + 1]) return 1.0;
      return 0.0;
    }

    let left = 0.0;
    const denomLeft = knots[i + p] - knots[i];
    if (denomLeft > 1e-9) {
      left = ((u - knots[i]) / denomLeft) * this.computeBasis(i, p - 1, u, knots);
    }

    let right = 0.0;
    const denomRight = knots[i + p + 1] - knots[i + 1];
    if (denomRight > 1e-9) {
      right = ((knots[i + p + 1] - u) / denomRight) * this.computeBasis(i + 1, p - 1, u, knots);
    }

    return left + right;
  }

  /**
   * Evaluate point C(u) on NURBS / BSpline Curve
   */
  public static evaluateCurvePoint(curve: NurbsCurveDefinition, u: number): Vector3D {
    const p = curve.degree;
    const n = curve.controlPoints.length - 1;
    const knots = curve.knots;

    // Clamp u within domain
    const uMin = knots[p];
    const uMax = knots[knots.length - 1 - p];
    const clampedU = Math.min(Math.max(u, uMin), uMax);

    let numerator = { x: 0, y: 0, z: 0 };
    let denominator = 0.0;

    for (let i = 0; i <= n; i++) {
      const N = this.computeBasis(i, p, clampedU, knots);
      const w = curve.isRational ? (curve.weights[i] ?? 1.0) : 1.0;
      const weightN = N * w;

      numerator.x += curve.controlPoints[i].x * weightN;
      numerator.y += curve.controlPoints[i].y * weightN;
      numerator.z += curve.controlPoints[i].z * weightN;
      denominator += weightN;
    }

    if (Math.abs(denominator) < 1e-9) denominator = 1.0;

    return {
      x: numerator.x / denominator,
      y: numerator.y / denominator,
      z: numerator.z / denominator
    };
  }

  /**
   * Evaluate tangent vector C'(u) on curve via finite difference
   */
  public static evaluateCurveTangent(curve: NurbsCurveDefinition, u: number): Vector3D {
    const h = 1e-4;
    const p1 = this.evaluateCurvePoint(curve, u - h);
    const p2 = this.evaluateCurvePoint(curve, u + h);
    const dx = (p2.x - p1.x) / (2 * h);
    const dy = (p2.y - p1.y) / (2 * h);
    const dz = (p2.z - p1.z) / (2 * h);
    const len = Math.hypot(dx, dy, dz);
    if (len < 1e-9) return { x: 1, y: 0, z: 0 };
    return { x: dx / len, y: dy / len, z: dz / len };
  }

  /**
   * Evaluate point S(u, v) on NURBS / BSpline Surface
   */
  public static evaluateSurfacePoint(surf: NurbsSurfaceDefinition, u: number, v: number): Vector3D {
    const pU = surf.degreeU;
    const pV = surf.degreeV;
    const nU = surf.controlPoints.length - 1;
    const nV = surf.controlPoints[0].length - 1;

    const uMin = surf.knotsU[pU];
    const uMax = surf.knotsU[surf.knotsU.length - 1 - pU];
    const vMin = surf.knotsV[pV];
    const vMax = surf.knotsV[surf.knotsV.length - 1 - pV];

    const clampedU = Math.min(Math.max(u, uMin), uMax);
    const clampedV = Math.min(Math.max(v, vMin), vMax);

    let numerator = { x: 0, y: 0, z: 0 };
    let denominator = 0.0;

    for (let i = 0; i <= nU; i++) {
      const Nu = this.computeBasis(i, pU, clampedU, surf.knotsU);
      for (let j = 0; j <= nV; j++) {
        const Nv = this.computeBasis(j, pV, clampedV, surf.knotsV);
        const w = surf.isRational ? (surf.weights[i]?.[j] ?? 1.0) : 1.0;
        const weightN = Nu * Nv * w;

        numerator.x += surf.controlPoints[i][j].x * weightN;
        numerator.y += surf.controlPoints[i][j].y * weightN;
        numerator.z += surf.controlPoints[i][j].z * weightN;
        denominator += weightN;
      }
    }

    if (Math.abs(denominator) < 1e-9) denominator = 1.0;

    return {
      x: numerator.x / denominator,
      y: numerator.y / denominator,
      z: numerator.z / denominator
    };
  }

  /**
   * Evaluate surface normal vector N(u, v)
   */
  public static evaluateSurfaceNormal(surf: NurbsSurfaceDefinition, u: number, v: number): Vector3D {
    const h = 1e-4;
    const pCenter = this.evaluateSurfacePoint(surf, u, v);
    const pU = this.evaluateSurfacePoint(surf, u + h, v);
    const pV = this.evaluateSurfacePoint(surf, u, v + h);

    const Su = { x: (pU.x - pCenter.x) / h, y: (pU.y - pCenter.y) / h, z: (pU.z - pCenter.z) / h };
    const Sv = { x: (pV.x - pCenter.x) / h, y: (pV.y - pCenter.y) / h, z: (pV.z - pCenter.z) / h };

    // Cross product Su x Sv
    const Nx = Su.y * Sv.z - Su.z * Sv.y;
    const Ny = Su.z * Sv.x - Su.x * Sv.z;
    const Nz = Su.x * Sv.y - Su.y * Sv.x;

    const len = Math.hypot(Nx, Ny, Nz);
    if (len < 1e-9) return { x: 0, y: 0, z: 1 };
    return { x: Nx / len, y: Ny / len, z: Nz / len };
  }

  /**
   * Compute Gaussian & Mean Curvatures (K, H) at (u, v)
   */
  public static computeCurvatures(surf: NurbsSurfaceDefinition, u: number, v: number): {
    gaussianCurvature: number;
    meanCurvature: number;
    minRadiusMm: number;
  } {
    const h = 1e-3;
    const p = this.evaluateSurfacePoint(surf, u, v);
    const pU = this.evaluateSurfacePoint(surf, u + h, v);
    const pV = this.evaluateSurfacePoint(surf, u, v + h);

    const Su = { x: (pU.x - p.x) / h, y: (pU.y - p.y) / h, z: (pU.z - p.z) / h };
    const Sv = { x: (pV.x - p.x) / h, y: (pV.y - p.y) / h, z: (pV.z - p.z) / h };

    // First Fundamental Form: E, F, G
    const E = Su.x * Su.x + Su.y * Su.y + Su.z * Su.z;
    const F = Su.x * Sv.x + Su.y * Sv.y + Su.z * Sv.z;
    const G = Sv.x * Sv.x + Sv.y * Sv.y + Sv.z * Sv.z;

    const N = this.evaluateSurfaceNormal(surf, u, v);

    // Second derivatives
    const pUU = this.evaluateSurfacePoint(surf, u + 2 * h, v);
    const pVV = this.evaluateSurfacePoint(surf, u, v + 2 * h);
    const pUV = this.evaluateSurfacePoint(surf, u + h, v + h);

    const Suu = { x: (pUU.x - 2 * pU.x + p.x) / (h * h), y: (pUU.y - 2 * pU.y + p.y) / (h * h), z: (pUU.z - 2 * pU.z + p.z) / (h * h) };
    const Svv = { x: (pVV.x - 2 * pV.x + p.x) / (h * h), y: (pVV.y - 2 * pV.y + p.y) / (h * h), z: (pVV.z - 2 * pV.z + p.z) / (h * h) };
    const Suv = { x: (pUV.x - pU.x - pV.x + p.x) / (h * h), y: (pUV.y - pU.y - pV.y + p.y) / (h * h), z: (pUV.z - pU.z - pV.z + p.x) / (h * h) };

    // Second Fundamental Form: e, f, g
    const e = Suu.x * N.x + Suu.y * N.y + Suu.z * N.z;
    const f = Suv.x * N.x + Suv.y * N.y + Suv.z * N.z;
    const g = Svv.x * N.x + Svv.y * N.y + Svv.z * N.z;

    const denom = E * G - F * F;
    const safeDenom = Math.abs(denom) < 1e-8 ? 1.0 : denom;

    const gaussianCurvature = (e * g - f * f) / safeDenom;
    const meanCurvature = (e * G - 2 * f * F + g * E) / (2 * safeDenom);

    const maxAbsK = Math.max(Math.abs(meanCurvature + Math.sqrt(Math.max(0, meanCurvature * meanCurvature - gaussianCurvature))), 1e-6);
    const minRadiusMm = 1.0 / maxAbsK;

    return {
      gaussianCurvature,
      meanCurvature,
      minRadiusMm
    };
  }

  /**
   * Helper to construct a uniform open knot vector
   */
  public static generateUniformKnotVector(numControlPoints: number, degree: number): number[] {
    const knots: number[] = [];
    for (let i = 0; i <= degree; i++) knots.push(0.0);
    const internalKnotsCount = numControlPoints - degree - 1;
    for (let i = 1; i <= internalKnotsCount; i++) {
      knots.push(i / (internalKnotsCount + 1));
    }
    for (let i = 0; i <= degree; i++) knots.push(1.0);
    return knots;
  }
}
