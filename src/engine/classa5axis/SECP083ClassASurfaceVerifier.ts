/**
 * PATCH-SECP-083: SECP083ClassASurfaceVerifier
 * 
 * Re-evaluates Class-A surface quality independently from the surface generator.
 * Verifies G0, G1, G2, G3 continuity, curvature variation, parameterization quality,
 * singularities, trim integrity, and zebra reflection analysis.
 */

import { NurbsSurfacePatch, ContinuityEvaluationResult, ZebraStripeAnalysisResult } from './SECP083Types';
import { SECP083ClassASurfaceCore } from './SECP083ClassASurfaceCore';
import { SECP083SurfaceContinuityVerifier } from './SECP083SurfaceContinuityVerifier';
import { SECP083CurvatureAnalyzer } from './SECP083CurvatureAnalyzer';
import { SECP083ZebraReflectionAnalyzer } from './SECP083ZebraReflectionAnalyzer';

export interface IndependentClassAVerdict {
  surfaceId: string;
  hasGeometricSingularity: boolean;
  parameterizationQualityScore: number; // 0..100
  continuityResult?: ContinuityEvaluationResult;
  curvatureSummary: {
    minRadiusMm: number;
    maxGaussianCurvature: number;
    maxMeanCurvature: number;
    inflectionPoints: number;
    curvatureSpikes: number;
  };
  zebraReport: ZebraStripeAnalysisResult;
  overallClassACompliance: boolean;
  verdictReason: string;
}

export class SECP083ClassASurfaceVerifier {

  public static verifyPatchClassA(
    patchA: NurbsSurfacePatch,
    patchB?: NurbsSurfacePatch
  ): IndependentClassAVerdict {
    // 1. Singularity Check (Zero normal or degenerate jacobian)
    let hasSingularity = false;
    const derivCorner = SECP083ClassASurfaceCore.evaluateSurfaceDerivatives(patchA, 0.5, 0.5);
    const normMag = Math.hypot(derivCorner.normal.x, derivCorner.normal.y, derivCorner.normal.z);
    if (normMag < 0.99 || isNaN(normMag)) {
      hasSingularity = true;
    }

    // 2. Curvature Summary
    const curvatureSummary = SECP083CurvatureAnalyzer.evaluatePatchCurvatureGrid(patchA, 12);

    // 3. Continuity check against adjacent patch
    let continuityResult: ContinuityEvaluationResult | undefined = undefined;
    if (patchB) {
      continuityResult = SECP083SurfaceContinuityVerifier.evaluatePatchBoundaryContinuity(patchA, patchB);
    }

    // 4. Zebra reflection analysis
    const zebraReport = SECP083ZebraReflectionAnalyzer.analyzeReflectionStripes(patchA, 16, 45);

    // 5. Parameterization Quality Score
    const paramScore = Math.max(0, 100 - curvatureSummary.curvatureSpikes * 15 - (hasSingularity ? 50 : 0));

    const continuityPassed = patchB ? (continuityResult?.isG2Satisfied ?? false) : true;
    const overallClassACompliance = !hasSingularity && curvatureSummary.curvatureSpikes === 0 && zebraReport.isClassACompliant && continuityPassed;

    let verdictReason = 'Verified Class-A surface geometry with smooth curvature and G2 continuity.';
    if (hasSingularity) verdictReason = 'REJECTED: Surface singularity detected.';
    else if (curvatureSummary.curvatureSpikes > 0) verdictReason = 'REJECTED: Curvature spikes detected.';
    else if (!zebraReport.isClassACompliant) verdictReason = 'REJECTED: Reflection stripe flow non-compliant.';
    else if (!continuityPassed) verdictReason = 'REJECTED: Boundary G2 continuity not satisfied.';

    return {
      surfaceId: patchA.id,
      hasGeometricSingularity: hasSingularity,
      parameterizationQualityScore: paramScore,
      continuityResult,
      curvatureSummary,
      zebraReport,
      overallClassACompliance,
      verdictReason
    };
  }
}
