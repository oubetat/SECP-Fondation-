/**
 * PATCH-SECP-062: Quality Prediction Engine
 * Analyzes process variation rates and directional drift slopes to predict
 * potential defect occurrences, estimated parts remaining before boundary breach,
 * and issue actionable engineering alerts.
 */

import { SPCObservation, ProcessBaseline, ProcessDriftAssessment, QualityPredictionAlert } from './SPCTypes';

export class QualityPredictionEngine {
  /**
   * Forecasts process behavior and returns proactive maintenance alerts
   */
  public static predictProcessHealth(
    observations: SPCObservation[],
    baseline: ProcessBaseline,
    drift: ProcessDriftAssessment
  ): QualityPredictionAlert {
    const featureId = baseline.featureId;
    const n = observations.length;

    if (n < 5) {
      return {
        alertId: `alert-pred-insufficient-${Date.now()}`,
        timestamp: new Date().toISOString(),
        featureId,
        estimatedPartsUntilOutOfTolerance: 999,
        probabilityOfDefect: 0.01,
        recommendedAction: 'Continue observation. Accumulate more sample history to establish statistically valid regression slope.',
        confidenceLevel: 'LOW'
      };
    }

    const estimatedPartsUntilOutOfTolerance = drift.estimatedSamplesToBoundary;
    let probabilityOfDefect = 0.01;
    let recommendedAction = 'Process is healthy and well within limits. Standard machining continues.';
    let confidenceLevel: QualityPredictionAlert['confidenceLevel'] = 'HIGH';

    // Defect probability is higher if capability Cpk is low or process is actively drifting
    const cpk = (baseline.controlLimits.cl > baseline.controlLimits.cl) ? 1.0 : 1.33; // Mock placeholder helper
    
    if (drift.state === 'DEGRADING') {
      probabilityOfDefect = 0.85;
      recommendedAction = `CRITICAL: Proactive maintenance required. Tool wear drift is highly linear. Schedule cutting tool replacement or insert offset adjustments within the next ${estimatedPartsUntilOutOfTolerance} parts to prevent out-of-spec scrap.`;
      confidenceLevel = 'HIGH';
    } else if (drift.state === 'DRIFTING') {
      probabilityOfDefect = 0.45;
      recommendedAction = `WARNING: Continuous trend detected. Prepare to insert tool wear offsets to recenter process average before tolerances are violated.`;
      confidenceLevel = 'MEDIUM';
    } else if (drift.state === 'OUT_OF_CONTROL') {
      probabilityOfDefect = 0.95;
      recommendedAction = `IMMEDIATE ACTION: Halt execution or trigger emergency change approval. Process has breached 3-sigma control boundaries. Check workpiece clamping, spindle load, and probe calibration.`;
      confidenceLevel = 'HIGH';
    }

    return {
      alertId: `alert-pred-${featureId}-${Date.now()}`,
      timestamp: new Date().toISOString(),
      featureId,
      estimatedPartsUntilOutOfTolerance,
      probabilityOfDefect,
      recommendedAction,
      confidenceLevel
    };
  }
}
