/**
 * PATCH-SECP-062: Process Drift Engine
 * Executes deterministic linear regressions on time-series metrology observations
 * to identify tooling/abrasive wear drifts, thermal degradation slopes, and estimate
 * samples remaining until a tolerance boundary (USL/LSL) violation occurs.
 */

import { SPCObservation, ProcessBaseline, ProcessDriftAssessment, DriftState } from './SPCTypes';

export class ProcessDriftEngine {
  /**
   * Evaluates trend directionality and estimates parts-to-defect counts
   */
  public static assessDrift(
    observations: SPCObservation[],
    baseline: ProcessBaseline
  ): ProcessDriftAssessment {
    const n = observations.length;
    if (n < 5) {
      return {
        state: 'STABLE',
        slopeMmPerSample: 0,
        confidenceScore: 1.0,
        estimatedSamplesToBoundary: 999,
        description: 'Insufficient observation history to calculate drift regression (minimum 5 samples required).'
      };
    }

    const x = Array.from({ length: n }, (_, i) => i);
    const y = observations.map(o => o.measured);
    const usl = observations[0].toleranceUpper;
    const lsl = observations[0].toleranceLower;

    // 1. Compute least-squares regression slope (m)
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    
    let sumXY = 0;
    let sumX2 = 0;
    for (let i = 0; i < n; i++) {
      sumXY += x[i] * y[i];
      sumX2 += x[i] * x[i];
    }

    const num = n * sumXY - sumX * sumY;
    const den = n * sumX2 - sumX * sumX;
    
    const slopeMmPerSample = den !== 0 ? num / den : 0.0;
    const intercept = (sumY - slopeMmPerSample * sumX) / n;

    // 2. Compute Pearson R correlation to score trend confidence
    const meanX = sumX / n;
    const meanY = sumY / n;
    let numCorr = 0;
    let denX = 0;
    let denY = 0;

    for (let i = 0; i < n; i++) {
      const dx = x[i] - meanX;
      const dy = y[i] - meanY;
      numCorr += dx * dy;
      denX += dx * dx;
      denY += dy * dy;
    }

    const rDen = Math.sqrt(denX * denY);
    const pearsonR = rDen > 0 ? numCorr / rDen : 0;
    const confidenceScore = Math.abs(pearsonR);

    // 3. Estimate samples remaining until we breach usl or lsl
    let estimatedSamplesToBoundary = 999;
    const latestValue = y[n - 1];

    if (slopeMmPerSample > 1e-7) {
      // Upward drift
      const distanceToUsl = usl - latestValue;
      estimatedSamplesToBoundary = Math.max(1, Math.round(distanceToUsl / slopeMmPerSample));
    } else if (slopeMmPerSample < -1e-7) {
      // Downward drift
      const distanceToLsl = latestValue - lsl;
      estimatedSamplesToBoundary = Math.max(1, Math.round(distanceToLsl / Math.abs(slopeMmPerSample)));
    }

    // 4. Assign Drift State based on slope and boundaries
    let state: DriftState = 'STABLE';
    let description = 'Process remains statistically stable and centered.';

    const absSlope = Math.abs(slopeMmPerSample);
    const isDriftingHighConf = absSlope > 0.0001 && confidenceScore >= 0.7;

    // Check if any recent observations actually violate control limits
    const ucl = baseline.controlLimits.ucl;
    const lcl = baseline.controlLimits.lcl;
    const isRecentViolating = y.slice(n - 3).some(val => val > ucl || val < lcl);

    if (isRecentViolating) {
      state = 'OUT_OF_CONTROL';
      description = 'Process is out of control with points breaching statistical 3-sigma boundaries.';
    } else if (isDriftingHighConf) {
      if (estimatedSamplesToBoundary < 15) {
        state = 'DEGRADING';
        description = `Process is degrading rapidly. Tool wear or thermal expansion predicted to violate design tolerances in approximately ${estimatedSamplesToBoundary} parts.`;
      } else {
        state = 'DRIFTING';
        description = `Continuous directional drift detected (slope: ${slopeMmPerSample.toFixed(6)} mm/sample, confidence: ${(confidenceScore * 100).toFixed(0)}%).`;
      }
    } else {
      // Check if process has returned from out of bounds
      const isHistoricalViolating = y.slice(0, n - 3).some(val => val > ucl || val < lcl);
      const isLatestCentered = Math.abs(latestValue - baseline.controlLimits.cl) < baseline.controlLimits.sigma;
      if (isHistoricalViolating && isLatestCentered) {
        state = 'RECOVERING';
        description = 'Process exhibits recovery behavior, returning to historical center-line averages after adjustments.';
      }
    }

    return {
      state,
      slopeMmPerSample,
      confidenceScore,
      estimatedSamplesToBoundary,
      description
    };
  }
}
