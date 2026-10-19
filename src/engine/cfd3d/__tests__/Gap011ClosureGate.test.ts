import { describe, it, expect } from 'vitest';
import { Gap011ClosureGate, Gap011GateInput } from '../diagnostics/Gap011ClosureGate';

describe('GAP-011 Closure Gate — Anti-False Closure Forensic Battery', () => {

  it('strictly blocks CLOSED_PROVEN and returns PARTIAL_IMPROVED when Fine mesh fails convergence', () => {
    const input: Gap011GateInput = {
      coarse: { level: 'COARSE', cells: 820, converged: true, forceStabilityPassed: true, iterations: 300, Cl: 0.50, Cd: 0.09, yPlusMean: 50 },
      medium: { level: 'MEDIUM', cells: 1830, converged: true, forceStabilityPassed: true, iterations: 400, Cl: 0.46, Cd: 0.08, yPlusMean: 25 },
      fine: { level: 'FINE', cells: 4550, converged: false, forceStabilityPassed: false, iterations: 500, Cl: -0.50, Cd: 0.66, yPlusMean: 110, terminationReason: 'MAX_ITERATIONS_REACHED' },
      gciReport: { computed: true, numericallyValid: false, meshConverged: false, validated: false, rejectionReason: 'Fine grid failed convergence' },
      referenceTarget: { Cl: 0.44, tolerance: 0.15 }
    };

    const evaluation = Gap011ClosureGate.evaluate(input);

    expect(evaluation.allConditionsPassed).toBe(false);
    expect(evaluation.verdict).toBe('PARTIAL_IMPROVED');
    expect(evaluation.fineMeshConvergenceProven).toBe(false);
    expect(evaluation.forceStabilityProvenOnAllMeshes).toBe(false);
    expect(evaluation.threeMeshGciIndependentlyValidated).toBe(false);
    expect(evaluation.referenceValidationCompleted).toBe(false);
    expect(evaluation.failedConditions).toContain('fineMeshConvergenceProven');
  });

  it('strictly blocks CLOSED_PROVEN when force stability fails on any mesh', () => {
    const input: Gap011GateInput = {
      coarse: { level: 'COARSE', cells: 820, converged: true, forceStabilityPassed: true, iterations: 300, Cl: 0.50, Cd: 0.09, yPlusMean: 50 },
      medium: { level: 'MEDIUM', cells: 1830, converged: true, forceStabilityPassed: false, iterations: 400, Cl: 0.46, Cd: 0.08, yPlusMean: 25 },
      fine: { level: 'FINE', cells: 3600, converged: true, forceStabilityPassed: true, iterations: 500, Cl: 0.44, Cd: 0.012, yPlusMean: 4 },
      gciReport: { computed: true, numericallyValid: true, meshConverged: true, validated: true },
      referenceTarget: { Cl: 0.44, tolerance: 0.15 }
    };

    const evaluation = Gap011ClosureGate.evaluate(input);

    expect(evaluation.allConditionsPassed).toBe(false);
    expect(evaluation.verdict).toBe('PARTIAL_IMPROVED');
    expect(evaluation.failedConditions).toContain('mediumMeshConvergenceProven');
    expect(evaluation.failedConditions).toContain('forceStabilityProvenOnAllMeshes');
  });

  it('strictly blocks CLOSED_PROVEN when GCI report is not validated according to ASME V&V 20', () => {
    const input: Gap011GateInput = {
      coarse: { level: 'COARSE', cells: 820, converged: true, forceStabilityPassed: true, iterations: 300, Cl: 0.50, Cd: 0.09, yPlusMean: 50 },
      medium: { level: 'MEDIUM', cells: 1830, converged: true, forceStabilityPassed: true, iterations: 400, Cl: 0.46, Cd: 0.08, yPlusMean: 25 },
      fine: { level: 'FINE', cells: 3600, converged: true, forceStabilityPassed: true, iterations: 500, Cl: 0.44, Cd: 0.012, yPlusMean: 4 },
      gciReport: { computed: true, numericallyValid: true, meshConverged: false, validated: false, rejectionReason: 'Non-monotonic convergence' },
      referenceTarget: { Cl: 0.44, tolerance: 0.15 }
    };

    const evaluation = Gap011ClosureGate.evaluate(input);

    expect(evaluation.allConditionsPassed).toBe(false);
    expect(evaluation.verdict).toBe('PARTIAL_IMPROVED');
    expect(evaluation.failedConditions).toContain('threeMeshGciIndependentlyValidated');
  });

  it('authorizes CLOSED_PROVEN ONLY when ALL 9 conditions pass rigorously', () => {
    const input: Gap011GateInput = {
      coarse: { level: 'COARSE', cells: 820, converged: true, forceStabilityPassed: true, iterations: 250, Cl: 0.48, Cd: 0.02, yPlusMean: 35 },
      medium: { level: 'MEDIUM', cells: 1830, converged: true, forceStabilityPassed: true, iterations: 320, Cl: 0.45, Cd: 0.014, yPlusMean: 12 },
      fine: { level: 'FINE', cells: 3600, converged: true, forceStabilityPassed: true, iterations: 450, Cl: 0.438, Cd: 0.009, yPlusMean: 2.5 },
      gciReport: { computed: true, numericallyValid: true, meshConverged: true, validated: true, observedOrder: 1.85, gciFinePercent: 2.1, asymptoticRange: 1.01 },
      referenceTarget: { Cl: 0.44, tolerance: 0.15 },
      hashesMatchExecution: true,
      verifierPassed: true
    };

    const evaluation = Gap011ClosureGate.evaluate(input);

    expect(evaluation.allConditionsPassed).toBe(true);
    expect(evaluation.verdict).toBe('CLOSED_PROVEN');
    expect(evaluation.failedConditions.length).toBe(0);
  });

});
