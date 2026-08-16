/**
 * SECP-102.4: Production Statistical Process Control & Quality Prediction Engine
 * Computes deterministic probability of defect using Gaussian error integral approximations,
 * specification limit margins, dynamic drift slopes, and proactive maintenance alerts.
 */

import crypto from 'crypto';
import { SPCObservation, ProcessBaseline, ProcessDriftAssessment, QualityPredictionAlert } from './SPCTypes';

export class QualityPredictionEngine {
  /**
   * Evaluates the standard normal cumulative distribution function Phi(x)
   * utilizing the Abramowitz and Stegun 7.1.26 polynomial approximation (max error < 1.5e-7).
   */
  public static normalCdf(x: number): number {
    if (!Number.isFinite(x)) {
      throw new Error('SPC Statistics Error: Non-finite value provided to normal CDF.');
    }
    const b1 = 0.319381530;
    const b2 = -0.356563782;
    const b3 = 1.781477937;
    const b4 = -1.821255978;
    const b5 = 1.330274429;
    const p = 0.2316419;
    const c = 0.3989422804014327; // 1 / sqrt(2 * PI)

    if (x >= 0.0) {
      const t = 1.0 / (1.0 + p * x);
      return 1.0 - c * Math.exp(-x * x / 2.0) * t * (t * (t * (t * (t * b5 + b4) + b3) + b2) + b1);
    } else {
      const t = 1.0 / (1.0 - p * x);
      return c * Math.exp(-x * x / 2.0) * t * (t * (t * (t * (t * b5 + b4) + b3) + b2) + b1);
    }
  }

  /**
   * Forecasts process behavior and returns deterministic proactive maintenance alerts
   */
  public static predictProcessHealth(
    observations: SPCObservation[],
    baseline: ProcessBaseline,
    drift: ProcessDriftAssessment
  ): QualityPredictionAlert {
    if (!observations || observations.length === 0) {
      throw new Error('SPC Quality Engine: Observations dataset cannot be empty.');
    }

    if (!baseline || !baseline.controlLimits) {
      throw new Error('SPC Quality Engine: Process baseline and control limits are required.');
    }

    const featureId = baseline.featureId;
    const n = observations.length;

    // Validate finite values across observations
    for (let i = 0; i < n; i++) {
      const obs = observations[i];
      if (
        !Number.isFinite(obs.measured) ||
        !Number.isFinite(obs.nominal) ||
        !Number.isFinite(obs.toleranceUpper) ||
        !Number.isFinite(obs.toleranceLower)
      ) {
        throw new Error(`SPC Quality Engine: Observation index ${i} contains non-finite measurement values.`);
      }
      if (obs.toleranceUpper <= obs.toleranceLower) {
        throw new Error(`SPC Quality Engine: Invalid specification limits at index ${i} (USL <= LSL).`);
      }
    }

    if (n < 5) {
      const timestampIso = observations[n - 1]?.timestamp || '2026-01-01T00:00:00.000Z';
      const hash = crypto.createHash('sha256').update(`ALERT-INSUFFICIENT:${featureId}:${n}`).digest('hex').substring(0, 12);
      return {
        alertId: `alert-pred-insufficient-${hash}`,
        timestamp: timestampIso,
        featureId,
        estimatedPartsUntilOutOfTolerance: 999,
        probabilityOfDefect: 0.01,
        recommendedAction: 'Continue observation. Accumulate more sample history to establish statistically valid regression slope.',
        confidenceLevel: 'LOW'
      };
    }

    // 1. Empirical measurements and specification bounds
    const latestObs = observations[n - 1];
    const usl = latestObs.toleranceUpper;
    const lsl = latestObs.toleranceLower;
    const mean = baseline.mean;
    const sigma = Math.max(1e-6, baseline.standardDeviation);

    // 2. Compute exact Z-scores against engineering specification limits
    const zUsl = (usl - mean) / sigma;
    const zLsl = (mean - lsl) / sigma;

    // Calculate baseline probability of defect from normal distribution tail areas
    const pUsl = this.normalCdf(-zUsl);
    const pLsl = this.normalCdf(-zLsl);
    let calculatedDefectProb = Math.min(1.0, Math.max(0.0001, pUsl + pLsl));

    const estimatedPartsUntilOutOfTolerance = Math.max(0, Math.round(drift.estimatedSamplesToBoundary));
    let recommendedAction = 'Process is healthy and well within limits. Standard machining continues.';
    let confidenceLevel: QualityPredictionAlert['confidenceLevel'] = 'HIGH';

    // 3. Dynamic drift state classification and proactive maintenance triggers
    if (drift.state === 'DEGRADING') {
      calculatedDefectProb = Math.max(0.85, calculatedDefectProb);
      recommendedAction = `CRITICAL: Proactive maintenance required. Tool wear drift is highly linear. Schedule cutting tool replacement or insert offset adjustments within the next ${estimatedPartsUntilOutOfTolerance} parts to prevent out-of-spec scrap.`;
      confidenceLevel = 'HIGH';
    } else if (drift.state === 'DRIFTING') {
      calculatedDefectProb = Math.max(0.45, calculatedDefectProb);
      recommendedAction = `WARNING: Continuous trend detected. Prepare to insert tool wear offsets to recenter process average before tolerances are violated.`;
      confidenceLevel = 'MEDIUM';
    } else if (drift.state === 'OUT_OF_CONTROL') {
      calculatedDefectProb = Math.max(0.95, calculatedDefectProb);
      recommendedAction = `IMMEDIATE ACTION: Halt execution or trigger emergency change approval. Process has breached 3-sigma control boundaries. Check workpiece clamping, spindle load, and probe calibration.`;
      confidenceLevel = 'HIGH';
    } else {
      confidenceLevel = 'HIGH';
    }

    const timestampIso = latestObs.timestamp || '2026-01-01T00:00:00.000Z';
    const alertDigest = crypto
      .createHash('sha256')
      .update(`${featureId}:${n}:${drift.state}:${calculatedDefectProb.toFixed(4)}`)
      .digest('hex')
      .substring(0, 12);

    return {
      alertId: `alert-pred-${featureId}-${alertDigest}`,
      timestamp: timestampIso,
      featureId,
      estimatedPartsUntilOutOfTolerance,
      probabilityOfDefect: Number(calculatedDefectProb.toFixed(4)),
      recommendedAction,
      confidenceLevel
    };
  }
}
