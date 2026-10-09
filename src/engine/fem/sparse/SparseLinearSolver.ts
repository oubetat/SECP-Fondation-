import { SparseMatrix } from "./SparseMatrix";
import { SparseCholeskySolver, SparseLDLtSolver, SparseLUSolver } from "./DirectSolvers";
import { ConjugateGradientSolver, GMRESSolver } from "./IterativeSolvers";
import { IPreconditioner, IdentityPreconditioner, JacobiPreconditioner, IncompleteCholeskyPreconditioner } from "./Preconditioner";
import { SparseMemoryProfiler } from "./SparseMemoryProfiler";
import { MatrixOrdering } from "./MatrixOrdering";

export type SolverMode = 'AUTO' | 'DIRECT_CHOLESKY' | 'DIRECT_LDL_T' | 'DIRECT_LU' | 'ITERATIVE_CG' | 'ITERATIVE_PCG' | 'ITERATIVE_GMRES';

export interface SparseSolverOptions {
  mode?: SolverMode;
  preconditionerType?: 'NONE' | 'JACOBI' | 'INCOMPLETE_CHOLESKY' | 'INCOMPLETE_LU';
  maxIterations?: number;
  tolerance?: number;
  useRCMOrdering?: boolean;
}

export interface SparseDiagnosticsReport {
  dimensions: { rows: number; cols: number };
  nnz: number;
  sparsityRatio: number;
  density: number;
  isSymmetric: boolean;
  symmetryMaxDiff: number;
  isPositiveDefinite: boolean;
  minDiagonal: number;
  conditionEstimate: number;
  memorySavingsPercentage: number;
  rcmBandwidthReduction?: { initial: number; reduced: number };
}

export interface SparseSolverResult {
  success: boolean;
  solution: Float64Array;
  iterations: number;
  initialResidualNorm: number;
  finalResidualNorm: number;
  relativeResidual: number;
  solveTimeMs: number;
  solverType: string;
  preconditionerType: string;
  diagnostics: SparseDiagnosticsReport;
  failureReason?: string;
}

export class SparseLinearSolver {
  /**
   * Primary entry point to solve Sparse System A * x = b with full diagnostics and evidence.
   */
  static solve(A: SparseMatrix, b: Float64Array, options: SparseSolverOptions = {}): SparseSolverResult {
    const startTime = performance.now();
    const mode = options.mode ?? 'AUTO';
    const tol = options.tolerance ?? 1e-10;

    // 1. Matrix Property Inspection & Diagnostics
    const symCheck = A.isSymmetric();
    const pdCheck = A.positiveDefinitenessCheck();
    const memProfile = SparseMemoryProfiler.profile(A.storage);

    // Bandwidth check & optional RCM reordering
    let solveMatrix = A;
    let solveB = b;
    let invPerm: Int32Array | null = null;
    let rcmReduction: { initial: number; reduced: number } | undefined = undefined;

    if (options.useRCMOrdering) {
      const rcmResult = MatrixOrdering.computeRCM(A);
      solveMatrix = rcmResult.reorderedMatrix;
      rcmReduction = { initial: rcmResult.initialBandwidth, reduced: rcmResult.reorderedBandwidth };

      // Permute RHS: b_new = P * b
      solveB = new Float64Array(b.length);
      for (let i = 0; i < b.length; i++) {
        solveB[rcmResult.invPermutation[i]] = b[i];
      }
      invPerm = rcmResult.invPermutation;
    }

    // Condition estimate via Gershgorin ratio
    const diag = solveMatrix.diagonal();
    let maxDiag = 0;
    let minDiag = Infinity;
    for (let i = 0; i < diag.length; i++) {
      const absD = Math.abs(diag[i]);
      if (absD > maxDiag) maxDiag = absD;
      if (absD < minDiag) minDiag = absD;
    }
    const conditionEstimate = minDiag > 0 ? maxDiag / minDiag : Infinity;

    const diagnostics: SparseDiagnosticsReport = {
      dimensions: { rows: A.rows, cols: A.cols },
      nnz: A.nnz,
      sparsityRatio: A.sparsityRatio,
      density: A.density,
      isSymmetric: symCheck.isSymmetric,
      symmetryMaxDiff: symCheck.maxDiff,
      isPositiveDefinite: pdCheck.isPositiveDefinite,
      minDiagonal: pdCheck.minDiagonal,
      conditionEstimate,
      memorySavingsPercentage: memProfile.savingsPercentage,
      rcmBandwidthReduction: rcmReduction
    };

    // Sanity checks: check for NaN/Inf in RHS or matrix
    for (let i = 0; i < b.length; i++) {
      if (Number.isNaN(b[i]) || !Number.isFinite(b[i])) {
        return {
          success: false,
          solution: new Float64Array(0),
          iterations: 0,
          initialResidualNorm: Infinity,
          finalResidualNorm: Infinity,
          relativeResidual: Infinity,
          solveTimeMs: performance.now() - startTime,
          solverType: mode,
          preconditionerType: options.preconditionerType ?? 'NONE',
          diagnostics,
          failureReason: `Non-finite or NaN value detected in RHS load vector at index ${i}`
        };
      }
    }

    // 2. Select and execute solver
    let resultSol: Float64Array = new Float64Array(A.rows);
    let iterations = 1;
    let initResNorm = 0;
    let finalResNorm = 0;
    let relRes = 0;
    let actualSolver = mode;
    let actualPrecond = options.preconditionerType ?? 'NONE';
    let success = false;
    let failureReason: string | undefined = undefined;

    const isSPD = symCheck.isSymmetric && pdCheck.isPositiveDefinite;

    if (mode === 'AUTO') {
      if (isSPD) {
        if (A.rows <= 1500) {
          actualSolver = 'DIRECT_CHOLESKY';
        } else {
          actualSolver = 'ITERATIVE_PCG';
        }
      } else if (symCheck.isSymmetric) {
        actualSolver = 'DIRECT_LDL_T';
      } else {
        actualSolver = 'DIRECT_LU';
      }
    }

    if (actualSolver === 'DIRECT_CHOLESKY' || actualSolver === 'AUTO') {
      const res = SparseCholeskySolver.solve(solveMatrix, solveB);
      success = res.success;
      resultSol = res.solution;
      initResNorm = res.residualNorm;
      finalResNorm = res.residualNorm;
      relRes = res.relativeResidual;
      iterations = 1;
      actualSolver = 'DIRECT_CHOLESKY';
      failureReason = res.errorMessage;
    } else if (actualSolver === 'DIRECT_LDL_T') {
      const res = SparseLDLtSolver.solve(solveMatrix, solveB);
      success = res.success;
      resultSol = res.solution;
      initResNorm = res.residualNorm;
      finalResNorm = res.residualNorm;
      relRes = res.relativeResidual;
      iterations = 1;
      failureReason = res.errorMessage;
    } else if (actualSolver === 'DIRECT_LU') {
      const res = SparseLUSolver.solve(solveMatrix, solveB);
      success = res.success;
      resultSol = res.solution;
      initResNorm = res.residualNorm;
      finalResNorm = res.residualNorm;
      relRes = res.relativeResidual;
      iterations = 1;
      failureReason = res.errorMessage;
    } else if (actualSolver === 'ITERATIVE_CG' || actualSolver === 'ITERATIVE_PCG') {
      let precond: IPreconditioner = new IdentityPreconditioner();
      if (options.preconditionerType === 'JACOBI') {
        precond = new JacobiPreconditioner(solveMatrix);
      } else if (options.preconditionerType === 'INCOMPLETE_CHOLESKY') {
        precond = new IncompleteCholeskyPreconditioner(solveMatrix);
      } else if (actualSolver === 'ITERATIVE_PCG') {
        precond = new JacobiPreconditioner(solveMatrix);
        actualPrecond = 'JACOBI';
      }

      const res = ConjugateGradientSolver.solve(solveMatrix, solveB, {
        maxIterations: options.maxIterations,
        tolerance: tol,
        preconditioner: precond
      });

      success = res.success;
      resultSol = res.solution;
      iterations = res.iterations;
      initResNorm = res.initialResidualNorm;
      finalResNorm = res.finalResidualNorm;
      relRes = res.relativeResidual;
      actualSolver = res.solverType as any;
      actualPrecond = res.preconditionerType as any;
      failureReason = res.errorMessage;
    } else if (actualSolver === 'ITERATIVE_GMRES') {
      const res = GMRESSolver.solve(solveMatrix, solveB, {
        maxIterations: options.maxIterations,
        tolerance: tol
      });

      success = res.success;
      resultSol = res.solution;
      iterations = res.iterations;
      initResNorm = res.initialResidualNorm;
      finalResNorm = res.finalResidualNorm;
      relRes = res.relativeResidual;
      actualSolver = 'GMRES' as any;
      failureReason = res.errorMessage;
    }

    // Un-permute solution if RCM ordering was applied
    let finalSolution = resultSol;
    if (options.useRCMOrdering && invPerm && resultSol.length > 0) {
      finalSolution = new Float64Array(b.length);
      for (let newIdx = 0; newIdx < b.length; newIdx++) {
        const oldIdx = invPerm[newIdx]; // mapping
        finalSolution[oldIdx] = resultSol[newIdx];
      }
    }

    const endTime = performance.now();

    return {
      success,
      solution: finalSolution,
      iterations,
      initialResidualNorm: initResNorm,
      finalResidualNorm: finalResNorm,
      relativeResidual: relRes,
      solveTimeMs: endTime - startTime,
      solverType: actualSolver,
      preconditionerType: actualPrecond,
      diagnostics,
      failureReason
    };
  }
}
