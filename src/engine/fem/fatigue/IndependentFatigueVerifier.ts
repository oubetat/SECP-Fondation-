import {
  StressHistory,
  SNMaterialModel,
  MeanStressCorrectionMethod,
  ExtractedCycle,
  FatigueVerdict,
  FatigueResult
} from "./types";

export class IndependentFatigueVerifier {
  /**
   * Independent calculation of Goodman mean stress correction.
   * sigma_a_corr = sigma_a / (1 - sigma_m / UTS)
   */
  public static verifyGoodmanCorrection(amplitude: number, mean: number, uts: number): number {
    if (mean >= uts) {
      throw new Error("INDEPENDENT_VERIFICATION_FAILURE: Goodman mean stress exceeds UTS");
    }
    return amplitude / (1.0 - mean / uts);
  }

  /**
   * Independent calculation of Gerber mean stress correction.
   * sigma_a_corr = sigma_a / (1 - (sigma_m / UTS)^2)
   */
  public static verifyGerberCorrection(amplitude: number, mean: number, uts: number): number {
    const ratio = mean / uts;
    if (Math.abs(ratio) >= 1.0) {
      throw new Error("INDEPENDENT_VERIFICATION_FAILURE: Gerber mean stress exceeds UTS");
    }
    return amplitude / (1.0 - ratio * ratio);
  }

  /**
   * Independent calculation of Soderberg mean stress correction.
   * sigma_a_corr = sigma_a / (1 - sigma_m / yieldStrength)
   */
  public static verifySoderbergCorrection(amplitude: number, mean: number, yieldStrength: number): number {
    if (mean >= yieldStrength) {
      throw new Error("INDEPENDENT_VERIFICATION_FAILURE: Soderberg mean stress exceeds Yield strength");
    }
    return amplitude / (1.0 - mean / yieldStrength);
  }

  /**
   * Independent calculation of Basquin S-N life.
   * N_f = 0.5 * (sigma_a / sf_prime)^(1/b)
   */
  public static verifyBasquinLife(amplitude: number, sf_prime: number, b: number): number {
    if (amplitude <= 0) return Infinity;
    const ratio = amplitude / sf_prime;
    return 0.5 * Math.pow(ratio, 1.0 / b);
  }

  /**
   * Independent verification of complete fatigue result.
   */
  public static verifyFatigueResult(
    history: StressHistory,
    material: SNMaterialModel,
    method: MeanStressCorrectionMethod,
    engineResult: FatigueResult,
    tolRel: number = 1e-4
  ): { verified: boolean; errorDetails?: string } {
    try {
      if (!engineResult || engineResult.verdict === FatigueVerdict.INVALID_STRESS_HISTORY) {
        return { verified: false, errorDetails: "Engine result is invalid or failed" };
      }

      const uts = material.uts;
      let independentTotalDamage = 0;

      for (const cycle of engineResult.cycles) {
        let independentCorrAmp = cycle.amplitude;

        if (method === MeanStressCorrectionMethod.GOODMAN) {
          independentCorrAmp = this.verifyGoodmanCorrection(cycle.amplitude, cycle.mean, uts);
        } else if (method === MeanStressCorrectionMethod.GERBER) {
          independentCorrAmp = this.verifyGerberCorrection(cycle.amplitude, cycle.mean, uts);
        } else if (method === MeanStressCorrectionMethod.SODERBERG) {
          independentCorrAmp = this.verifySoderbergCorrection(cycle.amplitude, cycle.mean, material.yieldStrength!);
        }

        let independentNf = Infinity;
        if (material.curveType === 'BASQUIN' && material.basquinParams) {
          independentNf = this.verifyBasquinLife(
            independentCorrAmp,
            material.basquinParams.sf_prime,
            material.basquinParams.b
          );
        }

        if (cycle.correctedAmplitude) {
          const diffCorr = Math.abs(cycle.correctedAmplitude - independentCorrAmp) / Math.max(independentCorrAmp, 1e-6);
          if (diffCorr > tolRel) {
            return {
              verified: false,
              errorDetails: `Corrected amplitude mismatch: engine ${cycle.correctedAmplitude} vs verifier ${independentCorrAmp}`
            };
          }
        }

        if (isFinite(independentNf) && independentNf > 0) {
          independentTotalDamage += cycle.count / independentNf;
        }
      }

      if (material.curveType === 'BASQUIN') {
        const damageDiff = Math.abs(engineResult.damage - independentTotalDamage) / Math.max(independentTotalDamage, 1e-12);
        if (damageDiff > tolRel) {
          return {
            verified: false,
            errorDetails: `Total damage mismatch: engine ${engineResult.damage} vs verifier ${independentTotalDamage}`
          };
        }
      }

      return { verified: true };
    } catch (err: any) {
      return { verified: false, errorDetails: err?.message || String(err) };
    }
  }
}
