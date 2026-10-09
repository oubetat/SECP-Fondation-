/**
 * SECP CAD Kernel — GCS 3D Deterministic Solver
 * Phase 2 (PATCH-026)
 */

import { Model3D } from './Constraint3DTypes';
import { Constraint3D } from './Constraint3DModel';
import { Constraint3DSolverResult } from './Constraint3DSolverResult';
import { Constraint3DSystem } from './Constraint3DSystem';
import { Constraint3DEvaluator } from './Constraint3DEvaluator';
import { Constraint3DJacobian } from './Constraint3DJacobian';
import { Constraint3DValidator } from './Constraint3DValidator';
import { DegreeOfFreedom3DAnalyzer } from './DegreeOfFreedom3DAnalyzer';

export class Deterministic3DSolver {
  /**
   * Solves a 3D geometric constraint system using a damped Gauss-Newton
   * (Levenberg-Marquardt style) algorithm with line-search step fallbacks.
   */
  public static solve(
    model: Model3D,
    constraints: readonly Constraint3D[],
    options: { maxIterations?: number; tolerance?: number } = {}
  ): Constraint3DSolverResult {
    const maxIterations = options.maxIterations ?? 100;
    const tolerance = options.tolerance ?? 1e-7;

    // 1. Static Validation
    const valRes = Constraint3DValidator.validate(model, constraints);
    const diagnostics = [...valRes.diagnostics];

    if (!valRes.valid) {
      const dofReport = DegreeOfFreedom3DAnalyzer.analyze(model, constraints);
      return {
        success: false,
        converged: false,
        model,
        iterations: 0,
        residualNorm: Infinity,
        dofReport,
        diagnostics,
        evidenceHash: 'HASH-FAILED-VALIDATION',
        solvedAt: new Date().toISOString(),
      };
    }

    // 2. Initialize Solver State
    const system = new Constraint3DSystem(model);
    const n = system.getDimension();

    if (n === 0 || constraints.length === 0) {
      const dofReport = DegreeOfFreedom3DAnalyzer.analyze(model, constraints);
      return {
        success: true,
        converged: true,
        model,
        iterations: 0,
        residualNorm: 0,
        dofReport,
        diagnostics,
        evidenceHash: 'HASH-EMPTY-SYSTEM',
        solvedAt: new Date().toISOString(),
      };
    }

    let x = system.getVector();
    let r = Constraint3DEvaluator.evaluate(system, constraints);
    let rNorm = this.computeNorm(r);

    if (rNorm <= tolerance) {
      const J = Constraint3DJacobian.compute(system, constraints);
      const dofReport = DegreeOfFreedom3DAnalyzer.analyze(model, constraints, J);
      return {
        success: true,
        converged: true,
        model,
        iterations: 0,
        residualNorm: rNorm,
        dofReport,
        diagnostics,
        evidenceHash: 'HASH-INSTANT-CONVERGENCE',
        solvedAt: new Date().toISOString(),
      };
    }

    let iter = 0;
    let converged = false;
    let lambda = 1e-3;

    while (iter < maxIterations) {
      iter++;

      // Compute Jacobian J (m x n)
      const J = Constraint3DJacobian.compute(system, constraints);

      // Compute Normal Equations: J^T * J * deltaX = -J^T * r
      const JtJ = Array.from({ length: n }, () => new Array(n).fill(0));
      const Jtr = new Array(n).fill(0);

      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          let sum = 0;
          for (let k = 0; k < J.length; k++) {
            sum += J[k][i] * J[k][j];
          }
          JtJ[i][j] = sum;
        }

        let sumR = 0;
        for (let k = 0; k < J.length; k++) {
          sumR += J[k][i] * r[k];
        }
        Jtr[i] = sumR;
      }

      let stepAccepted = false;
      let x_new = [...x];
      let rNorm_new = rNorm;
      let r_new = [...r];

      // Try solving with Levenberg-Marquardt damping
      for (let attempt = 0; attempt < 5; attempt++) {
        const A = JtJ.map((row, i) => row.map((val, j) => (i === j ? val + lambda : val)));
        const b = Jtr.map(val => -val);

        try {
          const deltaX = this.solveLinearSystem(A, b);

          x_new = x.map((val, i) => val + deltaX[i]);
          system.updateFromVector(x_new);
          r_new = Constraint3DEvaluator.evaluate(system, constraints);
          rNorm_new = this.computeNorm(r_new);

          if (rNorm_new < rNorm) {
            x = x_new;
            r = r_new;
            rNorm = rNorm_new;
            lambda *= 0.1;
            stepAccepted = true;
            break;
          } else {
            lambda *= 10;
          }
        } catch {
          lambda *= 10;
        }
      }

      // Fallback line-search if Marquardt steps fail to improve residue
      if (!stepAccepted) {
        const A = JtJ.map((row, i) => row.map((val, j) => (i === j ? val + 1e-4 : val)));
        const b = Jtr.map(val => -val);
        try {
          const deltaX = this.solveLinearSystem(A, b);
          let alpha = 1.0;
          while (alpha > 1e-4) {
            x_new = x.map((val, i) => val + alpha * deltaX[i]);
            system.updateFromVector(x_new);
            r_new = Constraint3DEvaluator.evaluate(system, constraints);
            rNorm_new = this.computeNorm(r_new);
            if (rNorm_new < rNorm) {
              x = x_new;
              r = r_new;
              rNorm = rNorm_new;
              stepAccepted = true;
              break;
            }
            alpha *= 0.5;
          }
        } catch {
          // Linear system singular or unstable
          break;
        }
      }

      // Check convergence criteria
      if (rNorm <= tolerance) {
        converged = true;
        break;
      }
    }

    // 3. Finalize Solver States and Metrics
    const finalModel = system.reconstructModel(model);
    const finalJ = Constraint3DJacobian.compute(system, constraints);
    const dofReport = DegreeOfFreedom3DAnalyzer.analyze(finalModel, constraints, finalJ);

    if (!converged) {
      diagnostics.push({
        severity: 'WARNING',
        code: 'NOT_CONVERGED',
        message: `Solver completed but did not converge to target tolerance of ${tolerance} within ${iter} iterations`,
      });
    }

    const rawData = JSON.stringify({
      finalModelId: finalModel.id,
      residualNorm: rNorm,
      iterations: iter,
      converged,
      rank: dofReport.independentConstraintRank,
    });
    const evidenceHash = this.deterministicHash(rawData);

    return {
      success: converged,
      converged,
      model: finalModel,
      iterations: iter,
      residualNorm: rNorm,
      dofReport,
      diagnostics,
      evidenceHash,
      solvedAt: new Date().toISOString(),
    };
  }

  private static computeNorm(v: number[]): number {
    let sumSq = 0;
    for (const val of v) {
      sumSq += val * val;
    }
    return Math.sqrt(sumSq);
  }

  private static solveLinearSystem(A: number[][], b: number[]): number[] {
    const n = b.length;
    const M = A.map((row, i) => [...row, b[i]]);

    for (let i = 0; i < n; i++) {
      let maxEl = Math.abs(M[i][i]);
      let maxRow = i;
      for (let k = i + 1; k < n; k++) {
        if (Math.abs(M[k][i]) > maxEl) {
          maxEl = Math.abs(M[k][i]);
          maxRow = k;
        }
      }

      if (maxEl < 1e-15) {
        throw new Error('Matrix is singular or near-singular');
      }

      const temp = M[maxRow];
      M[maxRow] = M[i];
      M[i] = temp;

      for (let k = i + 1; k < n; k++) {
        const c = -M[k][i] / M[i][i];
        for (let j = i; j < n + 1; j++) {
          if (i === j) {
            M[k][j] = 0;
          } else {
            M[k][j] += c * M[i][j];
          }
        }
      }
    }

    const x = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      x[i] = M[i][n] / M[i][i];
      for (let k = i - 1; k >= 0; k--) {
        M[k][n] -= M[k][i] * x[i];
      }
    }
    return x;
  }

  private static deterministicHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return 'EVIDENCE-3D-GCS-' + Math.abs(hash).toString(16).toUpperCase();
  }
}
