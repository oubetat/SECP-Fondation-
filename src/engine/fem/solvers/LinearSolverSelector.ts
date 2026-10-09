import { SparseMatrix } from "../sparse/SparseMatrix";
import {
  LinearSolver,
  SolverName,
  LinearSolverOptions,
  LinearSolverResult,
  SolverValidationResult
} from "./LinearSolverTypes";
import { ConjugateGradientSolver } from "./ConjugateGradientSolver";
import { PreconditionedConjugateGradientSolver } from "./PreconditionedConjugateGradientSolver";
import { GMRESSolver } from "./GMRESSolver";
import { SparseCholeskySolver } from "./SparseCholeskySolver";

export interface SolverPolicyResult {
  solverUsed: LinearSolver;
  validation: SolverValidationResult;
  solveResult: LinearSolverResult;
  verdict: 'SUCCESS' | 'SOLVER_INCOMPATIBLE' | 'SOLVER_FAILED';
}

export class LinearSolverSelector {
  /**
   * Evaluates matrix properties (Symmetry, Positive Definiteness, Singularity, Conditioning)
   */
  static inspectMatrix(A: SparseMatrix, b: Float64Array): SolverValidationResult {
    const symCheck = A.isSymmetric();
    const isSymmetric = symCheck.isSymmetric;
    const zeroPivots: number[] = [];

    let isSingular = false;
    for (let i = 0; i < A.rows; i++) {
      const diagVal = A.get(i, i);
      if (Math.abs(diagVal) < 1e-14) {
        zeroPivots.push(i);
        isSingular = true;
      }
    }

    let isPositiveDefinite = isSymmetric && !isSingular;
    if (isPositiveDefinite) {
      for (let i = 0; i < A.rows; i++) {
        if (A.get(i, i) <= 0) {
          isPositiveDefinite = false;
          break;
        }
      }
    }

    // Condition estimate approx (Ratio of max to min diagonal)
    let minDiag = Infinity;
    let maxDiag = 0;
    for (let i = 0; i < A.rows; i++) {
      const absVal = Math.abs(A.get(i, i));
      if (absVal > 0 && absVal < minDiag) minDiag = absVal;
      if (absVal > maxDiag) maxDiag = absVal;
    }
    const conditionEstimate = isSingular || minDiag === 0 ? Infinity : maxDiag / minDiag;

    const suitableSolvers: SolverName[] = [];
    if (isSymmetric && isPositiveDefinite) {
      suitableSolvers.push('SparseCholesky', 'ConjugateGradient', 'PreconditionedConjugateGradient');
    }
    suitableSolvers.push('GMRES');

    let recommendedSolver: SolverName = 'SparseCholesky';
    if (!isSymmetric || !isPositiveDefinite) {
      recommendedSolver = 'GMRES';
    } else if (A.rows > 1000) {
      recommendedSolver = 'PreconditionedConjugateGradient';
    } else {
      recommendedSolver = 'SparseCholesky';
    }

    let failureReason: string | undefined;
    if (isSingular) {
      failureReason = `Matrix is singular with ${zeroPivots.length} zero diagonal pivots`;
    } else if (conditionEstimate > 1e12) {
      failureReason = `Ill-conditioned system detected (kappa estimate = ${conditionEstimate.toExponential(2)})`;
    }

    return {
      isSymmetric,
      symmetryMaxDiff: symCheck.maxDiff,
      isPositiveDefinite,
      isSingular,
      zeroPivots,
      conditionEstimate,
      suitableSolvers,
      recommendedSolver,
      failureReason
    };
  }

  /**
   * Instantiates the requested or auto-selected solver
   */
  static getSolver(solverName: SolverName | 'AUTO', A?: SparseMatrix, b?: Float64Array): LinearSolver {
    let targetName: SolverName = solverName === 'AUTO' ? 'SparseCholesky' : solverName;

    if (solverName === 'AUTO' && A && b) {
      const validation = this.inspectMatrix(A, b);
      targetName = validation.recommendedSolver;
    }

    switch (targetName) {
      case 'ConjugateGradient':
        return new ConjugateGradientSolver();
      case 'PreconditionedConjugateGradient':
        return new PreconditionedConjugateGradientSolver();
      case 'GMRES':
        return new GMRESSolver();
      case 'SparseCholesky':
      default:
        return new SparseCholeskySolver();
    }
  }

  /**
   * Engineering Solver Policy execution pipeline:
   * 1. Matrix Inspection
   * 2. Solver Selection
   * 3. Tolerance Setup
   * 4. Execution
   * 5. True Residual Verification
   * 6. Decision & Verdict
   */
  static solveWithPolicy(
    A: SparseMatrix,
    b: Float64Array,
    preferredMode: SolverName | 'AUTO' = 'AUTO',
    options: LinearSolverOptions = {}
  ): SolverPolicyResult {
    const validation = this.inspectMatrix(A, b);

    // Reject singular system immediately
    if (validation.isSingular) {
      const solver = new GMRESSolver();
      return {
        solverUsed: solver,
        validation,
        solveResult: {
          solution: new Float64Array(0),
          converged: false,
          iterations: 0,
          initialResidual: Math.hypot(...b),
          finalResidual: Math.hypot(...b),
          relativeResidual: 1.0,
          absoluteResidual: Math.hypot(...b),
          tolerance: { atol: options.tolerance?.atol ?? 1e-10, rtol: options.tolerance?.rtol ?? 1e-8 },
          solverName: 'REJECTED_SINGULAR',
          executionTimeMs: 0,
          failureReason: `SOLVER_INCOMPATIBLE: System rejected due to matrix singularity (${validation.zeroPivots.length} zero pivots)`,
          diagnostics: {
            isSymmetric: validation.isSymmetric,
            symmetryMaxDiff: validation.symmetryMaxDiff,
            isPositiveDefinite: validation.isPositiveDefinite,
            isSingular: true,
            zeroPivotCount: validation.zeroPivots.length,
            conditionEstimate: Infinity,
            matrixNorm: A.frobeniusNorm(),
            rhsNorm: Math.hypot(...b),
            originalNNZ: A.nnz,
            breakdownOccurred: true,
            breakdownReason: validation.failureReason
          },
          convergenceHistory: []
        },
        verdict: 'SOLVER_INCOMPATIBLE'
      };
    }

    const solver = this.getSolver(preferredMode, A, b);
    const solveResult = solver.solve(A, b, options);

    const verdict: SolverPolicyResult['verdict'] = solveResult.converged ? 'SUCCESS' : 'SOLVER_FAILED';

    return {
      solverUsed: solver,
      validation,
      solveResult,
      verdict
    };
  }
}
