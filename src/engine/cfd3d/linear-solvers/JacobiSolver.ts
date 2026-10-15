/**
 * SECP Industrial OS v2 — Linear Solvers Architecture
 * PATCH-055: Jacobi Iterative Solver
 */

import { LinearSolver } from './LinearSolver';
import { LinearSystem, LinearSystemValidator } from './LinearSystem';
import { SolverConfiguration } from './SolverConfiguration';
import { SolverResult, ResidualNorms, SolverStatus } from './SolverResult';
import { SolverDiagnostic } from './SolverDiagnostics';
import { SparseVector } from './SparseVector';
import { IterativeSolverUtils } from './IterativeSolver';
import { Preconditioner } from './Preconditioner';

export class JacobiSolver implements LinearSolver {
  public readonly id = 'jacobi-solver';
  public readonly version = '2.0.0';

  public solve(
    system: LinearSystem,
    config: SolverConfiguration,
    preconditioner?: Preconditioner
  ): SolverResult {
    const configHash = `jacobi-${config.absoluteTolerance}-${config.relativeTolerance}-${config.maxIterations}`;
    const diagnostics: SolverDiagnostic[] = [];

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

    // Check diagonal elements
    const diag = matrix.getDiagonal();
    for (let i = 0; i < n; i++) {
      if (Math.abs(diag.get(i)) < 1e-15) {
        diagnostics.push(SolverDiagnostic.ZERO_DIAGONAL);
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
    }

    // Initial state
    let xCurr = system.initialGuess ? system.initialGuess.copy() : new SparseVector(n);
    const initialRes = IterativeSolverUtils.computeResidual(matrix, rhs, xCurr);
    const residualHistory: number[] = [initialRes.norms.l2];

    if (IterativeSolverUtils.isConverged(initialRes.norms, initialRes.norms, config, 0)) {
      return {
        solution: xCurr,
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
      const xNext = new SparseVector(n);

      for (let i = 0; i < n; i++) {
        let sumOffDiag = 0.0;
        const row = matrix.rowAccess(i);
        for (const [j, val] of row.entries()) {
          if (i !== j) {
            sumOffDiag += val * xCurr.get(j);
          }
        }
        const bI = rhs.get(i);
        const aII = diag.get(i);
        xNext.set(i, (bI - sumOffDiag) / aII);
      }

      xCurr = xNext;

      if (!xCurr.isFinite()) {
        diagnostics.push(SolverDiagnostic.NON_FINITE_SOLUTION);
        status = 'BREAKDOWN';
        break;
      }

      currentRes = IterativeSolverUtils.computeResidual(matrix, rhs, xCurr);
      residualHistory.push(currentRes.norms.l2);

      if (IterativeSolverUtils.isDiverged(currentRes.norms.l2, initialRes.norms.l2, config)) {
        diagnostics.push(SolverDiagnostic.DIVERGENCE_DETECTED);
        status = 'DIVERGED';
        break;
      }

      if (IterativeSolverUtils.isConverged(currentRes.norms, initialRes.norms, config, iter)) {
        status = 'CONVERGED';
        return {
          solution: xCurr,
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
    }

    if (status === 'MAX_ITERATIONS') {
      diagnostics.push(SolverDiagnostic.MAX_ITERATIONS_REACHED);
    }

    return {
      solution: xCurr,
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
