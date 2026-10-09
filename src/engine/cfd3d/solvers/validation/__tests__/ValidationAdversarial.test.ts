/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-071: CFD Validation Adversarial Tests
 */

import { describe, it, expect } from 'vitest';
import { ValidationEngine } from '../ValidationEngine';
import { IndependentValidationVerifier } from '../IndependentValidationVerifier';

describe('PATCH-071: CFD Validation Adversarial Battery', () => {
  const ref = {
    referenceId: 'ref-test-01',
    datasetName: 'Sod Shock Tube 1D Study',
    coordinates: [{ x: 0.0, y: 0.0 }, { x: 1.0, y: 0.0 }],
    values: [10.0, 1.0],
    uncertainty: [0.5, 0.05]
  };

  it('1. size mismatch between numerical and physical reference', () => {
    expect(() => ValidationEngine.validateField([10.0], ref, 0.1)).toThrow('VALIDATION_ERROR');
  });

  it('2. non-positive/negative experimental uncertainty rejection', () => {
    const corruptedRef = {
      ...ref,
      uncertainty: [-0.1, 0.05]
    };
    const res = IndependentValidationVerifier.verify(ref.coordinates, corruptedRef);
    expect(res.isValid).toBe(false);
    expect(res.uncertaintyBoundPassed).toBe(false);
  });

  it('3. misaligned coordinates rejection', () => {
    const misalignedCoords = [{ x: 0.0, y: 0.0 }, { x: 1.05, y: 0.0 }]; // node 1 x is 1.05 instead of 1.0
    const res = IndependentValidationVerifier.verify(misalignedCoords, ref);
    expect(res.isValid).toBe(false);
    expect(res.coordinatesAligned).toBe(false);
  });
});
