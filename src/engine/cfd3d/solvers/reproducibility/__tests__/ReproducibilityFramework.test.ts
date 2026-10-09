/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-074: CFD Reproducibility Framework Tests
 */

import { describe, it, expect } from 'vitest';
import {
  FingerprintEngine,
  ResultComparator,
  CFDReproducibilityEngine,
  HardAcceptanceGate074
} from '../index';

describe('PATCH-074: CFD Reproducibility Framework Tests', () => {
  it('1. Fingerprint Capturing & Environment Comparison', () => {
    const sw = FingerprintEngine.captureCurrentSoftware();
    expect(sw.applicationVersion).toBe('2.0.0');
    expect(sw.executableHash.length).toBe(64);

    const hw = FingerprintEngine.captureCurrentHardware();
    expect(hw.coreCount).toBeGreaterThan(0);

    const env = FingerprintEngine.captureCurrentEnvironment();
    expect(env.os).toBeDefined();

    const comparison = FingerprintEngine.compareEnvironments(env, env);
    expect(comparison.status).toBe('IDENTICAL');
    expect(comparison.drift).toBe('NO_DRIFT');
  });

  it('2. Result Comparator & Field Difference Metrics', () => {
    const orig = [1.0, 2.0, 3.0, 4.0];
    const rep = [1.00001, 2.00002, 2.99999, 4.00001];
    const envelope = CFDReproducibilityEngine.defaultEnvelope();

    const res = ResultComparator.compareScalarField('velocity_u', orig, rep, envelope);
    expect(res.isWithinEnvelope).toBe(true);
    expect(res.l2Norm).toBeGreaterThan(0);
    expect(res.lInfNorm).toBeLessThanOrEqual(0.0001);
  });

  it('3. Determinism Classification (Bitwise vs Numerical)', () => {
    const run1 = [1.0, 2.0, 3.0];
    const run2 = [1.0, 2.0, 3.0];
    const run3 = [1.0, 2.0, 3.0];

    const det1 = CFDReproducibilityEngine.analyzeDeterminism([run1, run2, run3]);
    expect(det1).toBe('BITWISE_DETERMINISTIC');

    const run4 = [1.000001, 2.0, 3.0];
    const det2 = CFDReproducibilityEngine.analyzeDeterminism([run1, run4]);
    expect(det2).toBe('NUMERICALLY_DETERMINISTIC');
  });

  it('4. Hard Acceptance Gate 074 Evaluation', async () => {
    const gateRes = await HardAcceptanceGate074.evaluate();
    expect(gateRes.passed).toBe(true);
    expect(gateRes.patch).toBe('PATCH-074');
  });
});
