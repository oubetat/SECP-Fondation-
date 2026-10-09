/**
 * SECP Industrial OS v2 — Linear Solvers Analytical Unit Tests
 * PATCH-055
 */

import { describe, test, expect } from 'vitest';
import { SparseMatrix } from '../SparseMatrix';
import { SparseVector } from '../SparseVector';
import { LinearSystem } from '../LinearSystem';
import { DEFAULT_SOLVER_CONFIGURATION } from '../SolverConfiguration';
import { DirectSolver } from '../DirectSolver';
import { JacobiSolver } from '../JacobiSolver';
import { GaussSeidelSolver } from '../GaussSeidelSolver';
import { ConjugateGradientSolver } from '../ConjugateGradientSolver';
import { BiCGSTABSolver } from '../BiCGSTABSolver';
import { JacobiPreconditioner } from '../JacobiPreconditioner';
import { LinearSolverVerificationPrimitives } from '../LinearSolverVerificationPrimitives';

describe('PATCH-055 — Linear Solvers Analytical Tests', () => {

  test('1. 2x2 Analytical Linear System Solution (Direct, Jacobi, GS, CG, BiCGSTAB)', () => {
    // 2x2 System: [2 1; 1 2] [x1 x2]^T = [3 3]^T => Exact solution [1 1]^T
    const A = new SparseMatrix(2, 2);
    A.set(0, 0, 2.0); A.set(0, 1, 1.0);
    A.set(1, 0, 1.0); A.set(1, 1, 2.0);
    const b = new SparseVector([3.0, 3.0]);
    const refX = new SparseVector([1.0, 1.0]);

    const sys: LinearSystem = {
      matrix: A,
      rhs: b,
      symmetry: 'SYMMETRIC',
      positiveDefinite: true
    };

    const direct = new DirectSolver();
    const jacobi = new JacobiSolver();
    const gs = new GaussSeidelSolver();
    const cg = new ConjugateGradientSolver();
    const bicg = new BiCGSTABSolver();

    const resDirect = direct.solve(sys, DEFAULT_SOLVER_CONFIGURATION);
    expect(resDirect.status).toBe('CONVERGED');
    expect(LinearSolverVerificationPrimitives.verifySolutionAgainstReference(resDirect.solution, refX)).toBe(true);

    const resJacobi = jacobi.solve(sys, DEFAULT_SOLVER_CONFIGURATION);
    expect(resJacobi.status).toBe('CONVERGED');
    expect(LinearSolverVerificationPrimitives.verifySolutionAgainstReference(resJacobi.solution, refX)).toBe(true);

    const resGS = gs.solve(sys, DEFAULT_SOLVER_CONFIGURATION);
    expect(resGS.status).toBe('CONVERGED');
    expect(LinearSolverVerificationPrimitives.verifySolutionAgainstReference(resGS.solution, refX)).toBe(true);

    const resCG = cg.solve(sys, DEFAULT_SOLVER_CONFIGURATION);
    expect(resCG.status).toBe('CONVERGED');
    expect(LinearSolverVerificationPrimitives.verifySolutionAgainstReference(resCG.solution, refX)).toBe(true);

    const resBiCG = bicg.solve(sys, DEFAULT_SOLVER_CONFIGURATION);
    expect(resBiCG.status).toBe('CONVERGED');
    expect(LinearSolverVerificationPrimitives.verifySolutionAgainstReference(resBiCG.solution, refX)).toBe(true);
  });

  test('2. 3x3 SPD Poisson Matrix', () => {
    // 3x3 SPD 1D Poisson: [2 -1 0; -1 2 -1; 0 -1 2]
    const A = new SparseMatrix(3, 3);
    A.set(0, 0, 2.0); A.set(0, 1, -1.0);
    A.set(1, 0, -1.0); A.set(1, 1, 2.0); A.set(1, 2, -1.0);
    A.set(2, 1, -1.0); A.set(2, 2, 2.0);
    const b = new SparseVector([1.0, 0.0, 1.0]);
    // Exact sol: [1, 1, 1] -> A*[1,1,1]^T = [2-1=1, -1+2-1=0, -1+2=1]^T
    const refX = new SparseVector([1.0, 1.0, 1.0]);

    const sys: LinearSystem = { matrix: A, rhs: b, symmetry: 'SYMMETRIC', positiveDefinite: true };
    const cg = new ConjugateGradientSolver();
    const res = cg.solve(sys, DEFAULT_SOLVER_CONFIGURATION);

    expect(res.status).toBe('CONVERGED');
    expect(res.finalResidual.l2).toBeLessThan(1e-6);
    expect(LinearSolverVerificationPrimitives.verifySolutionAgainstReference(res.solution, refX)).toBe(true);
  });

  test('3. Non-Symmetric Matrix (BiCGSTAB & Direct)', () => {
    // [3 2; -1 4] [x1 x2]^T = [5 3]^T => x1=1, x2=1
    const A = new SparseMatrix(2, 2);
    A.set(0, 0, 3.0); A.set(0, 1, 2.0);
    A.set(1, 0, -1.0); A.set(1, 1, 4.0);
    const b = new SparseVector([5.0, 3.0]);
    const refX = new SparseVector([1.0, 1.0]);

    const sys: LinearSystem = { matrix: A, rhs: b, symmetry: 'NON_SYMMETRIC', positiveDefinite: false };
    const bicg = new BiCGSTABSolver();
    const res = bicg.solve(sys, DEFAULT_SOLVER_CONFIGURATION);

    expect(res.status).toBe('CONVERGED');
    expect(LinearSolverVerificationPrimitives.verifySolutionAgainstReference(res.solution, refX)).toBe(true);
  });

  test('4. Cross-Solver Consistency on Diagonally Dominant System', () => {
    const A = new SparseMatrix(4, 4);
    for (let i = 0; i < 4; i++) {
      A.set(i, i, 10.0);
      if (i > 0) A.set(i, i - 1, -2.0);
      if (i < 3) A.set(i, i + 1, -2.0);
    }
    const b = new SparseVector([8.0, 6.0, 6.0, 8.0]);
    const sys: LinearSystem = { matrix: A, rhs: b, symmetry: 'SYMMETRIC', positiveDefinite: true };

    const gs = new GaussSeidelSolver();
    const cg = new ConjugateGradientSolver();

    const resGS = gs.solve(sys, DEFAULT_SOLVER_CONFIGURATION);
    const resCG = cg.solve(sys, DEFAULT_SOLVER_CONFIGURATION);

    expect(resGS.status).toBe('CONVERGED');
    expect(resCG.status).toBe('CONVERGED');
    expect(LinearSolverVerificationPrimitives.verifySolutionAgainstReference(resGS.solution, resCG.solution, 1e-4)).toBe(true);
  });

  test('5. Determinism Verification', () => {
    const A = new SparseMatrix(3, 3);
    A.set(0, 0, 4.0); A.set(0, 1, -1.0);
    A.set(1, 0, -1.0); A.set(1, 1, 4.0); A.set(1, 2, -1.0);
    A.set(2, 1, -1.0); A.set(2, 2, 4.0);
    const b = new SparseVector([1.0, 2.0, 3.0]);
    const sys: LinearSystem = { matrix: A, rhs: b, symmetry: 'SYMMETRIC', positiveDefinite: true };

    const cg = new ConjugateGradientSolver();
    expect(LinearSolverVerificationPrimitives.verifySolverDeterminism(cg, sys, DEFAULT_SOLVER_CONFIGURATION)).toBe(true);
  });

  test('6. Jacobi Preconditioner Functionality', () => {
    const A = new SparseMatrix(3, 3);
    A.set(0, 0, 100.0); A.set(0, 1, 1.0);
    A.set(1, 0, 1.0); A.set(1, 1, 50.0); A.set(1, 2, 1.0);
    A.set(2, 1, 1.0); A.set(2, 2, 200.0);

    const precond = new JacobiPreconditioner();
    expect(LinearSolverVerificationPrimitives.verifyPreconditioner(precond, A)).toBe(true);
  });
});
