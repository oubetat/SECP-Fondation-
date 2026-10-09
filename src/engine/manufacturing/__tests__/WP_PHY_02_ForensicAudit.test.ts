/**
 * SECP-POST-007 — WP-PHY-02 FORENSIC AUDIT
 * Phase C Safety Semantics Verification Suite
 */

import { describe, it, expect } from 'vitest';
import {
  EmpiricalToolWearInferenceEngine,
  CuttingCondition,
  InProcessSensorTelemetry
} from '../wear/EmpiricalToolWearInferenceEngine';

describe('WP-PHY-02: FORENSIC SAFETY SEMANTICS AUDIT', () => {
  const toolId = 'FORENSIC_TOOL_01';
  const validConditions: CuttingCondition = {
    cuttingSpeedVc_m_per_min: 150.0,
    feedPerToothFz_mm: 0.1,
    axialDepthAp_mm: 2.0,
    radialWidthAe_mm: 5.0,
    workpieceMaterial: 'STEEL',
    toolMaterial: 'CARBIDE'
  };

  const createTelem = (overrides: Partial<InProcessSensorTelemetry> = {}): InProcessSensorTelemetry => ({
    timestampUtc: new Date().toISOString(),
    cuttingTimeMinutes: 5.0,
    passNumber: 1,
    spindleTorquePercent: 40,
    spindlePowerKw: 3.0,
    cuttingForcesN: { tangentialFc: 400, feedFf: 150, radialFp: 100 },
    vibrationRmsG: 1.0,
    acousticEmissionEnergyV2s: 1.0,
    ...overrides
  });

  it('C1: Rejects NaN sensor value as SENSOR_DATA_CORRUPT', () => {
    const telem = createTelem({ cuttingForcesN: { tangentialFc: NaN, feedFf: 150, radialFp: 100 } });
    const res = EmpiricalToolWearInferenceEngine.inferWear(toolId, validConditions, telem);
    expect(res.dominantSensorFeature).toBe('ANOMALOUS_NEGATIVE_OR_NAN_SENSOR');
    expect(res.governanceFlag).toBe('TOOL_HEALTH_UNDETERMINED');
  });

  it('C2: Rejects Negative force as SENSOR_DATA_CORRUPT', () => {
    const telem = createTelem({ cuttingForcesN: { tangentialFc: -10, feedFf: 150, radialFp: 100 } });
    const res = EmpiricalToolWearInferenceEngine.inferWear(toolId, validConditions, telem);
    expect(res.dominantSensorFeature).toBe('ANOMALOUS_NEGATIVE_OR_NAN_SENSOR');
  });

  it('C3: Rejects Negative power as SENSOR_DATA_CORRUPT', () => {
    const telem = createTelem({ spindlePowerKw: -1.0 });
    const res = EmpiricalToolWearInferenceEngine.inferWear(toolId, validConditions, telem);
    expect(res.dominantSensorFeature).toBe('ANOMALOUS_NEGATIVE_OR_NAN_SENSOR');
  });

  it('C4: Detects Impossible sensor combination (Contradiction: Speed 0, Force > 50)', () => {
    const cond = { ...validConditions, cuttingSpeedVc_m_per_min: 0 };
    const telem = createTelem({ cuttingForcesN: { tangentialFc: 100, feedFf: 50, radialFp: 50 } });
    const res = EmpiricalToolWearInferenceEngine.inferWear(toolId, cond, telem);
    expect(res.dominantSensorFeature).toBe('CONTRADICTORY_ZERO_SPEED_HIGH_FORCE');
    expect(res.decisionEvidence).toContain('PHYSICAL_CONTRADICTION');
  });

  it('C5: Order Verification - Sanity Check occurs BEFORE Calibration Lookup', () => {
    // No calibration registered for 'MISSING_TOOL'
    // If sanity passes, it should return CALIBRATION_UNAVAILABLE
    // If sanity fails (NaN), it should return ANOMALOUS_NEGATIVE_OR_NAN_SENSOR
    
    const badTelem = createTelem({ cuttingForcesN: { tangentialFc: NaN, feedFf: 0, radialFp: 0 } });
    const res = EmpiricalToolWearInferenceEngine.inferWear('MISSING_TOOL', validConditions, badTelem);
    
    // If it were CALIBRATION_UNAVAILABLE, it would mean it hit the calibration lookup first.
    // Since we expect it to hit sanity first, it should be SENSOR_DATA_CORRUPT.
    expect(res.dominantSensorFeature).toBe('ANOMALOUS_NEGATIVE_OR_NAN_SENSOR');
  });

  it('C6: Rejects Out-of-regime condition (requires calibration)', () => {
    EmpiricalToolWearInferenceEngine.calibrate(toolId, validConditions, [createTelem()], [{
      observationId: 'OBS1', toolId, cuttingTimeMinutes: 5, measuredFlankWearVB_mm: 0.05, 
      measuredMaxFlankWearVBmax_mm: 0.06, measuredDimensionalDeviationMm: 0,
      measurementMethod: 'OPTICAL_TOOL_MICROSCOPE', measurementUncertaintyMm: 0.002
    }]);

    const extremeSpeedCond = { ...validConditions, cuttingSpeedVc_m_per_min: 1000.0 };
    const res = EmpiricalToolWearInferenceEngine.inferWear(toolId, extremeSpeedCond, createTelem());
    expect(res.dominantSensorFeature).toBe('REGIME_OUT_OF_BOUNDS');
  });

  it('C7: Valid physical data preserved', () => {
    // Calibration already set in C6
    const res = EmpiricalToolWearInferenceEngine.inferWear(toolId, validConditions, createTelem());
    expect(res.dominantSensorFeature).not.toBe('ANOMALOUS_NEGATIVE_OR_NAN_SENSOR');
    expect(res.dominantSensorFeature).not.toBe('CALIBRATION_UNAVAILABLE');
    expect(res.predictedFlankWearVB_mm).toBeGreaterThan(0);
  });
});
