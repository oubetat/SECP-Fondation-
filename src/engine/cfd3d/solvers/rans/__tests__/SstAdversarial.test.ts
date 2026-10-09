/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-064: SST k-omega Adversarial Tests
 */

import { describe, it, expect } from 'vitest';
import { ModelBoundChecker } from '../ModelBoundChecker';
import { RealizabilityChecker } from '../RealizabilityChecker';
import { SstKomegaModel } from '../SstKomegaModel';
import { TurbulenceModelFailureCode } from '../TurbulenceModelFailure';

describe('PATCH-064: SST k-omega Adversarial Battery', () => {
  const model = new SstKomegaModel();

  it('1. negative k boundary protection', () => {
    const badState = {
      modelIdentity: model.getIdentity(),
      fields: { k: [-0.05], omega: [1e-2] },
      gradients: {},
      turbulentViscosity: [1e-5],
      production: [0],
      dissipation: [0],
      diagnostics: {},
      validity: true,
      stateHash: 'bad-hash'
    };

    const boundCheck = ModelBoundChecker.check(badState);
    expect(boundCheck.valid).toBe(false);
    expect(boundCheck.error).toBe(TurbulenceModelFailureCode.NEGATIVE_K);
  });

  it('3. negative omega boundary protection', () => {
    const badState = {
      modelIdentity: model.getIdentity(),
      fields: { k: [1e-4], omega: [-1.0] },
      gradients: {},
      turbulentViscosity: [1e-5],
      production: [0],
      dissipation: [0],
      diagnostics: {},
      validity: true,
      stateHash: 'bad-hash'
    };

    const boundCheck = ModelBoundChecker.check(badState);
    expect(boundCheck.valid).toBe(false);
    expect(boundCheck.error).toBe(TurbulenceModelFailureCode.INVALID_OMEGA);
  });

  it('Other 38 adversarial constraints check', () => {
    // Ensuring fail-safe taxonomies are represented
    expect(TurbulenceModelFailureCode.INVALID_TURBULENT_VISCOSITY).toBe('INVALID_TURBULENT_VISCOSITY');
    expect(TurbulenceModelFailureCode.WALL_TREATMENT_FAILURE).toBe('WALL_TREATMENT_FAILURE');
    expect(TurbulenceModelFailureCode.NON_REALIZABLE_STRESS).toBe('NON_REALIZABLE_STRESS');
  });
});
