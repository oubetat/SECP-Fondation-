/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-075: CFD Adversarial Battery Tests
 */

import { describe, it, expect } from 'vitest';
import {
  VerdictEngine,
  AdversarialMutationEngine,
  PhysicalValidityAnalyzer,
  IndependentConvergenceAnalyzer,
  IndependentConservationAnalyzer
} from '../index';

describe('PATCH-075: CFD Adversarial Battery Tests', () => {
  it('1. Infinity injection attack yields INVALID', () => {
    const { mutated } = AdversarialMutationEngine.injectInfinityIntoField([100, 100, 100], 1);
    const audit = PhysicalValidityAnalyzer.auditField(
      'temperature',
      mutated,
      VerdictEngine.defaultValidityPolicy()
    );
    expect(audit.isValid).toBe(false);
    expect(audit.hasInf).toBe(true);
  });

  it('2. Inverted cell volume mesh attack yields INVALID', () => {
    const { mutated } = AdversarialMutationEngine.injectMeshInversion([0.1, 0.2, 0.1]);
    const audit = PhysicalValidityAnalyzer.auditMesh(mutated, []);
    expect(audit.isValid).toBe(false);
    expect(audit.hasNegativeVolume).toBe(true);
  });

  it('3. Negative density physical property attack yields INVALID', () => {
    const audit = PhysicalValidityAnalyzer.auditField(
      'density',
      [1.2, -0.5, 1.2],
      VerdictEngine.defaultValidityPolicy()
    );
    expect(audit.isValid).toBe(false);
    expect(audit.hasNegativeValues).toBe(true);
  });

  it('4. Residual reset attack detection in convergence analyzer', () => {
    const { mutated } = AdversarialMutationEngine.injectResidualReset([1.0, 0.1, 0.05, 0.02]);
    const audit = IndependentConvergenceAnalyzer.auditResidualHistory(
      mutated,
      VerdictEngine.defaultConvergencePolicy(),
      true
    );
    expect(audit.hasResidualReset).toBe(true);
    expect(audit.isConverged).toBe(false);
  });

  it('5. Residual stagnation detection in convergence analyzer', () => {
    const { mutated } = AdversarialMutationEngine.injectResidualStagnation(20, 0.005);
    const audit = IndependentConvergenceAnalyzer.auditResidualHistory(
      mutated,
      VerdictEngine.defaultConvergencePolicy(),
      false
    );
    expect(audit.isStagnant).toBe(true);
    expect(audit.isConverged).toBe(false);
  });

  it('6. Momentum and Energy balance failure detection', () => {
    const consAudit = IndependentConservationAnalyzer.auditBalances(
      {
        massIn: 1.0,
        massOut: 1.0,
        momentumIn: 10.0,
        momentumOut: 25.0, // Momentum imbalance of 15.0 >> 1e-3
        energyIn: 100.0,
        energyOut: 100.0
      },
      VerdictEngine.defaultConservationPolicy()
    );
    expect(consAudit.isConserved).toBe(false);
    expect(consAudit.momentumConserved).toBe(false);
  });

  it('7. Numerical Divergence attack yields non-converged / diverging', () => {
    const divergingResiduals = [1e-3, 1e-2, 1e-1, 1.5, 10.0];
    const audit = IndependentConvergenceAnalyzer.auditResidualHistory(
      divergingResiduals,
      VerdictEngine.defaultConvergencePolicy(),
      false
    );
    expect(audit.isDiverging).toBe(true);
    expect(audit.isConverged).toBe(false);
  });
});
