/**
 * PATCH-SECP-062: Process Baseline Engine
 * Performs deterministic calculations for Process Mean, Median, Overall Standard Deviation,
 * Moving Average, and Moving Range. Automatically establishes 3-sigma Control Limits
 * with a clean separation from engineering Specification Limits.
 */

import { SPCObservation, ProcessBaseline, ControlLimits } from './SPCTypes';

export class ProcessBaselineEngine {
  /**
   * Computes a full Process Baseline from a sequence of observations
   */
  public static establishBaseline(
    observations: SPCObservation[],
    baselineId: string = `baseline-${Date.now()}`
  ): ProcessBaseline {
    const n = observations.length;
    if (n === 0) {
      throw new Error('Cannot establish process baseline with zero observations.');
    }

    const values = observations.map(o => o.measured);
    const featureId = observations[0].measurementFeatureId;

    // 1. Mean
    const mean = values.reduce((sum, val) => sum + val, 0) / n;

    // 2. Median
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(n / 2);
    const median = n % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;

    // 3. Overall Standard Deviation (sigma)
    let sumSquares = 0;
    for (let i = 0; i < n; i++) {
      sumSquares += Math.pow(values[i] - mean, 2);
    }
    const standardDeviation = n > 1 ? Math.sqrt(sumSquares / (n - 1)) : 0.0001;

    // 4. Moving Average (on last points up to window of 5 or n)
    const maWindow = Math.min(5, n);
    const movingAverage = values.slice(n - maWindow).reduce((a, b) => a + b, 0) / maWindow;

    // 5. Moving Range (average of absolute successive differences)
    let mrSum = 0;
    for (let i = 1; i < n; i++) {
      mrSum += Math.abs(values[i] - values[i - 1]);
    }
    const movingRange = n > 1 ? mrSum / (n - 1) : 0.0;

    // 6. Compute Control Limits (UCL / LCL) using standard 3-sigma
    // Control Limits represent the natural statistical boundaries of process variation (3-sigma)
    const controlLimits: ControlLimits = {
      cl: mean,
      sigma: standardDeviation,
      ucl: mean + 3 * standardDeviation,
      lcl: mean - 3 * standardDeviation
    };

    const windowStart = observations[0].timestamp;
    const windowEnd = observations[n - 1].timestamp;

    return {
      baselineId,
      featureId,
      sampleCount: n,
      mean,
      median,
      standardDeviation,
      movingAverage,
      movingRange,
      controlLimits,
      baselineWindowStart: windowStart,
      baselineWindowEnd: windowEnd
    };
  }
}
