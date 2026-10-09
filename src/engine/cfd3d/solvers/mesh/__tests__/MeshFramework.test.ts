/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-069: Mesh Independence Core Framework Tests
 */

import { describe, it, expect } from 'vitest';
import { MeshQualityValidator, MeshValidationCode } from '../MeshQualityValidator';
import { GciEngine } from '../GciEngine';
import { IndependentMeshVerifier } from '../IndependentMeshVerifier';
import { MeshFamily } from '../MeshTypes';

describe('PATCH-069: Mesh Independence Core Framework Tests', () => {
  it('Verify Observed Order and GCI Calculation', () => {
    // Fine value = 1.0125, Medium value = 1.05, Coarse value = 1.2, r = 2.0
    // d21 = 1.05 - 1.0125 = 0.0375
    // d32 = 1.2 - 1.05 = 0.15
    // ratio = 0.15 / 0.0375 = 4.0
    // p = ln(4.0) / ln(2.0) = 2.0
    const res = GciEngine.calculate(1.0125, 1.05, 1.2, 2.0);

    expect(res.observedOrder).toBeCloseTo(2.0, 5);
    expect(res.isMonotonic).toBe(true);
    expect(res.isAsymptotic).toBe(true);
    // Richardson extrapolation: 1.0125 + (1.0125 - 1.05) / (2^2 - 1) = 1.0125 - 0.0375 / 3 = 1.0
    expect(res.richardsonExtrapolation).toBeCloseTo(1.0, 5);
  });

  it('Verify Mesh Quality and Topological Validation', () => {
    const report = {
      skewness: 0.1,
      orthogonality: 90.0,
      aspectRatio: 1.0,
      minimumVolume: 1e-5,
      hasNegativeVolume: false
    };

    const res = MeshQualityValidator.validate(report, 0);
    expect(res.valid).toBe(true);
  });

  it('Verify Independent Mesh Refinement Consistency Check', () => {
    const family: MeshFamily = {
      familyId: 'test-fam',
      familyVersion: '1.0.0',
      baseMeshId: 'coarse',
      refinementMethod: 'uniform',
      refinementRatio: 2.0,
      dimension: 3,
      topologyType: 'structured',
      geometryHash: 'geom-hash-1',
      levels: [
        { meshId: 'coarse', levelIndex: 0, cellCount: 100, faceCount: 300, nodeCount: 150, characteristicLength: 0.1, meshHash: 'coarse-hash' },
        { meshId: 'medium', levelIndex: 1, cellCount: 800, faceCount: 2400, nodeCount: 900, characteristicLength: 0.05, meshHash: 'medium-hash' },
        { meshId: 'fine', levelIndex: 2, cellCount: 6400, faceCount: 19200, nodeCount: 6800, characteristicLength: 0.025, meshHash: 'fine-hash' }
      ]
    };

    const verifyResult = IndependentMeshVerifier.verify(family, 2.0);
    expect(verifyResult.isValid).toBe(true);
  });
});
