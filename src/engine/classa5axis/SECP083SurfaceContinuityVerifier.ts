/**
 * PATCH-SECP-083: Surface Continuity Verifier (G0, G1, G2, G3)
 * 
 * Independently measures position gap, tangent angle deviation, curvature difference,
 * and curvature derivative mismatch across shared surface boundaries.
 */

import {
  NurbsSurfacePatch,
  ContinuityTolerance,
  ContinuityEvaluationResult
} from './SECP083Types';
import { SECP083ClassASurfaceCore } from './SECP083ClassASurfaceCore';
import { SECP083CurvatureAnalyzer } from './SECP083CurvatureAnalyzer';

export class SECP083SurfaceContinuityVerifier {

  public static evaluatePatchBoundaryContinuity(
    patchA: NurbsSurfacePatch,
    patchB: NurbsSurfacePatch,
    tolerance: ContinuityTolerance = {
      g0ToleranceMm: 0.001,
      g1ToleranceDeg: 0.1,
      g2ToleranceCurv: 0.01,
      g3ToleranceDeriv: 0.001
    }
  ): ContinuityEvaluationResult {
    const sampleCount = 25;
    let maxG0Gap = 0.0;
    let maxG1Angle = 0.0;
    let maxG2Curv = 0.0;
    let maxG3Deriv = 0.0;

    for (let k = 0; k <= sampleCount; k++) {
      const uNorm = k / sampleCount;

      // Sample along boundary v=1 of patchA and u=0 of patchB
      const derivA = SECP083ClassASurfaceCore.evaluateSurfaceDerivatives(patchA, uNorm, 1.0);
      const derivB = SECP083ClassASurfaceCore.evaluateSurfaceDerivatives(patchB, 0.0, uNorm);

      // 1. G0 Position Gap
      const pA = derivA.point;
      const pB = derivB.point;
      const gap = Math.hypot(pB.x - pA.x, pB.y - pA.y, pB.z - pA.z);
      if (gap > maxG0Gap) maxG0Gap = gap;

      // 2. G1 Tangent Angle Deviation
      const nA = derivA.normal;
      const nB = derivB.normal;
      const dot = Math.min(Math.max(nA.x * nB.x + nA.y * nB.y + nA.z * nB.z, -1.0), 1.0);
      const angleRad = Math.acos(dot);
      const angleDeg = (angleRad * 180) / Math.PI;
      if (angleDeg > maxG1Angle) maxG1Angle = angleDeg;

      // 3. G2 Curvature Error
      const curvA = SECP083CurvatureAnalyzer.computeCurvaturesFromDerivatives(derivA);
      const curvB = SECP083CurvatureAnalyzer.computeCurvaturesFromDerivatives(derivB);
      const diffMeanK = Math.abs(curvA.meanCurvature - curvB.meanCurvature);
      if (diffMeanK > maxG2Curv) maxG2Curv = diffMeanK;

      // 4. G3 Curvature Derivative Error (Higher-order rate of change)
      const d2NormA = Math.hypot(derivA.d2S_du2.x, derivA.d2S_du2.y, derivA.d2S_du2.z);
      const d2NormB = Math.hypot(derivB.d2S_dv2.x, derivB.d2S_dv2.y, derivB.d2S_dv2.z);
      const diffD2 = Math.abs(d2NormA - d2NormB);
      if (diffD2 > maxG3Deriv) maxG3Deriv = diffD2;
    }

    const isG0Satisfied = maxG0Gap <= tolerance.g0ToleranceMm;
    const isG1Satisfied = isG0Satisfied && maxG1Angle <= tolerance.g1ToleranceDeg;
    const isG2Satisfied = isG1Satisfied && maxG2Curv <= tolerance.g2ToleranceCurv;
    const isG3Satisfied = isG2Satisfied && maxG3Deriv <= tolerance.g3ToleranceDeriv;

    let highestContinuityAchieved: 'G0' | 'G1' | 'G2' | 'G3' | 'DISCONTINUOUS' = 'DISCONTINUOUS';
    if (isG3Satisfied) highestContinuityAchieved = 'G3';
    else if (isG2Satisfied) highestContinuityAchieved = 'G2';
    else if (isG1Satisfied) highestContinuityAchieved = 'G1';
    else if (isG0Satisfied) highestContinuityAchieved = 'G0';

    return {
      patchAId: patchA.id,
      patchBId: patchB.id,
      isG0Satisfied,
      maxG0PositionErrorMm: maxG0Gap,
      isG1Satisfied,
      maxG1TangentErrorDeg: maxG1Angle,
      isG2Satisfied,
      maxG2CurvatureError: maxG2Curv,
      isG3Satisfied,
      maxG3DerivativeError: maxG3Deriv,
      highestContinuityAchieved
    };
  }
}
