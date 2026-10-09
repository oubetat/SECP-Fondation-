/**
 * PATCH-178: Materials Benchmark Metrics Engine
 *
 * Computes exact quantitative error metrics comparing actual measured material behavior
 * against independent analytical and numerical reference solutions.
 */

import { MaterialsBenchmarkMetrics } from './types';

export class MaterialsBenchmarkMetricsEngine {
  /**
   * Computes standardized error metrics between measured and reference values.
   */
  public static computeMetrics(
    measuredValue: number,
    referenceValue: number,
    unit: string,
    runtimeMs: number = 1.0,
    additionalErrors?: {
      stressMeasured?: number;
      stressRef?: number;
      strainMeasured?: number;
      strainRef?: number;
      displacementMeasured?: number;
      displacementRef?: number;
      propertyMeasured?: number;
      propertyRef?: number;
      unitConversionMeasured?: number;
      unitConversionRef?: number;
      reproducibilityRuns?: number[];
    }
  ): MaterialsBenchmarkMetrics {
    const absErr = Math.abs(measuredValue - referenceValue);
    const relErrPct =
      Math.abs(referenceValue) > 1e-15
        ? (absErr / Math.abs(referenceValue)) * 100
        : absErr * 100;

    const computeRelErr = (m?: number, r?: number): number => {
      if (m === undefined || r === undefined) return relErrPct;
      const diff = Math.abs(m - r);
      return Math.abs(r) > 1e-15 ? (diff / Math.abs(r)) * 100 : diff * 100;
    };

    const stressErrorPercent = computeRelErr(
      additionalErrors?.stressMeasured,
      additionalErrors?.stressRef
    );

    const strainErrorPercent = computeRelErr(
      additionalErrors?.strainMeasured,
      additionalErrors?.strainRef
    );

    const displacementErrorPercent = computeRelErr(
      additionalErrors?.displacementMeasured,
      additionalErrors?.displacementRef
    );

    const propertyErrorPercent = computeRelErr(
      additionalErrors?.propertyMeasured,
      additionalErrors?.propertyRef
    );

    const unitConversionErrorPercent = computeRelErr(
      additionalErrors?.unitConversionMeasured,
      additionalErrors?.unitConversionRef
    );

    let reproducibilityVariance = 0;
    if (additionalErrors?.reproducibilityRuns && additionalErrors.reproducibilityRuns.length > 1) {
      const runs = additionalErrors.reproducibilityRuns;
      const mean = runs.reduce((a, b) => a + b, 0) / runs.length;
      const variance = runs.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / runs.length;
      reproducibilityVariance = variance;
    }

    return {
      absoluteError: absErr,
      relativeErrorPercent: relErrPct,
      stressErrorPercent,
      strainErrorPercent,
      displacementErrorPercent,
      propertyErrorPercent,
      unitConversionErrorPercent,
      reproducibilityVariance,
      runtimeMs,
      measuredValue,
      referenceValue,
      unit
    };
  }
}
