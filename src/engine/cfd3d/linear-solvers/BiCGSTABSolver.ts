/**
 * SECP Industrial OS v2 — Linear Solvers Architecture
 * PATCH-055: BiCGSTAB (Biconjugate Gradient Stabilized) Solver for Non-Symmetric Systems
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

export class BiCGSTABSolver implements LinearSolver {
  public readonly id = 'bicgstab-solver';
  public readonly version = '2.0.0';

  public solve(
    system: LinearSystem,
    config: SolverConfiguration,
    preconditioner?: Preconditioner
  ): SolverResult {
    const configHash = `bicgstab-${config.absoluteTolerance}-${config.relativeTolerance}-${config.maxIterations}`;
    const diagnostics: SolverDiagnostic[] = [];
    const M = preconditioner ?? new IdentityPreconditioner();

    // System Validation
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

    M.setup(matrix);

    let x = system.initialGuess ? system.initialGuess.copy() : new SparseVector(n);
    let r = rhs.subtractVector(matrix.multVector(x));
    const r0Hat = r.copy();

    const initialRes = IterativeSolverUtils.computeResidual(matrix, rhs, x);
    const residualHistory: number[] = [initialRes.norms.l2];

    if (IterativeSolverUtils.isConverged(initialRes.norms, initialRes.norms, config, 0)) {
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

    let rhoOld = 1.0;
    let alpha = 1.0;
    let omega = 1.0;

    let p = new SparseVector(n);
    let v = new SparseVector(n);

    let status: SolverStatus = 'MAX_ITERATIONS';
    let currentRes = initialRes;

    for (let iter = 1; iter <= config.maxIterations; iter++) {
      const rhoNew = r0Hat.dot(r);

      if (Math.abs(rhoNew) < 1e-20 || !Number.isFinite(rhoNew)) {
        diagnostics.push(SolverDiagnostic.SOLVER_BREAKDOWN);
        status = 'BREAKDOWN';
        break;
      }

      if (iter === 1) {
        p = r.copy();
      } else {
        const beta = (rhoNew / rhoOld) * (alpha / omega);
        const pSub = p.subtractVector(v.scale(omega));
        p = r.addVector(pSub.scale(beta));
      }

      const pHat = M.apply(p);
      v = matrix.multVector(pHat);

      const r0v = r0Hat.dot(v);
      if (Math.abs(r0v) < 1e-20 || !Number.isFinite(r0v)) {
        diagnostics.push(SolverDiagnostic.SOLVER_BREAKDOWN);
        status = 'BREAKDOWN';
        break;
      }

      alpha = rhoNew / r0v;
      const s = r.subtractVector(v.scale(alpha));
      const sNorm = s.norm2();

      if (sNorm <= config.absoluteTolerance) {
        x = x.addVector(pHat, alpha);
        currentRes = IterativeSolverUtils.computeResidual(matrix, rhs, x);
        residualHistory.push(currentRes.norms.l2);
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

      const sHat = M.apply(s);
      const t = matrix.multVector(sHat);
      const tt = t.dot(t);

      if (Math.abs(tt) < 1e-20 || !Number.isFinite(tt)) {
        diagnostics.push(SolverDiagnostic.SOLVER_BREAKDOWN);
        status = 'BREAKDOWN';
        break;
      }

      omega = t.dot(s) / tt;
      x = x.addVector(pHat, alpha).addVector(sHat, omega);
      r = s.subtractVector(t.scale(omega));

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

      if (IterativeSolverUtils.isConverged(currentRes.norms, initialRes.norms, config, iter)) {
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

      rhoOld = rhoNew;
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
