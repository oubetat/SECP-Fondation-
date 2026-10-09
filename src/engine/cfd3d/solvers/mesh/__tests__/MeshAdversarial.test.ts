/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-069: Mesh Independence Adversarial Tests
 */

import { describe, it, expect } from 'vitest';
import { MeshQualityValidator, MeshValidationCode } from '../MeshQualityValidator';
import { GciEngine } from '../GciEngine';

describe('PATCH-069: Mesh Independence Adversarial Battery', () => {
  it('12. negative cell volume protection', () => {
    const report = {
      skewness: 0.2,
      orthogonality: 80.0,
      aspectRatio: 1.2,
      minimumVolume: -1e-5,
      hasNegativeVolume: true
    };

    const res = MeshQualityValidator.validate(report, 0);
    expect(res.valid).toBe(false);
    expect(res.error).toBe(MeshValidationCode.NEGATIVE_VOLUME);
  });

  it('excessive skewness (>0.95) protection', () => {
    const report = {
      skewness: 0.98,
      orthogonality: 80.0,
      aspectRatio: 1.2,
      minimumVolume: 1e-5,
      hasNegativeVolume: false
    };

    const res = MeshQualityValidator.validate(report, 0);
    expect(res.valid).toBe(false);
    expect(res.error).toBe(MeshValidationCode.EXCESSIVE_SKEWNESS);
  });

  it('poor orthogonality (<10 deg) protection', () => {
    const report = {
      skewness: 0.2,
      orthogonality: 5.0,
      aspectRatio: 1.2,
      minimumVolume: 1e-5,
      hasNegativeVolume: false
    };

    const res = MeshQualityValidator.validate(report, 0);
    expect(res.valid).toBe(false);
    expect(res.error).toBe(MeshValidationCode.POOR_ORTHOGONALITY);
  });

  it('duplicate nodes detection', () => {
    const report = {
      skewness: 0.2,
      orthogonality: 80.0,
      aspectRatio: 1.2,
      minimumVolume: 1e-5,
      hasNegativeVolume: false
    };

    const res = MeshQualityValidator.validate(report, 4);
    expect(res.valid).toBe(false);
    expect(res.error).toBe(MeshValidationCode.TOPOLOGY_CORRUPTION);
  });

  it('non-monotonic QoI detection', () => {
    // Coarse = 1.0, Medium = 1.1, Fine = 1.05 (Non-monotonic)
    const res = GciEngine.calculate(1.05, 1.1, 1.0, 2.0);
    expect(res.isMonotonic).toBe(false);
    expect(res.isAsymptotic).toBe(false);
  });
});
