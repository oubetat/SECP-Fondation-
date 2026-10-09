/**
 * SECP Industrial OS v2 — Independent Measurement Verifier
 * Stand-alone metrology math and decision-rule evaluator.
 */

import {
  QifCharacteristic,
  QifMeasurementUncertainty,
  QifVerdict,
  QifDecisionRule,
  QifInstrument,
  QifCalibrationRecord
} from './QifTypes';

export interface IndependentEvaluationResult {
  readonly characteristicId: string;
  readonly nominalValue: number;
  readonly measuredValue: number;
  readonly deviationMm: number;
  readonly upperLimitMm: number;
  readonly lowerLimitMm: number;
  readonly expandedUncertaintyMm: number;
  readonly effectiveUpperLimitMm: number;
  readonly effectiveLowerLimitMm: number;
  readonly verdict: QifVerdict;
  readonly decisionRule: QifDecisionRule;
  readonly reasoning: string;
}

export class IndependentMeasurementVerifier {

  /**
   * Independently computes expanded uncertainty from components.
   * U = k * sqrt(u_inst^2 + u_env^2 + u_repeat^2)
   */
  public static computeExpandedUncertainty(params: {
    inherentUncertaintyMm: number;
    environmentalContributionMm: number;
    repeatabilityMm: number;
    coverageFactor?: number; // Default k=2
  }): QifMeasurementUncertainty {
    const k = params.coverageFactor ?? 2.0;
    const u_inst = params.inherentUncertaintyMm;
    const u_env = params.environmentalContributionMm;
    const u_rep = params.repeatabilityMm;

    const combinedStandardUncertainty = Math.sqrt(u_inst * u_inst + u_env * u_env + u_rep * u_rep);
    const expandedUncertaintyMm = k * combinedStandardUncertainty;

    return {
      standardUncertaintyMm: Math.round(combinedStandardUncertainty * 1e6) / 1e6,
      instrumentContributionMm: u_inst,
      environmentalContributionMm: u_env,
      repeatabilityMm: u_rep,
      coverageFactor: k,
      expandedUncertaintyMm: Math.round(expandedUncertaintyMm * 1e6) / 1e6,
      confidenceLevelPercent: 95.0
    };
  }

  /**
   * Independently evaluates a measured value against characteristic specification and decision rule.
   */
  public static evaluateMeasurement(
    char: QifCharacteristic,
    measuredValue: number,
    uncertainty: QifMeasurementUncertainty,
    decisionRule: QifDecisionRule = 'GUARD_BANDED_95_CONFIDENCE',
    calibration?: QifCalibrationRecord
  ): IndependentEvaluationResult {
    // 1. Check Calibration validity
    if (calibration) {
      if (!calibration.isValid) {
        return {
          characteristicId: char.id,
          nominalValue: char.nominalValue,
          measuredValue,
          deviationMm: Math.abs(measuredValue - char.nominalValue),
          upperLimitMm: char.tolerance.upperLimitMm,
          lowerLimitMm: char.tolerance.lowerLimitMm,
          expandedUncertaintyMm: uncertainty.expandedUncertaintyMm,
          effectiveUpperLimitMm: char.tolerance.upperLimitMm,
          effectiveLowerLimitMm: char.tolerance.lowerLimitMm,
          verdict: 'CALIBRATION_EXPIRED',
          decisionRule,
          reasoning: `Calibration standard ${calibration.calibrationId} marked invalid`
        };
      }
      const expDate = new Date(calibration.expiresAt);
      if (expDate < new Date('2026-09-23T00:00:00Z')) {
        return {
          characteristicId: char.id,
          nominalValue: char.nominalValue,
          measuredValue,
          deviationMm: Math.abs(measuredValue - char.nominalValue),
          upperLimitMm: char.tolerance.upperLimitMm,
          lowerLimitMm: char.tolerance.lowerLimitMm,
          expandedUncertaintyMm: uncertainty.expandedUncertaintyMm,
          effectiveUpperLimitMm: char.tolerance.upperLimitMm,
          effectiveLowerLimitMm: char.tolerance.lowerLimitMm,
          verdict: 'CALIBRATION_EXPIRED',
          decisionRule,
          reasoning: `Calibration expired on ${calibration.expiresAt}`
        };
      }
    }

    const dev = Math.abs(measuredValue - char.nominalValue);
    const U = uncertainty.expandedUncertaintyMm;
    const upper = char.tolerance.upperLimitMm;
    const lower = char.tolerance.lowerLimitMm;

    let effUpper = upper;
    let effLower = lower;
    let verdict: QifVerdict = 'PASS';
    let reasoning = '';

    if (decisionRule === 'GUARD_BANDED_95_CONFIDENCE') {
      effUpper = upper - U;
      effLower = lower + U;

      if (measuredValue > upper || measuredValue < lower) {
        verdict = 'FAIL';
        reasoning = `Measured value ${measuredValue} outside tolerance limits [${lower}, ${upper}]`;
      } else if (measuredValue > effUpper || measuredValue < effLower) {
        verdict = 'INDETERMINATE';
        reasoning = `Measured value ${measuredValue} in guard-band zone [${effLower}, ${effUpper}] with U=±${U}`;
      } else {
        verdict = 'PASS';
        reasoning = `Measured value ${measuredValue} within guard-banded tolerance limits [${effLower}, ${effUpper}]`;
      }
    } else {
      // SIMPLE_ACCEPTANCE
      if (measuredValue > upper || measuredValue < lower) {
        verdict = 'FAIL';
        reasoning = `Measured value ${measuredValue} outside simple acceptance limits [${lower}, ${upper}]`;
      } else {
        verdict = 'PASS';
        reasoning = `Measured value ${measuredValue} within simple acceptance limits [${lower}, ${upper}]`;
      }
    }

    return {
      characteristicId: char.id,
      nominalValue: char.nominalValue,
      measuredValue,
      deviationMm: Math.round(dev * 1e6) / 1e6,
      upperLimitMm: upper,
      lowerLimitMm: lower,
      expandedUncertaintyMm: U,
      effectiveUpperLimitMm: effUpper,
      effectiveLowerLimitMm: effLower,
      verdict,
      decisionRule,
      reasoning
    };
  }
}
