/**
 * PATCH-SECP-083: Curvature & Differential Geometry Analyzer
 * 
 * Computes First and Second Fundamental Forms of surface theory:
 * First Fundamental Form: E = S_u . S_u, F = S_u . S_v, G = S_v . S_v
 * Second Fundamental Form: L = S_uu . N, M = S_uv . N, N_form = S_vv . N
 * Principal Curvatures: k1, k2
 * Gaussian Curvature: K = (L N_form - M^2) / (E G - F^2)
 * Mean Curvature: H = (E N_form + G L - 2 F M) / (2 (E G - F^2))
 */

import { CurvatureMetrics, NurbsSurfacePatch, SurfaceDerivatives } from './SECP083Types';
import { SECP083ClassASurfaceCore } from './SECP083ClassASurfaceCore';

export class SECP083CurvatureAnalyzer {

  public static computeCurvaturesFromDerivatives(deriv: SurfaceDerivatives): CurvatureMetrics {
    const { dS_du, dS_dv, d2S_du2, d2S_dudv, d2S_dv2, normal } = deriv;

    // First Fundamental Form
    const E = dS_du.x * dS_du.x + dS_du.y * dS_du.y + dS_du.z * dS_du.z;
    const F = dS_du.x * dS_dv.x + dS_du.y * dS_dv.y + dS_du.z * dS_dv.z;
    const G = dS_dv.x * dS_dv.x + dS_dv.y * dS_dv.y + dS_dv.z * dS_dv.z;

    const denom1 = E * G - F * F;
    if (denom1 < 1e-12) {
      return {
        principalCurvature1: 0,
        principalCurvature2: 0,
        gaussianCurvature: 0,
        meanCurvature: 0,
        minRadiusMm: 1e6,
        isInflectionPoint: false
      };
    }

    // Second Fundamental Form
    const L = d2S_du2.x * normal.x + d2S_du2.y * normal.y + d2S_du2.z * normal.z;
    const M = d2S_dudv.x * normal.x + d2S_dudv.y * normal.y + d2S_dudv.z * normal.z;
    const N_form = d2S_dv2.x * normal.x + d2S_dv2.y * normal.y + d2S_dv2.z * normal.z;

    // Gaussian & Mean Curvature
    const K = (L * N_form - M * M) / denom1;
    const H = (E * N_form + G * L - 2 * F * M) / (2 * denom1);

    // Principal Curvatures: k^2 - 2H k + K = 0 => k = H +- sqrt(H^2 - K)
    const discriminant = Math.max(0, H * H - K);
    const sqrtDisc = Math.sqrt(discriminant);

    const k1 = H + sqrtDisc;
    const k2 = H - sqrtDisc;

    const maxCurv = Math.max(Math.abs(k1), Math.abs(k2));
    const minRadiusMm = maxCurv > 1e-9 ? 1.0 / maxCurv : 1e6;

    // Inflection point: k1 * k2 <= 0 (hyperbolic or parabolic transition)
    const isInflectionPoint = K < 0;

    return {
      principalCurvature1: k1,
      principalCurvature2: k2,
      gaussianCurvature: K,
      meanCurvature: H,
      minRadiusMm,
      isInflectionPoint
    };
  }

  public static evaluatePatchCurvatureGrid(
    patch: NurbsSurfacePatch,
    gridSteps: number = 10
  ): {
    minRadiusMm: number;
    maxGaussianCurvature: number;
    maxMeanCurvature: number;
    inflectionPoints: number;
    curvatureSpikes: number;
  } {
    let minRadiusMm = 1e6;
    let maxG = -1e6;
    let maxM = -1e6;
    let inflectionPoints = 0;
    let curvatureSpikes = 0;

    for (let i = 0; i <= gridSteps; i++) {
      for (let j = 0; j <= gridSteps; j++) {
        const u = i / gridSteps;
        const v = j / gridSteps;
        const deriv = SECP083ClassASurfaceCore.evaluateSurfaceDerivatives(patch, u, v);
        const curv = this.computeCurvaturesFromDerivatives(deriv);

        if (curv.minRadiusMm < minRadiusMm) minRadiusMm = curv.minRadiusMm;
        if (Math.abs(curv.gaussianCurvature) > maxG) maxG = Math.abs(curv.gaussianCurvature);
        if (Math.abs(curv.meanCurvature) > maxM) maxM = Math.abs(curv.meanCurvature);

        if (curv.isInflectionPoint) inflectionPoints++;
        if (curv.minRadiusMm < 0.5) curvatureSpikes++; // Extremely tight spike
      }
    }

    return {
      minRadiusMm,
      maxGaussianCurvature: maxG,
      maxMeanCurvature: maxM,
      inflectionPoints,
      curvatureSpikes
    };
  }
}
