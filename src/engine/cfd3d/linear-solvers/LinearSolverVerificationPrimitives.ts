/**
 * SECP Industrial OS v2 — Linear Solvers Architecture
 * PATCH-055: Verification Primitives (Pure Verification Functions)
 */

import { LinearSystem } from './LinearSystem';
import { SparseMatrix } from './SparseMatrix';
import { SparseVector } from './SparseVector';
import { SolverResult } from './SolverResult';
import { SolverConfiguration } from './SolverConfiguration';
import { LinearSolver } from './LinearSolver';
import { Preconditioner } from './Preconditioner';

export class LinearSolverVerificationPrimitives {

  public static verifyLinearSystemDimensions(system: LinearSystem): boolean {
    if (!system.matrix || !system.rhs) return false;
    if (system.matrix.rows !== system.rhs.length) return false;
    if (system.initialGuess && system.initialGuess.length !== system.matrix.cols) return false;
    return true;
  }

  public static verifyMatrixFinite(matrix: SparseMatrix): boolean {
    return matrix.isFinite();
  }

  public static verifyResidual(
    system: LinearSystem,
    solution: SparseVector,
    reportedResidual: number,
    tolerance: number = 1e-6
  ): boolean {
    const Ax = system.matrix.multVector(solution);
    const r = system.rhs.subtractVector(Ax);
    const actualL2 = r.norm2();
    return Math.abs(actualL2 - reportedResidual) <= tolerance * Math.max(actualL2, 1.0);
  }

  public static verifySolverConvergence(
    result: SolverResult,
    config: SolverConfiguration
  ): boolean {
    if (result.status === 'CONVERGED') {
      return result.finalResidual.l2 <= config.absoluteTolerance || 
             result.finalResidual.normalized <= config.relativeTolerance;
    }
    return true;
  }

  public static verifySolverDeterminism(
    solver: LinearSolver,
    system: LinearSystem,
    config: SolverConfiguration
  ): boolean {
    const res1 = solver.solve(system, config);
    const res2 = solver.solve(system, config);

    if (res1.status !== res2.status) return false;
    if (res1.iterations !== res2.iterations) return false;
    if (Math.abs(res1.finalResidual.l2 - res2.finalResidual.l2) > 1e-12) return false;

    for (let i = 0; i < res1.solution.length; i++) {
      if (Math.abs(res1.solution.get(i) - res2.solution.get(i)) > 1e-12) {
        return false;
      }
    }
    return true;
  }

  public static verifySolutionAgainstReference(
    computed: SparseVector,
    reference: SparseVector,
    tolerance: number = 1e-5
  ): boolean {
    if (computed.length !== reference.length) return false;
    const diff = computed.subtractVector(reference);
    return diff.norm2() <= tolerance * Math.max(reference.norm2(), 1.0);
  }

  public static verifySolverApplicability(
    solver: LinearSolver,
    system: LinearSystem
  ): boolean {
    if (solver.id.includes('conjugate-gradient')) {
      const isSymmetric = system.symmetry === 'SYMMETRIC' || system.matrix.isSymmetric(1e-8);
      const isSPD = system.positiveDefinite === true || (isSymmetric && !system.matrix.hasZeroDiagonal());
      return isSymmetric && isSPD;
    }
    return true;
  }

  public static verifyPreconditioner(
    preconditioner: Preconditioner,
    matrix: SparseMatrix
  ): boolean {
    try {
      preconditioner.setup(matrix);
      const testVec = new SparseVector(matrix.rows);
      for (let i = 0; i < matrix.rows; i++) testVec.set(i, 1.0);
      const z = preconditioner.apply(testVec);
      return z.length === matrix.rows && z.isFinite();
    } catch {
      return false;
    }
  }
}
