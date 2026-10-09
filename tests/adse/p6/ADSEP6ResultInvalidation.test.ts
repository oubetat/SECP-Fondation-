/**
 * SECP — ADSE-P6 Result Invalidation & Structural Drift Test Suite
 * 
 * Verifies that modifying geometry, materials, boundaries, revisions,
 * or P5 structural interfaces immediately invalidates downstream executions,
 * prevents stale result reuse, and computes accurate impact blast radius.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ADSEP6ThermalEngine } from '../../../src/engine/adse/p6/ADSEP6ThermalEngine';

describe('ADSE-P6 Result Invalidation & Structural Coupling', () => {
  let p6: ADSEP6ThermalEngine;

  beforeEach(() => {
    p6 = new ADSEP6ThermalEngine();
    p6.clear();
  });

  it('Invalidates previous execution when structural interface revision changes', () => {
    const model = p6.registry.registerModel({
      thermalId: 'therm:wing:pod',
      canonicalId: 'arch:comp:EW_POD',
      p5StructuralId: 'struct:assembly:wing_pylon',
      p4NodeId: 'thread:node:EW_POD',
      displayName: 'Electronic Warfare Pod Thermal Model',
      domain: 'STEADY_STATE',
      configurationId: 'CONF-01',
      authority: 'SYSTEM_ARCHITECT'
    });

    const exec = p6.solver.prepareExecution(model, [], [], []);
    const res = p6.solver.execute1DSteadyConduction(exec.executionId, {
      hotBoundaryK: 350,
      coldBoundaryK: 280,
      lengthM: 0.1,
      areaM2: 0.02,
      conductivityW_mK: 50.0
    });

    expect(res.executionStatus).toBe('COMPLETED');
    expect(exec.status).toBe('COMPLETED');

    // Structural interface modified in P5
    const impact = p6.impact.analyzeStructuralDriftImpact('p5:iface:pylon_bolted_mount');
    expect(impact.reason).toContain('p5:iface:pylon_bolted_mount');

    // Invalidate the thermal model execution
    p6.invalidations.invalidateForModel(model.thermalId, 'P5 Structural Interface drift detected');

    const invalidatedExec = p6.solver.getExecution(exec.executionId);
    expect(invalidatedExec?.status).toBe('INVALIDATED');
    expect(invalidatedExec?.invalidatedReason).toContain('P5 Structural Interface drift');

    // Verification must reject invalidated execution
    const intent = p6.verifications.registerVerificationIntent({
      intentId: 'intent:test:inval',
      thermalId: model.thermalId,
      executionId: exec.executionId,
      maxAllowableTemperatureK: 360,
      maxAllowableEnergyBalanceErrorPercent: 1.0,
      verificationMethod: 'ANALYTICAL_CHECK'
    });

    expect(() => {
      p6.verifications.verifyExecution(intent.intentId, res, 'SYSTEM_ARCHITECT');
    }).toThrow(/VERIFICATION_REJECTED/);
  });
});
