/**
 * SECP Industrial OS v2 — Linear Solvers Architecture
 * PATCH-055: Conjugate Gradient (CG) Solver for Symmetric Positive Definite Systems
 */

import { LinearSolver } from './LinearSolver';
import { LinearSystem, LinearSystemValidator } from './LinearSystem';
import { SolverConfiguration } from './SolverConfiguration';
import { SolverResult, ResidualNorms, SolverStatus } from './SolverResult';
import { SolverDiagnostic } from './SolverDiagnostics';
import { SparseVector } from './SparseVector';
import { IterativeSolverUtils } from './IterativeSolver';
import { Preconditioner } from './Preconditioner';
import { IdentityPreconditioner } from './IdentityPreconditioner';

export class ConjugateGradientSolver implements LinearSolver {
  public readonly id = 'conjugate-gradient-solver';
  public readonly version = '2.0.0';

  public solve(
    system: LinearSystem,
    config: SolverConfiguration,
    preconditioner?: Preconditioner
  ): SolverResult {
    const configHash = `cg-${config.absoluteTolerance}-${config.relativeTolerance}-${config.maxIterations}`;
    const diagnostics: SolverDiagnostic[] = [];
    const M = preconditioner ?? new IdentityPreconditioner();

    // Validation
    const val = LinearSystemValidator.validate(system);
    if (!val.valid) {
      const initRes: ResidualNorms = { l2: Infinity, linfinity: Infinity, normalized: Infinity };
      return {
        solution: new SparseVector(system.rhs ? system.rhs.length : 0),
        status: 'INVALID_SYSTEM',
        iterations: 0,
        initialResidual: initRes,
        finalResidual: initRes,
        residualHistory: [],
        convergence: false,
        diagnostics: [SolverDiagnostic.DIMENSION_MISMATCH],
        solverId: this.id,
        configurationHash: configHash
      };
    }

    const { matrix, rhs } = system;
    const n = matrix.rows;

    if (!matrix.isSquare()) {
      const initRes = IterativeSolverUtils.computeResidual(matrix, rhs, new SparseVector(n)).norms;
      return {
        solution: new SparseVector(n),
        status: 'INVALID_SYSTEM',
        iterations: 0,
        initialResidual: initRes,
        finalResidual: initRes,
        residualHistory: [],
        convergence: false,
        diagnostics: [SolverDiagnostic.UNSUPPORTED_MATRIX_STRUCTURE],
        solverId: this.id,
        configurationHash: configHash
      };
    }

    // Verify Symmetry & Positive Definiteness
    const isSymmetric = system.symmetry === 'SYMMETRIC' || matrix.isSymmetric(1e-8);
    const isSPD = (system.positiveDefinite === true) || (isSymmetric && !matrix.hasZeroDiagonal());

    if (!isSymmetric || !isSPD) {
      diagnostics.push(SolverDiagnostic.NOT_SPD);
      const initRes = IterativeSolverUtils.computeResidual(matrix, rhs, new SparseVector(n)).norms;
      return {
        solution: new SparseVector(n),
        status: 'INVALID_SYSTEM',
        iterations: 0,
        initialResidual: initRes,
        finalResidual: initRes,
        residualHistory: [],
        convergence: false,
        diagnostics,
        solverId: this.id,
        configurationHash: configHash
      };
    }

    M.setup(matrix);

    let x = system.initialGuess ? system.initialGuess.copy() : new SparseVector(n);
    let r = rhs.subtractVector(matrix.multVector(x));
    let z = M.apply(r);
    let p = z.copy();
    let rzOld = r.dot(z);

    const initialRes = IterativeSolverUtils.computeResidual(matrix, rhs, x);
    const residualHistory: number[] = [initialRes.norms.l2];

    if (IterativeSolverUtils.isConverged(initialRes.norms, initialRes.norms, config)) {
      return {
        solution: x,
        status: 'CONVERGED',
        iterations: 0,
        initialResidual: initialRes.norms,
        finalResidual: initialRes.norms,
        residualHistory,
        convergence: true,
        diagnostics,
        solverId: this.id,
        configurationHash: configHash
      };
    }

    let status: SolverStatus = 'MAX_ITERATIONS';
    let currentRes = initialRes;

    for (let iter = 1; iter <= config.maxIterations; iter++) {
      const Ap = matrix.multVector(p);
      const pAp = p.dot(Ap);

      // Check breakdown (pAp <= 0 for non-zero p in non-SPD case)
      if (pAp <= 1e-16 || !Number.isFinite(pAp)) {
        diagnostics.push(SolverDiagnostic.SOLVER_BREAKDOWN);
        status = 'BREAKDOWN';
        break;
      }

      const alpha = rzOld / pAp;
      x = x.addVector(p, alpha);
      r = r.addVector(Ap, -alpha);

      if (!x.isFinite() || !r.isFinite()) {
        diagnostics.push(SolverDiagnostic.NON_FINITE_SOLUTION);
        status = 'BREAKDOWN';
        break;
      }

      currentRes = IterativeSolverUtils.computeResidual(matrix, rhs, x);
      residualHistory.push(currentRes.norms.l2);

      if (IterativeSolverUtils.isDiverged(currentRes.norms.l2, initialRes.norms.l2, config)) {
        diagnostics.push(SolverDiagnostic.DIVERGENCE_DETECTED);
        status = 'DIVERGED';
        break;
      }

      if (IterativeSolverUtils.isConverged(currentRes.norms, initialRes.norms, config)) {
        status = 'CONVERGED';
        return {
          solution: x,
          status: 'CONVERGED',
          iterations: iter,
          initialResidual: initialRes.norms,
          finalResidual: currentRes.norms,
          residualHistory,
          convergence: true,
          diagnostics,
          solverId: this.id,
          configurationHash: configHash
        };
      }

      if (IterativeSolverUtils.isStagnated(residualHistory, config.stagnationWindow)) {
        diagnostics.push(SolverDiagnostic.STAGNATION_DETECTED);
        status = 'NOT_CONVERGED';
        break;
      }

      z = M.apply(r);
      const rzNew = r.dot(z);
      if (Math.abs(rzOld) < 1e-20) {
        diagnostics.push(SolverDiagnostic.SOLVER_BREAKDOWN);
        status = 'BREAKDOWN';
        break;
      }

      const beta = rzNew / rzOld;
      p = z.addVector(p, beta);
      rzOld = rzNew;
    }

    if (status === 'MAX_ITERATIONS') {
      diagnostics.push(SolverDiagnostic.MAX_ITERATIONS_REACHED);
    }

    return {
      solution: x,
      status,
      iterations: Math.min(residualHistory.length - 1, config.maxIterations),
      initialResidual: initialRes.norms,
      finalResidual: currentRes.norms,
      residualHistory,
      convergence: (status as string) === 'CONVERGED',
      diagnostics,
      solverId: this.id,
      configurationHash: configHash
    };
  }
}
