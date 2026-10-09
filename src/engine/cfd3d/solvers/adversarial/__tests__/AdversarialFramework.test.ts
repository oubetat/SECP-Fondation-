/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-075: CFD Adversarial Verification Framework Tests
 */

import { describe, it, expect } from 'vitest';
import {
  VerdictEngine,
  IndependentAdversarialOracle,
  CFDAdversarialVerificationEngine,
  HardAcceptanceGate075
} from '../index';

describe('PATCH-075: CFD Adversarial Verification Framework Tests', () => {
  it('1. True Converged Case produces computed CONVERGED verdict', () => {
    const res = VerdictEngine.computeCFDVerdict({
      fields: { p: [100, 100, 100], u: [1, 1, 1] },
      meshVolumes: [0.1, 0.1, 0.1],
      residualHistory: [1.0, 0.1, 0.01, 1e-4, 1e-6],
      fluxes: { massIn: 1.0, massOut: 1.00001 },
      solverClaimedStatus: 'CONVERGED'
    });

    expect(res.verdict).toBe('CONVERGED');
    expect(res.evidence.convergenceAchieved).toBe(true);
    expect(res.evidence.conservationAchieved).toBe(true);
  });

  it('2. Residual-Only Trap (low residual but failed mass conservation) yields CONSERVATION_FAILURE', () => {
    const res = VerdictEngine.computeCFDVerdict({
      fields: { p: [100, 100, 100] },
      meshVolumes: [0.1, 0.1, 0.1],
      residualHistory: [1.0, 1e-8], // extremely small residual
      fluxes: { massIn: 1.0, massOut: 2.0 }, // 100% mass imbalance
      solverClaimedStatus: 'CONVERGED'
    });

    expect(res.verdict).toBe('CONSERVATION_FAILURE');
    expect(res.explanation.primaryReason).toMatch(/Global flux balance violated/);
  });

  it('3. Pure Non-Converged Case yields NOT_CONVERGED', () => {
    const res = VerdictEngine.computeCFDVerdict({
      fields: { p: [100, 100, 100] },
      meshVolumes: [0.1, 0.1, 0.1],
      residualHistory: [1.0, 0.5, 0.2, 0.05], // final residual 0.05 > 1e-5
      fluxes: { massIn: 1.0, massOut: 1.0 }
    });

    expect(res.verdict).toBe('NOT_CONVERGED');
  });

  it('4. NaN Field corruption yields INVALID', () => {
    const res = VerdictEngine.computeCFDVerdict({
      fields: { p: [100, NaN, 100] },
      meshVolumes: [0.1, 0.1, 0.1],
      residualHistory: [1.0, 1e-6],
      fluxes: { massIn: 1.0, massOut: 1.0 }
    });

    expect(res.verdict).toBe('INVALID');
    expect(res.evidence.hasNaNOrInf).toBe(true);
  });

  it('5. Independent Adversarial Oracle matches engine verdict', () => {
    const params = {
      fields: { p: [100, 100] },
      meshVolumes: [0.1, 0.1],
      residualHistory: [1.0, 1e-6],
      fluxes: { massIn: 1.0, massOut: 1.0 }
    };

    const engineRes = CFDAdversarialVerificationEngine.evaluateCase({
      caseId: 'test-case',
      runId: 'test-run',
      ...params
    });

    expect(engineRes.oracleMatches).toBe(true);
    expect(engineRes.verdict).toBe('CONVERGED');
  });

  it('6. Hard Acceptance Gate 075 passes all criteria', async () => {
    const gateRes = await HardAcceptanceGate075.evaluate();
    expect(gateRes.passed).toBe(true);
    expect(gateRes.patch).toBe('PATCH-075');
  });
});
