/**
 * SECP Industrial OS v2 — Linear Solvers Architecture
 * PATCH-055: Abstract Iterative Solver Base & Residual Monitoring Utility
 */

import { LinearSystem } from './LinearSystem';
import { SolverConfiguration } from './SolverConfiguration';
import { ResidualNorms } from './SolverResult';
import { SparseMatrix } from './SparseMatrix';
import { SparseVector } from './SparseVector';

export class IterativeSolverUtils {
  
  /**
   * Computes true residual vector r = b - A*x and its norms
   */
  public static computeResidual(
    matrix: SparseMatrix,
    rhs: SparseVector,
    x: SparseVector
  ): { r: SparseVector; norms: ResidualNorms } {
    const Ax = matrix.multVector(x);
    const r = rhs.subtractVector(Ax);
    const l2 = r.norm2();
    const linfinity = r.normInf();
    const rhsNorm = rhs.norm2();
    const normalized = rhsNorm > 1e-14 ? l2 / rhsNorm : l2;
    return { r, norms: { l2, linfinity, normalized } };
  }

  /**
   * Evaluates convergence against configuration policy
   */
  public static isConverged(
    norms: ResidualNorms,
    initialNorms: ResidualNorms,
    config: SolverConfiguration,
    iteration: number = 1
  ): boolean {
    if (iteration === 0) {
      // Pre-loop verification: Only declare convergence at iteration 0 if residual is strictly at zero precision
      return norms.l2 < 1e-15;
    }
    if (norms.l2 <= config.absoluteTolerance) return true;
    if (initialNorms.l2 > 1e-14 && (norms.l2 / initialNorms.l2) <= config.relativeTolerance) return true;
    if (norms.normalized <= config.relativeTolerance) return true;
    return false;
  }

  /**
   * Evaluates divergence criteria
   */
  public static isDiverged(
    currentL2: number,
    initialL2: number,
    config: SolverConfiguration
  ): boolean {
    if (!Number.isFinite(currentL2)) return true;
    if (initialL2 > 0 && currentL2 > config.divergenceThreshold * Math.max(initialL2, 1e-12)) return true;
    return false;
  }

  /**
   * Evaluates stagnation over stagnation window
   */
  public static isStagnated(
    history: number[],
    window: number,
    stagnationTolerance: number = 1e-12
  ): boolean {
    if (history.length < window) return false;
    const startIdx = history.length - window;
    const startVal = history[startIdx];
    const endVal = history[history.length - 1];
    const diff = Math.abs(startVal - endVal);
    return diff < stagnationTolerance * Math.max(Math.abs(startVal), 1.0);
  }
}
