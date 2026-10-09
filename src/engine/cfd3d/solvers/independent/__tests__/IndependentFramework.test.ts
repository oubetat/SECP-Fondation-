/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-072: Independent CFD Verifier Core Framework Tests
 */

import { describe, it, expect } from 'vitest';
import { IndependentVerifierCore, InputIntegrityVerifier, GeometryVerifier, MeshVerifier, UnitsVerifier, ResultIntegrityVerifier, IndependentResidualCalculator, ConservationRecalculator } from '../IndependentVerifierCore';

describe('PATCH-072: Independent CFD Verifier Core Tests', () => {
  it('Verify perfect match geometry calculation', () => {
    const res = GeometryVerifier.verifyGeometry([2.0, 5.0, 10.0], 100.0, 1e-12);
    expect(res.isValid).toBe(true);
    expect(res.computedVolume).toBeCloseTo(100.0, 12);
  });

  it('Verify mesh topology and quality validation limits', () => {
    const valid = MeshVerifier.verifyTopologyAndQuality(100, 300, 0.4, 45.0, false);
    expect(valid).toBe(true);

    const excessiveSkewness = MeshVerifier.verifyTopologyAndQuality(100, 300, 0.98, 45.0, false);
    expect(excessiveSkewness).toBe(false);

    const negativeVol = MeshVerifier.verifyTopologyAndQuality(100, 300, 0.4, 45.0, true);
    expect(negativeVol).toBe(false);
  });

  it('Verify units consistency audit', () => {
    const consistent = UnitsVerifier.checkDimensionalConsistency({
      density: 'kg/m3',
      pressure: 'Pa'
    });
    expect(consistent).toBe(true);

    const inconsistent = UnitsVerifier.checkDimensionalConsistency({
      pressure: 'kPa' // expected canonical Pa
    });
    expect(inconsistent).toBe(false);
  });

  it('Verify result integrity and NaN/Inf checking', () => {
    const ok = ResultIntegrityVerifier.verifyResult([1.0, 2.0, 3.0], 3);
    expect(ok.isValid).toBe(true);
    expect(ok.hasNaNOrInf).toBe(false);

    const nanCheck = ResultIntegrityVerifier.verifyResult([1.0, NaN, 3.0], 3);
    expect(nanCheck.isValid).toBe(false);
    expect(nanCheck.hasNaNOrInf).toBe(true);
  });

  it('Verify out-of-band residual recalculation', () => {
    const resid = IndependentResidualCalculator.recomputeImbalanceResidual([1.0, -1.02], [0.0]);
    expect(resid).toBeCloseTo(0.02, 12);
  });

  it('Verify conservation recalculation', () => {
    const imbalance = ConservationRecalculator.recalculateGlobalBalances([5.0, -5.0], [1.0, -1.01], [10.0, -10.0]);
    expect(imbalance.massImbalance).toBeCloseTo(0.0, 12);
    expect(imbalance.momentumImbalance).toBeCloseTo(0.01, 12);
  });
});
