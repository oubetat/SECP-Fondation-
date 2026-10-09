/**
 * SECP Industrial OS v2 — Residual Framework Adversarial Tests
 * PATCH-056
 */

import { describe, test, expect } from 'vitest';
import { ResidualVector } from '../ResidualVector';
import { ResidualNormalizer, NormalizationPolicy } from '../ResidualNormalizer';
import { ResidualMonitor } from '../ResidualMonitor';
import { ResidualEquation } from '../ResidualTypes';

describe('PATCH-056 — Residual Framework Adversarial Tests', () => {

  test('1. Rejection of NaN in ResidualVector', () => {
    expect(() => new ResidualVector([1, NaN, 3])).toThrow();
  });

  test('2. Zero Denominator in Normalization', () => {
    const norms = { l1: 1, l2: 1, lInf: 1 };
    const context = ResidualNormalizer.createContext(NormalizationPolicy.FIXED_FLOOR, 0.0, 0.0);
    const result = ResidualNormalizer.normalize(norms, context);
    
    expect(result.diagnostics).toContain('NORMALIZATION_DENOMINATOR_ZERO');
    expect(result.normalized.l2).toBe(1.0); // Returns unnormalized
  });

  test('3. Non-Finite Residual Monitoring', () => {
    const ts = new Date().toISOString();
    const history = [
      {
        iteration: 0,
        absoluteResidual: { l1: 1, l2: 1, lInf: 1 },
        normalizedResidual: { l1: 1, l2: 1, lInf: 1 },
        equation: ResidualEquation.MASS,
        timestamp: ts,
        stateHash: 'h',
        finite: false, // Non-finite
        diagnostics: []
      }
    ];
    const monitor = ResidualMonitor.monitor(history);
    expect(monitor.diverged).toBe(true);
    expect(monitor.diagnostics).toContain('NON_FINITE_RESIDUAL');
  });

  test('4. Oscillation Detection', () => {
    const ts = new Date().toISOString();
    const history = [
      { iteration: 0, absoluteResidual: { l1: 10, l2: 10, lInf: 10 }, normalizedResidual: { l1: 1, l2: 1, lInf: 1 }, equation: ResidualEquation.MASS, timestamp: ts, stateHash: 's', finite: true, diagnostics: [] },
      { iteration: 1, absoluteResidual: { l1: 5, l2: 5, lInf: 5 }, normalizedResidual: { l1: 1, l2: 1, lInf: 1 }, equation: ResidualEquation.MASS, timestamp: ts, stateHash: 's', finite: true, diagnostics: [] },
      { iteration: 2, absoluteResidual: { l1: 8, l2: 8, lInf: 8 }, normalizedResidual: { l1: 1, l2: 1, lInf: 1 }, equation: ResidualEquation.MASS, timestamp: ts, stateHash: 's', finite: true, diagnostics: [] },
      { iteration: 3, absoluteResidual: { l1: 4, l2: 4, lInf: 4 }, normalizedResidual: { l1: 1, l2: 1, lInf: 1 }, equation: ResidualEquation.MASS, timestamp: ts, stateHash: 's', finite: true, diagnostics: [] }
    ];
    const monitor = ResidualMonitor.monitor(history);
    expect(monitor.oscillating).toBe(true);
    expect(monitor.diagnostics).toContain('OSCILLATORY_BEHAVIOR_DETECTED');
  });
});
