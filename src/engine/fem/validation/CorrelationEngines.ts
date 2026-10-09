import { ValidationMetricResult, ValidationStatus } from "./types";

export class CorrelationEngines {
  /**
   * Correlates displacement fields.
   */
  public static correlateDisplacement(
    measured: number[],
    predicted: number[],
    uncertainty: number,
    threshold: number = 0.05
  ): ValidationMetricResult {
    let sumSq = 0;
    let n = measured.length;
    for (let i = 0; i < n; i++) {
      const diff = measured[i] - predicted[i];
      sumSq += diff * diff;
    }
    const rmse = Math.sqrt(sumSq / n);
    const maxMeas = Math.max(...measured.map(Math.abs), 1e-12);
    const relErr = rmse / maxMeas;

    const status = relErr <= threshold ? ValidationStatus.PASS : ValidationStatus.FAIL;

    return {
      metricId: 'DISPLACEMENT_RMSE',
      description: 'Root Mean Square Error of displacement field correlation',
      measured: 0, // Reference is implicitly zero for error
      predicted: rmse,
      error: relErr,
      uncertainty,
      status
    };
  }

  /**
   * Calculates Modal Assurance Criterion (MAC).
   */
  public static calculateMAC(phiExp: number[], phiFE: number[]): number {
    let dot = 0;
    let normExp = 0;
    let normFE = 0;

    for (let i = 0; i < phiExp.length; i++) {
      dot += phiExp[i] * phiFE[i];
      normExp += phiExp[i] * phiExp[i];
      normFE += phiFE[i] * phiFE[i];
    }

    if (normExp === 0 || normFE === 0) return 0;
    return (dot * dot) / (normExp * normFE);
  }

  /**
   * Correlates natural frequencies.
   */
  public static correlateFrequency(
    fExp: number,
    fFE: number,
    threshold: number = 0.02
  ): ValidationMetricResult {
    const err = Math.abs(fFE - fExp) / fExp;
    const status = err <= threshold ? ValidationStatus.PASS : ValidationStatus.FAIL;

    return {
      metricId: 'FREQUENCY_ERROR',
      description: 'Relative error in natural frequency',
      measured: fExp,
      predicted: fFE,
      error: err,
      uncertainty: 0,
      status
    };
  }

  /**
   * Correlates fatigue life (Log-Life Error).
   */
  public static correlateFatigueLife(
    nExp: number,
    nFE: number,
    factorRange: number = 2.0
  ): ValidationMetricResult {
    const logExp = Math.log10(nExp);
    const logFE = Math.log10(nFE);
    const diff = Math.abs(logFE - logExp);
    
    // factor of 2 means log difference <= log10(2) approx 0.301
    const threshold = Math.log10(factorRange);
    const status = diff <= threshold ? ValidationStatus.PASS : ValidationStatus.FAIL;

    return {
      metricId: 'FATIGUE_LOG_LIFE_ERROR',
      description: 'Difference in log10(Life)',
      measured: logExp,
      predicted: logFE,
      error: diff,
      uncertainty: 0,
      status
    };
  }
}
