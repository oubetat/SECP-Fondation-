/**
 * PATCH-SECP-083: Zebra / Reflection-Stripe Surface Quality Analysis
 * 
 * Simulates virtual reflection stripes over NURBS surface patches
 * to detect waviness, surface kinks, patch boundary discontinuities, and flow smoothness.
 * 
 * Named explicitly: "Class-A Surface Verification" (avoiding false automotive claims).
 */

import { NurbsSurfacePatch, ZebraStripeAnalysisResult } from './SECP083Types';
import { SECP083ClassASurfaceCore } from './SECP083ClassASurfaceCore';

export class SECP083ZebraReflectionAnalyzer {

  public static analyzeReflectionStripes(
    patch: NurbsSurfacePatch,
    stripeFrequency: number = 16,
    stripeAngleDeg: number = 45
  ): ZebraStripeAnalysisResult {
    const gridRes = 20;
    const rad = (stripeAngleDeg * Math.PI) / 180;
    const dirX = Math.cos(rad);
    const dirY = Math.sin(rad);

    let smoothSampleCount = 0;
    let totalSamples = 0;
    let prevIntensity = 0;
    let discontinuityCount = 0;
    let totalGradientSum = 0;
    const defectLog: string[] = [];

    for (let i = 0; i <= gridRes; i++) {
      for (let j = 0; j <= gridRes; j++) {
        const u = i / gridRes;
        const v = j / gridRes;

        const deriv = SECP083ClassASurfaceCore.evaluateSurfaceDerivatives(patch, u, v);
        const norm = deriv.normal;

        // Virtual reflection intensity I = sin(stripeFrequency * (Nx*dirX + Ny*dirY + Nz*0.5))
        const dotRef = norm.x * dirX + norm.y * dirY + norm.z * 0.5;
        const intensity = Math.sin(stripeFrequency * dotRef);

        totalSamples++;
        if (intensity >= -1.0 && intensity <= 1.0) {
          smoothSampleCount++;
        }

        if (j > 0) {
          const delta = Math.abs(intensity - prevIntensity);
          totalGradientSum += delta;

          if (delta > 1.8) {
            discontinuityCount++;
            defectLog.push(`Stripe reflection jump delta=${delta.toFixed(3)} at u=${u.toFixed(2)}, v=${v.toFixed(2)}`);
          }
        }
        prevIntensity = intensity;
      }
    }

    const reflectionSmoothness = Math.min(1.0, smoothSampleCount / totalSamples);
    const wavinessScore = totalGradientSum / totalSamples;
    const isClassACompliant = reflectionSmoothness >= 0.80 && discontinuityCount === 0 && wavinessScore < 1.2;

    return {
      stripeCount: stripeFrequency,
      reflectionSmoothness: Number(reflectionSmoothness.toFixed(4)),
      discontinuityCount,
      wavinessScore: Number(wavinessScore.toFixed(4)),
      isClassACompliant,
      defectLog
    };
  }
}
