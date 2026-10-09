/**
 * SECP CAD Kernel — Healing Validator
 * PATCH-205: Phase 18 — Professional Modeling
 *
 * Strict engineering validator enforcing non-masquerading, actual geometry correctness,
 * and valid Engineering Truth Verdicts.
 */

import { NURBSSurfaceData } from '../../nurbs/NURBSTypes';
import { SurfaceDefectDetector } from './SurfaceDefectDetector';
import { DefectReport, EngineeringVerdict, DeviationAnalysis } from './types';

export class HealingValidator {
  /**
   * Validate healed surface and assign final Engineering Truth Verdict
   */
  public static validateHealing(
    repairedSurface: NURBSSurfaceData,
    defects: DefectReport[],
    deviation: DeviationAnalysis,
    tolerance: number = 1e-3,
    requiresReview: boolean = false
  ): {
    verdict: EngineeringVerdict;
    remainingDefectsCount: number;
    isValidated: boolean;
  } {
    // Re-detect defects on repaired surface
    const postDefects = SurfaceDefectDetector.detectDefects(repairedSurface, tolerance);
    const criticalPostDefects = postDefects.filter(d => d.severity === 'CRITICAL');

    if (criticalPostDefects.length > 0) {
      return {
        verdict: 'INVALID',
        remainingDefectsCount: postDefects.length,
        isValidated: false
      };
    }

    if (requiresReview || deviation.maxDeviation > tolerance * 50) {
      return {
        verdict: 'REPAIRED_REQUIRES_REVIEW',
        remainingDefectsCount: postDefects.length,
        isValidated: true
      };
    }

    if (postDefects.length === 0 || postDefects.every(d => d.severity === 'MINOR' || d.severity === 'WARNING')) {
      return {
        verdict: 'HEALED_AND_VALIDATED',
        remainingDefectsCount: postDefects.length,
        isValidated: true
      };
    }

    return {
      verdict: 'UNREPAIRABLE',
      remainingDefectsCount: postDefects.length,
      isValidated: false
    };
  }
}
