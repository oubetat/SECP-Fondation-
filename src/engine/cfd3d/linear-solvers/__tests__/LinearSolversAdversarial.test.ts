/**
 * SECP Industrial OS v2 — Linear Solvers Adversarial Unit Tests
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
import { JacobiSolver } from '../JacobiSolver';
import { DirectSolver } from '../DirectSolver';
import { SolverDiagnostic } from '../SolverDiagnostics';

describe('PATCH-055 — Linear Solvers Adversarial Tests', () => {

  test('1. Rejection of Non-SPD Matrix in Conjugate Gradient Solver', () => {
    // Non-symmetric matrix
    const A = new SparseMatrix(2, 2);
    A.set(0, 0, 1.0); A.set(0, 1, 10.0);
    A.set(1, 0, -10.0); A.set(1, 1, 1.0);
    const b = new SparseVector([1.0, 1.0]);

    const sys: LinearSystem = { matrix: A, rhs: b, symmetry: 'NON_SYMMETRIC', positiveDefinite: false };
    const cg = new ConjugateGradientSolver();
    const res = cg.solve(sys, DEFAULT_SOLVER_CONFIGURATION);

    expect(res.status).toBe('INVALID_SYSTEM');
    expect(res.convergence).toBe(false);
    expect(res.diagnostics).toContain(SolverDiagnostic.NOT_SPD);
  });

  test('2. Rejection of Mismatched Dimensions', () => {
    const A = new SparseMatrix(3, 3);
    const b = new SparseVector([1.0, 2.0]); // Length 2 != 3

    const sys: LinearSystem = { matrix: A, rhs: b };
    const gs = new GaussSeidelSolver();
    const res = gs.solve(sys, DEFAULT_SOLVER_CONFIGURATION);

    expect(res.status).toBe('INVALID_SYSTEM');
    expect(res.diagnostics).toContain(SolverDiagnostic.DIMENSION_MISMATCH);
  });

  test('3. Zero Diagonal Matrix Handling', () => {
    const A = new SparseMatrix(2, 2);
    A.set(0, 0, 0.0); A.set(0, 1, 1.0);
    A.set(1, 0, 1.0); A.set(1, 1, 2.0);
    const b = new SparseVector([1.0, 1.0]);

    const sys: LinearSystem = { matrix: A, rhs: b };
    const jacobi = new JacobiSolver();
    const res = jacobi.solve(sys, DEFAULT_SOLVER_CONFIGURATION);

    expect(res.status).toBe('INVALID_SYSTEM');
    expect(res.diagnostics).toContain(SolverDiagnostic.ZERO_DIAGONAL);
  });

  test('4. Non-Finite (NaN) Input Detection in SparseVector / SparseMatrix', () => {
    const vec = new SparseVector(2);
    expect(() => vec.set(0, NaN)).toThrow();

    const mat = new SparseMatrix(2, 2);
    expect(() => mat.set(0, 0, Infinity)).toThrow();
  });

  test('5. Divergence Detection on Unstable System', () => {
    // Highly off-diagonally dominant matrix causes Jacobi to diverge
    const A = new SparseMatrix(2, 2);
    A.set(0, 0, 0.1); A.set(0, 1, 10.0);
    A.set(1, 0, 10.0); A.set(1, 1, 0.1);
    const b = new SparseVector([1.0, 1.0]);

    const sys: LinearSystem = { matrix: A, rhs: b };
    const jacobi = new JacobiSolver();
    const config = { ...DEFAULT_SOLVER_CONFIGURATION, divergenceThreshold: 5.0 };
    const res = jacobi.solve(sys, config);

    expect(res.status === 'DIVERGED' || res.status === 'NOT_CONVERGED' || res.status === 'MAX_ITERATIONS').toBe(true);
  });

  test('6. Singular Matrix Handling in Direct Solver', () => {
    const A = new SparseMatrix(2, 2);
    A.set(0, 0, 1.0); A.set(0, 1, 2.0);
    A.set(1, 0, 2.0); A.set(1, 1, 4.0); // Dependent row
    const b = new SparseVector([1.0, 2.0]);

    const sys: LinearSystem = { matrix: A, rhs: b };
    const direct = new DirectSolver();
    const res = direct.solve(sys, DEFAULT_SOLVER_CONFIGURATION);

    expect(res.status).toBe('INVALID_SYSTEM');
    expect(res.diagnostics).toContain(SolverDiagnostic.SINGULAR_SYSTEM);
  });
});
