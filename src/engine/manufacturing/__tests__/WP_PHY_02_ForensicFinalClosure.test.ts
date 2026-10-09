/**
 * SECP-POST-007 — WP-PHY-02 FINAL FORENSIC CLOSURE
 * Advanced Adversarial Order & Semantic Invariant Verification
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  EmpiricalToolWearInferenceEngine,
  CuttingCondition,
  InProcessSensorTelemetry,
  MeasuredToolWearObservation
} from '../wear/EmpiricalToolWearInferenceEngine';

describe('WP-PHY-02: FINAL FORENSIC CLOSURE AUDIT', () => {
  const toolId = 'FINAL_CLOSURE_TOOL';
  
  const validConditions: CuttingCondition = {
    cuttingSpeedVc_m_per_min: 150.0,
    feedPerToothFz_mm: 0.1,
    axialDepthAp_mm: 2.0,
    radialWidthAe_mm: 5.0,
    workpieceMaterial: 'STEEL',
    toolMaterial: 'CARBIDE'
  };

  const createValidTelem = (): InProcessSensorTelemetry => ({
    timestampUtc: new Date().toISOString(),
    cuttingTimeMinutes: 5.0,
    passNumber: 1,
    spindleTorquePercent: 40,
    spindlePowerKw: 3.0,
    cuttingForcesN: { tangentialFc: 400, feedFf: 150, radialFp: 100 },
    vibrationRmsG: 1.0,
    acousticEmissionEnergyV2s: 1.0
  });

  beforeEach(() => {
    EmpiricalToolWearInferenceEngine.clearRegistry();
  });

  // -------------------------------------------------------------------------
  // PHASE 2 — ADVERSARIAL ORDER: INVALID TELEMETRY + MISSING CALIBRATION
  // -------------------------------------------------------------------------
  it('F1: Invalid telemetry + Missing calibration => Returns SENSOR FAILURE (Sanity Gate First)', () => {
    const corruptTelem = createValidTelem();
    corruptTelem.cuttingForcesN.tangentialFc = NaN; // Trigger Sanity

    // Tool ID 'NON_EXISTENT' has no calibration.
    const res = EmpiricalToolWearInferenceEngine.inferWear('NON_EXISTENT', validConditions, corruptTelem);
    
    // IF the order were Calibration First, it would return CALIBRATION_UNAVAILABLE.
    // SINCE the order is Sanity First, it must return ANOMALOUS_NEGATIVE_OR_NAN_SENSOR.
    expect(res.dominantSensorFeature).toBe('ANOMALOUS_NEGATIVE_OR_NAN_SENSOR');
    expect(res.governanceFlag).toBe('TOOL_HEALTH_UNDETERMINED');
  });

  // -------------------------------------------------------------------------
  // PHASE 3 — VALID TELEMETRY + MISSING CALIBRATION
  // -------------------------------------------------------------------------
  it('F2: Valid telemetry + Missing calibration => Returns CALIBRATION_UNAVAILABLE', () => {
    const res = EmpiricalToolWearInferenceEngine.inferWear('MISSING_TOOL', validConditions, createValidTelem());
    expect(res.dominantSensorFeature).toBe('CALIBRATION_UNAVAILABLE');
  });

  // -------------------------------------------------------------------------
  // PHASE 4 — INVALID TELEMETRY + VALID CALIBRATION
  // -------------------------------------------------------------------------
  it('F3: Invalid telemetry + Valid calibration => Returns SENSOR FAILURE (Blocks Physics Model)', () => {
    // Register valid calibration
    EmpiricalToolWearInferenceEngine.calibrate(toolId, validConditions, [createValidTelem()], [{
      observationId: 'OBS1', toolId, cuttingTimeMinutes: 5, measuredFlankWearVB_mm: 0.05, 
      measuredMaxFlankWearVBmax_mm: 0.06, measuredDimensionalDeviationMm: 0,
      measurementMethod: 'OPTICAL_TOOL_MICROSCOPE', measurementUncertaintyMm: 0.002
    }]);

    const corruptTelem = createValidTelem();
    corruptTelem.cuttingForcesN.tangentialFc = -500; // Physical impossibility

    const res = EmpiricalToolWearInferenceEngine.inferWear(toolId, validConditions, corruptTelem);
    
    expect(res.dominantSensorFeature).toBe('ANOMALOUS_NEGATIVE_OR_NAN_SENSOR');
    // Physics model result would be non-zero if it ran.
    expect(res.predictedFlankWearVB_mm).toBe(0);
  });

  // -------------------------------------------------------------------------
  // PHASE 5 — VALID TELEMETRY + VALID CALIBRATION (POSITIVE PATH)
  // -------------------------------------------------------------------------
  it('F4: Valid telemetry + Valid calibration => Successful Inference', () => {
    EmpiricalToolWearInferenceEngine.calibrate(toolId, validConditions, [createValidTelem()], [{
      observationId: 'OBS1', toolId, cuttingTimeMinutes: 5, measuredFlankWearVB_mm: 0.05, 
      measuredMaxFlankWearVBmax_mm: 0.06, measuredDimensionalDeviationMm: 0,
      measurementMethod: 'OPTICAL_TOOL_MICROSCOPE', measurementUncertaintyMm: 0.002
    }]);

    const res = EmpiricalToolWearInferenceEngine.inferWear(toolId, validConditions, createValidTelem());
    
    expect(res.governanceFlag).toBe('TOOL_HEALTHY');
    expect(res.predictedFlankWearVB_mm).toBeGreaterThan(0);
    expect(res.confidenceInterval95[1]).toBeGreaterThan(res.confidenceInterval95[0]);
  });

  // -------------------------------------------------------------------------
  // PHASE 7 — FALSE NEGATIVE: CONTRADICTORY TELEMETRY
  // -------------------------------------------------------------------------
  it('F5: Contradictory telemetry (Speed 0, Force > 50) is blocked before calibration', () => {
    const zeroSpeedCond = { ...validConditions, cuttingSpeedVc_m_per_min: 0 };
    const highForceTelem = createValidTelem();
    highForceTelem.cuttingForcesN.tangentialFc = 100;

    const res = EmpiricalToolWearInferenceEngine.inferWear('ANY_TOOL', zeroSpeedCond, highForceTelem);
    expect(res.dominantSensorFeature).toBe('CONTRADICTORY_ZERO_SPEED_HIGH_FORCE');
  });
});
