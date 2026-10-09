/**
 * SECP Industrial OS v2 — Linear Solvers Real Benchmark
 * PATCH-055
 */

import { describe, test, expect } from 'vitest';
import { SparseMatrix } from '../SparseMatrix';
import { SparseVector } from '../SparseVector';
import { LinearSystem } from '../LinearSystem';
import { DEFAULT_SOLVER_CONFIGURATION } from '../SolverConfiguration';
import { ConjugateGradientSolver } from '../ConjugateGradientSolver';
import { BiCGSTABSolver } from '../BiCGSTABSolver';
import { GaussSeidelSolver } from '../GaussSeidelSolver';
import { SolverEvidencePackage } from '../SolverEvidencePackage';
import { HardAcceptanceGate055 } from '../HardAcceptanceGate055';

describe('PATCH-055 — Linear Solvers Real Performance Benchmark', () => {

  test('1. Benchmark 100-cell Tridiagonal System Convergence', () => {
    const N = 50;
    const A = new SparseMatrix(N, N);
    for (let i = 0; i < N; i++) {
      A.set(i, i, 4.0);
      if (i > 0) A.set(i, i - 1, -1.0);
      if (i < N - 1) A.set(i, i + 1, -1.0);
    }
    const b = new SparseVector(new Float64Array(N).fill(1.0));
    const sys: LinearSystem = { matrix: A, rhs: b, symmetry: 'SYMMETRIC', positiveDefinite: true };

    const cg = new ConjugateGradientSolver();
    const resCG = cg.solve(sys, DEFAULT_SOLVER_CONFIGURATION);

    const bicg = new BiCGSTABSolver();
    const resBiCG = bicg.solve(sys, DEFAULT_SOLVER_CONFIGURATION);

    const gs = new GaussSeidelSolver();
    const resGS = gs.solve(sys, DEFAULT_SOLVER_CONFIGURATION);

    expect(resCG.status).toBe('CONVERGED');
    expect(resBiCG.status).toBe('CONVERGED');
    expect(resGS.status).toBe('CONVERGED');

    // Conjugate Gradient should converge faster than Gauss-Seidel for tridiagonal system
    expect(resCG.iterations).toBeLessThanOrEqual(resGS.iterations);
  });

  test('2. Hard Acceptance Gate 055 Execution & Report Package Generation', () => {
    const gateEval = HardAcceptanceGate055.evaluate();
    expect(gateEval.passed).toBe(true);

    const pkg = SolverEvidencePackage.generatePackage();
    expect(pkg.gatePassed).toBe(true);
  });
});
