/**
 * SECP Industrial OS v2 — Residual Framework Unit Tests
 * PATCH-056
 */

import { describe, test, expect } from 'vitest';
import { ResidualVector } from '../ResidualVector';
import { ResidualCalculator } from '../ResidualCalculator';
import { ResidualNormalizer, NormalizationPolicy } from '../ResidualNormalizer';
import { ResidualHistory } from '../ResidualHistory';
import { ResidualMonitor } from '../ResidualMonitor';
import { ResidualEquation, ResidualSample } from '../ResidualTypes';
import { ResidualVerification } from '../ResidualVerification';
import { SparseMatrix, SparseVector } from '../../linear-solvers';

describe('PATCH-056 — Residual Framework Tests', () => {

  test('1. ResidualVector Norms', () => {
    const rv = new ResidualVector([1, -2, 2]);
    expect(rv.l1()).toBe(5);
    expect(rv.l2()).toBe(3);
    expect(rv.lInf()).toBe(2);
  });

  test('2. Algebraic Residual Calculation', () => {
    const A = new SparseMatrix(2, 2);
    A.set(0, 0, 3); A.set(0, 1, 1);
    A.set(1, 0, 1); A.set(1, 1, 2);
    const b = new SparseVector([1, 1]);
    const x = new SparseVector([0.5, 0.5]); // A*x = [2, 1.5]
    
    const r = ResidualCalculator.calculateAlgebraicResidual(A, b, x);
    // r = [1-2, 1-1.5] = [-1, -0.5]
    expect(r.get(0)).toBe(-1.0);
    expect(r.get(1)).toBe(-0.5);
  });

  test('3. Normalization with Floor', () => {
    const norms = { l1: 0.1, l2: 0.1, lInf: 0.1 };
    const context = ResidualNormalizer.createContext(NormalizationPolicy.FIXED_FLOOR, 0.0, 1e-1);
    const result = ResidualNormalizer.normalize(norms, context);
    
    expect(result.normalized.l2).toBe(1.0);
    expect(result.diagnostics).toContain('NORMALIZATION_DENOMINATOR_TOO_SMALL');
  });

  test('4. Divergence Detection', () => {
    const history = new ResidualHistory();
    const ts = new Date().toISOString();
    history.addSample({
      iteration: 0,
      absoluteResidual: { l1: 1, l2: 1, lInf: 1 },
      normalizedResidual: { l1: 1, l2: 1, lInf: 1 },
      equation: ResidualEquation.MASS,
      timestamp: ts,
      stateHash: 's0',
      finite: true,
      diagnostics: []
    });
    history.addSample({
      iteration: 1,
      absoluteResidual: { l1: 1e10, l2: 1e10, lInf: 1e10 },
      normalizedResidual: { l1: 1e10, l2: 1e10, lInf: 1e10 },
      equation: ResidualEquation.MASS,
      timestamp: ts,
      stateHash: 's1',
      finite: true,
      diagnostics: []
    });

    const monitor = ResidualMonitor.monitor(history.getHistory(ResidualEquation.MASS));
    expect(monitor.diverged).toBe(true);
    expect(monitor.diagnostics).toContain('DIVERGENCE_DETECTED');
  });

  test('5. Recomputation Verification', () => {
    const A = new SparseMatrix(1, 1); A.set(0, 0, 1);
    const b = new SparseVector([10]);
    const x = new SparseVector([2]);
    // r = 10 - 1*2 = 8
    
    const sample: ResidualSample = {
      iteration: 0,
      absoluteResidual: { l1: 8, l2: 8, lInf: 8 },
      normalizedResidual: { l1: 1, l2: 1, lInf: 1 },
      equation: ResidualEquation.MASS,
      timestamp: new Date().toISOString(),
      stateHash: 'h',
      finite: true,
      diagnostics: []
    };

    const verif = ResidualVerification.verifyResidualRecomputation(sample, A, b, x);
    expect(verif.valid).toBe(true);

    const badSample = { ...sample, absoluteResidual: { l1: 7, l2: 7, lInf: 7 } };
    const badVerif = ResidualVerification.verifyResidualRecomputation(badSample, A, b, x);
    expect(badVerif.valid).toBe(false);
  });
});
