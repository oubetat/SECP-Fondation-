import { MeanStressCorrectionMethod } from "./types";

export class MeanStressCorrector {
  /**
   * Calculates mean stress corrected stress amplitude sigma_{a,corrected}.
   * Throws Error with 'MEAN_STRESS_CORRECTION_FAILURE' if inputs or domain constraints are violated.
   */
  public static correctMeanStress(
    amplitude: number,
    mean: number,
    uts: number,
    yieldStrength?: number,
    method: MeanStressCorrectionMethod = MeanStressCorrectionMethod.GOODMAN
  ): number {
    if (amplitude < 0) {
      throw new Error("MEAN_STRESS_CORRECTION_FAILURE: Negative stress amplitude");
    }

    if (method === MeanStressCorrectionMethod.NONE) {
      return amplitude;
    }

    if (!uts || uts <= 0 || !isFinite(uts)) {
      throw new Error("MEAN_STRESS_CORRECTION_FAILURE: Invalid UTS parameter");
    }

    switch (method) {
      case MeanStressCorrectionMethod.GOODMAN: {
        if (mean >= uts) {
          throw new Error("MEAN_STRESS_CORRECTION_FAILURE: Mean stress exceeds or equals UTS in Goodman correction");
        }
        const denom = 1.0 - mean / uts;
        if (denom <= 0 || !isFinite(denom)) {
          throw new Error("MEAN_STRESS_CORRECTION_FAILURE: Invalid denominator in Goodman correction");
        }
        return amplitude / denom;
      }

      case MeanStressCorrectionMethod.GERBER: {
        const ratio = mean / uts;
        const denom = 1.0 - ratio * ratio;
        if (denom <= 0 || !isFinite(denom)) {
          throw new Error("MEAN_STRESS_CORRECTION_FAILURE: Mean stress magnitude exceeds UTS in Gerber correction");
        }
        return amplitude / denom;
      }

      case MeanStressCorrectionMethod.SODERBERG: {
        if (!yieldStrength || yieldStrength <= 0 || !isFinite(yieldStrength)) {
          throw new Error("MEAN_STRESS_CORRECTION_FAILURE: Missing or invalid yield strength for Soderberg correction");
        }
        if (mean >= yieldStrength) {
          throw new Error("MEAN_STRESS_CORRECTION_FAILURE: Mean stress exceeds or equals yield strength in Soderberg correction");
        }
        const denom = 1.0 - mean / yieldStrength;
        if (denom <= 0 || !isFinite(denom)) {
          throw new Error("MEAN_STRESS_CORRECTION_FAILURE: Invalid denominator in Soderberg correction");
        }
        return amplitude / denom;
      }

      default:
        return amplitude;
    }
  }
}
