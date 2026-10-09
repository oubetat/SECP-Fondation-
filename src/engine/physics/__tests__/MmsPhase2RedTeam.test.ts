/**
 * SECP Industrial OS — CAP-SUP-003 Phase 2 Red-Team Adversarial Test Suite
 *
 * Attacks physics verification across:
 * - ASME V&V 20-2009 Standard Compliance
 * - Decoupled Independent Oracle Comparisons
 * - 7 Critical Negative & Failure Modes:
 *   1. Insufficient refinement (r < 1.1)
 *   2. Non-convergent / oscillatory sequence (R outside (0, 1))
 *   3. Wrong boundary conditions (Dirichlet boundary mismatch)
 *   4. Inconsistent source term (S != L(u_exact))
 *   5. Distorted non-uniform mesh without metric tensor
 *   6. Unstable / diverging solver
 *   7. Residual stagnation / premature iteration truncation
 */

import { describe, it, expect } from 'vitest';
import { AsmeVv20MmsEngine } from '../AsmeVv20MmsEngine';
import { IndependentMmsOracle } from '../IndependentMmsOracle';

describe('CAP-SUP-003 Phase 2 Red-Team — MMS + ASME V&V 20 / GCI Verification', () => {

  // =========================================================================
  // NOMINAL VERIFICATION AGAINST INDEPENDENT ORACLE
  // =========================================================================

  it('V1: Formally verifies 1D Convection-Diffusion BVP against independent analytical truth', () => {
    const report = AsmeVv20MmsEngine.executeConvectionDiffusionStudy();

    // 1. Solver algebraic convergence
    expect(report.solverConverged).toBe(true);
    expect(report.status).toBe('VERIFIED');
    expect(report.rejectionReasons.length).toBe(0);

    // 2. Mesh refinement and monotonic convergence
    expect(report.refinementRatio21).toBe(2.0);
    expect(report.refinementRatio32).toBe(2.0);
    expect(report.convergenceRegime).toBe('MONOTONIC_CONVERGENCE');
    expect(report.monotonicityRatio).toBeGreaterThan(0.0);
    expect(report.monotonicityRatio).toBeLessThan(1.0);

    // 3. Observed order of accuracy (Theoretical = 2.0)
    expect(report.theoreticalOrder).toBe(2.0);
    expect(report.observedOrder).toBeGreaterThan(1.85);
    expect(report.observedOrder).toBeLessThan(2.15);
    expect(report.orderVerified).toBe(true);

    // 4. Comparison against decoupled Independent Oracle
    const oracleGci = IndependentMmsOracle.computeIndependentGci(
      report.fineQoI,
      report.mediumQoI,
      report.coarseQoI,
      report.refinementRatio21,
      report.refinementRatio32,
      1.25
    );

    // Verify ASME V&V 20 GCI values match decoupled oracle to numerical precision
    expect(Math.abs(report.fineGciPercent - oracleGci.fineGciPercent)).toBeLessThan(1e-6);
    expect(Math.abs(report.richardsonExtrapolated - oracleGci.extrapolatedValue)).toBeLessThan(1e-8);
    expect(Math.abs(report.asymptoticRangeRatio - oracleGci.asymptoticIndex)).toBeLessThan(1e-4);

    // 5. Asymptotic range verification (0.90 <= Ar <= 1.10)
    expect(report.asymptoticRangeRatio).toBeGreaterThanOrEqual(0.90);
    expect(report.asymptoticRangeRatio).toBeLessThanOrEqual(1.10);
    expect(report.isInAsymptoticRange).toBe(true);

    // 6. Extrapolation accuracy: Richardson extrapolated value is closer to exact truth than fine grid
    const exactTruth = report.exactQoI; // 1.0 at x = 0.5
    const errFine = Math.abs(report.fineQoI - exactTruth);
    const errExtrapolated = Math.abs(report.richardsonExtrapolated - exactTruth);
    expect(errExtrapolated).toBeLessThan(errFine);

    // 7. Uncertainty bounds
    expect(report.fineGciPercent).toBeLessThan(1.0); // Fine GCI under 1%
    expect(report.discretizationUncertainty).toBeGreaterThan(0);
    expect(report.asmeGciVerified).toBe(true);
  });

  it('V2: Formally verifies 2D Poisson BVP with 5-point discrete Laplacian against exact solution', () => {
    const report = AsmeVv20MmsEngine.executePoisson2DStudy();

    expect(report.solverConverged).toBe(true);
    expect(report.status).toBe('VERIFIED');
    expect(report.convergenceRegime).toBe('MONOTONIC_CONVERGENCE');
    
    // Observed order p ~ 2.0
    expect(report.observedOrder).toBeGreaterThan(1.85);
    expect(report.observedOrder).toBeLessThan(2.15);
    expect(report.orderVerified).toBe(true);

    // Asymptotic range check
    expect(report.asymptoticRangeRatio).toBeGreaterThanOrEqual(0.90);
    expect(report.asymptoticRangeRatio).toBeLessThanOrEqual(1.10);
    expect(report.isInAsymptoticRange).toBe(true);

    // Extrapolation comparison with analytical 2D integral 4 / pi^2
    const exact2DTruth = IndependentMmsOracle.AnalyticalTruth.exact2DIntegral;
    const errFine = Math.abs(report.fineQoI - exact2DTruth);
    const errExtrapolated = Math.abs(report.richardsonExtrapolated - exact2DTruth);
    expect(errExtrapolated).toBeLessThan(errFine);
  });

  // =========================================================================
  // ADVERSARIAL ATTACKS (FAIL-CLOSED INTEGRITY CHECKS)
  // =========================================================================

  it('A1: Rejects study when refinement ratio is insufficient (r < 1.10)', () => {
    const report = AsmeVv20MmsEngine.executeConvectionDiffusionStudy({
      insufficientRefinement: true
    });

    expect(report.status).toBe('REJECTED');
    expect(report.asmeGciVerified).toBe(false);
    expect(report.rejectionReasons.some(r => r.includes('below the ASME V&V 20 mandatory minimum'))).toBe(true);
  });

  it('A2: Rejects study when sequence exhibits non-convergent or oscillatory divergence', () => {
    const report = AsmeVv20MmsEngine.executeConvectionDiffusionStudy({
      nonConvergentSequence: true
    });

    expect(report.status).toBe('REJECTED');
    expect(report.convergenceRegime).not.toBe('MONOTONIC_CONVERGENCE');
    expect(report.asmeGciVerified).toBe(false);
    expect(report.rejectionReasons.some(r => r.includes('divergence') || r.includes('Oscillatory'))).toBe(true);
  });

  it('A3: Rejects study when Dirichlet boundary conditions are inconsistent with analytical solution', () => {
    const report = AsmeVv20MmsEngine.executeConvectionDiffusionStudy({
      wrongBoundaryConditions: true
    });

    expect(report.status).toBe('REJECTED');
    expect(report.orderVerified).toBe(false);
    expect(report.rejectionReasons.length).toBeGreaterThan(0);
  });

  it('A4: Rejects study when source term is mathematically inconsistent with governing differential operator', () => {
    const report = AsmeVv20MmsEngine.executeConvectionDiffusionStudy({
      inconsistentSourceTerm: true
    });

    expect(report.status).toBe('REJECTED');
    expect(report.orderVerified).toBe(false);
  });

  it('A5: Rejects study when mesh is non-uniformly distorted without metric transformation', () => {
    const report = AsmeVv20MmsEngine.executeConvectionDiffusionStudy({
      distortedMesh: true
    });

    expect(report.status).toBe('REJECTED');
    // Distorted grid degrades 2nd order convergence or breaks asymptotic range
    expect(report.asmeGciVerified).toBe(false);
    expect(report.rejectionReasons.length).toBeGreaterThan(0);
  });

  it('A6: Rejects study when algebraic solver is unstable or diverges', () => {
    const report = AsmeVv20MmsEngine.executeConvectionDiffusionStudy({
      unstableSolver: true
    });

    expect(report.status).toBe('REJECTED');
    expect(report.solverConverged).toBe(false);
    expect(report.rejectionReasons.some(r => r.includes('failed algebraic solver convergence'))).toBe(true);
  });

  it('A7: Rejects study when solver iterations are prematurely truncated (residual stagnation)', () => {
    const report = AsmeVv20MmsEngine.executeConvectionDiffusionStudy({
      residualStagnation: true
    });

    expect(report.status).toBe('REJECTED');
    expect(report.solverConverged).toBe(false);
    expect(report.rejectionReasons.some(r => r.includes('failed algebraic solver convergence'))).toBe(true);
  });

  it('A8: Rejects 2nd-order claim when spatial discretization stencil is degraded to 1st-order upwind', () => {
    const report = AsmeVv20MmsEngine.executeConvectionDiffusionStudy({
      breakConvergence: true
    });

    expect(report.status).toBe('REJECTED');
    // Observed order should be p ~ 1.0, failing the 2nd-order verification gate
    expect(report.observedOrder).toBeLessThan(1.5);
    expect(report.orderVerified).toBe(false);
    expect(report.rejectionReasons.some(r => r.includes('deviates significantly from theoretical order'))).toBe(true);
  });

  // =========================================================================
  // UNKNOWN-UNKNOWN DISCOVERY ATTACKS
  // =========================================================================

  it('U1: Challenges non-integer mesh refinement ratios (r21 = 1.5, r32 = 1.5)', () => {
    const report = AsmeVv20MmsEngine.executeConvectionDiffusionStudy({
      gridSizes: [90, 60, 40] // r21 = 90/60 = 1.5, r32 = 60/40 = 1.5
    });

    expect(report.solverConverged).toBe(true);
    expect(report.status).toBe('VERIFIED');
    expect(report.refinementRatio21).toBe(1.5);
    expect(report.refinementRatio32).toBe(1.5);
    expect(report.observedOrder).toBeGreaterThan(1.85);
    expect(report.observedOrder).toBeLessThan(2.15);
    expect(report.isInAsymptoticRange).toBe(true);
  });

  it('U2: Robustness against near-zero QoI divisor in relative error computation', () => {
    // Independent Oracle must safely handle phi1 = 0 without producing NaN or Infinity
    const gciZero = IndependentMmsOracle.computeIndependentGci(
      0.0,
      1e-4,
      4e-4,
      2.0,
      2.0
    );

    expect(isNaN(gciZero.apparentOrder)).toBe(false);
    expect(isFinite(gciZero.fineGciPercent)).toBe(true);
    expect(isFinite(gciZero.extrapolatedValue)).toBe(true);
  });

  it('U3: Distinguishes between spatial point discretization order and integral super-convergence', () => {
    // Pointwise midpoint evaluation exhibits exact p ~ 2.00
    const pointReport = AsmeVv20MmsEngine.executeConvectionDiffusionStudy();
    expect(Math.abs(pointReport.observedOrder - 2.0)).toBeLessThan(0.15);

    // Discrete L2 norm across all interior nodes also exhibits formal p ~ 2.00
    const l2Coarse = pointReport.gridSolutions[2].l2Error;
    const l2Medium = pointReport.gridSolutions[1].l2Error;
    const l2Fine = pointReport.gridSolutions[0].l2Error;

    const pL2_medium = Math.log(l2Coarse / l2Medium) / Math.log(2.0);
    const pL2_fine = Math.log(l2Medium / l2Fine) / Math.log(2.0);

    expect(pL2_medium).toBeGreaterThan(1.90);
    expect(pL2_medium).toBeLessThan(2.10);
    expect(pL2_fine).toBeGreaterThan(1.90);
    expect(pL2_fine).toBeLessThan(2.10);
  });
});

