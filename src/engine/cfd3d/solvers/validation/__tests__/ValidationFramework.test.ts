/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-071: CFD Validation Core Framework Tests
 */

import { describe, it, expect } from 'vitest';
import { ValidationEngine } from '../ValidationEngine';
import { IndependentValidationVerifier } from '../IndependentValidationVerifier';

describe('PATCH-071: CFD Validation Core Framework Tests', () => {
  const ref = {
    referenceId: 'ref-test-01',
    datasetName: 'Sod Shock Tube 1D Study',
    coordinates: [{ x: 0.0, y: 0.0 }, { x: 1.0, y: 0.0 }],
    values: [10.0, 1.0],
    uncertainty: [0.5, 0.05]
  };

  it('Verify Validation Discrepancy & Verdict Calculations', () => {
    // Numerical results matching very closely within validation uncertainty limits
    const res = ValidationEngine.validateField([10.1, 1.02], ref, 0.1);

    expect(res.L1Discrepancy).toBeCloseTo(0.06, 5); // (|0.1| + |0.02|) / 2 = 0.06
    expect(res.validationVerdict).toBe('VALIDATED');
  });

  it('Verify Independent Validation Alignment and Integrity', () => {
    const coords = [{ x: 0.0, y: 0.0 }, { x: 1.0, y: 0.0 }];
    const res = IndependentValidationVerifier.verify(coords, ref);
    expect(res.isValid).toBe(true);
  });
});
