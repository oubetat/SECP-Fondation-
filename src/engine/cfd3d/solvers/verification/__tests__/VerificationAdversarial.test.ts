/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-070: CFD Verification Adversarial Tests
 */

import { describe, it, expect } from 'vitest';
import { IndependentCFDVerifier } from '../IndependentCFDVerifier';
import { ConservationVerifier } from '../ConservationVerifier';

describe('PATCH-070: CFD Verification Adversarial Battery', () => {
  it('1. wrong governing equation hash protection', () => {
    const eq = {
      equationHash: 'wrong-eq-hash',
      canonicalRepresentation: 'continuity',
      variables: ['rho']
    };

    const disc = {
      discretizationHash: 'disc-hash-70',
      spatialOrder: 2,
      temporalOrder: 2
    };

    const res = IndependentCFDVerifier.verify(eq, disc, 'expected-eq-hash', 'disc-hash-70');
    expect(res.isValid).toBe(false);
    expect(res.identitiesPassed).toBe(false);
  });

  it('3. wrong units/dimensional consistency failure detection', () => {
    const eq = {
      equationHash: 'eq-hash-70',
      canonicalRepresentation: 'continuity',
      variables: [] // Empty variables list triggers dimensional failure
    };

    const disc = {
      discretizationHash: 'disc-hash-70',
      spatialOrder: 2,
      temporalOrder: 2
    };

    const res = IndependentCFDVerifier.verify(eq, disc, 'eq-hash-70', 'disc-hash-70');
    expect(res.isValid).toBe(false);
    expect(res.dimensionalPassed).toBe(false);
  });

  it('29. mass conservation imbalance detection', () => {
    // Inflows (10.0) != Outflows (8.0) -> Mass imbalance (2.0)
    const res = ConservationVerifier.calculateImbalance([10.0], [8.0], [0.0]);
    expect(res.isConservative).toBe(false);
    expect(res.massImbalance).toBeCloseTo(2.0, 12);
  });
});
