/**
 * PATCH-SECP-076: Cross-Kernel Solver Verifier & Residual Re-computation Gate
 * Executes production and independent clean-room verification paths in parallel.
 * Validates cross-kernel agreement, independent residuals, energy equivalence,
 * convergence integrity, and numerical stability classification.
 */

import { LinearSolverAbstraction } from '../structural-physics/LinearSolverAbstraction';
import { SparseMatrix } from '../structural-physics/SparseMatrixEngine';
import { SECP076SolverIntegrityKernel, ResidualResult, SolutionDiscrepancyResult } from './SECP076SolverIntegrityKernel';

export type NumericalStabilityClass = 'STABLE' | 'SENSITIVE' | 'ILL_CONDITIONED' | 'UNSTABLE' | 'INVALID';

export interface CrossKernelSolveResult {
  passed: boolean;
  stabilityClass: NumericalStabilityClass;
  crossSolverCoverage: 'FULL' | 'LIMITED';
  production: {
    x: number[];
    strainEnergy: number;
    independentResidual: ResidualResult;
    solverReportedConverged?: boolean;
    solverReportedResidual?: number;
  };
  reference: {
    x: number[];
    strainEnergy: number;
    independentResidual: ResidualResult;
    method: 'DIRECT_CHOLESKY' | 'DIRECT_GAUSSIAN' | 'INDEPENDENT_PCG';
  };
  discrepancy: SolutionDiscrepancyResult;
  tolerances: {
    residualTol: number;
    discrepancyTol: number;
    energyTol: number;
  };
  checks: {
    residualPass: boolean;
    solutionDiscrepancyPass: boolean;
    energyDiscrepancyPass: boolean;
    convergenceIntegrityPass: boolean;
    noNanInfPass: boolean;
    positiveDefinitePass: boolean;
  };
  spectral: {
    lambdaMin: number;
    lambdaMax: number;
    conditionNumber: number;
  };
  details: string;
}

export class SECP076CrossKernelVerifier {
  public static readonly DEFAULT_RESIDUAL_TOL = 1e-8;
  public static readonly DEFAULT_DISCREPANCY_TOL = 1e-8;
  public static readonly DEFAULT_ENERGY_TOL = 1e-8;

  /**
   * Runs the dual-path cross-kernel solver verification on any reduced stiffness system (K_reduced, F_reduced).
   */
  public static verifySystem(
    K_dense: number[][],
    F_vec: number[],
    options: {
      residualTol?: number;
      discrepancyTol?: number;
      energyTol?: number;
      mockProductionCorruptions?: {
        forgedConvergence?: boolean;
        forgedResidualZero?: boolean;
        corruptSolutionIdx?: number;
        corruptSolutionDelta?: number;
        injectNaN?: boolean;
        injectInf?: boolean;
      };
    } = {}
  ): CrossKernelSolveResult {
    const residualTol = options.residualTol ?? this.DEFAULT_RESIDUAL_TOL;
    const discrepancyTol = options.discrepancyTol ?? this.DEFAULT_DISCREPANCY_TOL;
    const energyTol = options.energyTol ?? this.DEFAULT_ENERGY_TOL;

    const n = F_vec.length;

    // Check finite matrix and load vector
    const kFinite = SECP076SolverIntegrityKernel.isFiniteMatrix(K_dense);
    const fFinite = SECP076SolverIntegrityKernel.isFiniteVector(F_vec);

    if (!kFinite || !fFinite) {
      return this.createInvalidResult(n, 'Input matrix K or load vector F contains NaN or Inf');
    }

    // 1. Path A: Production Solver Path
    const K_sparse = new SparseMatrix(n);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const val = K_dense[i][j];
        if (Math.abs(val) > 1e-15) {
          K_sparse.add(i, j, val);
        }
      }
    }

    let prodX: number[];
    let prodConverged = true;
    try {
      prodX = LinearSolverAbstraction.solve(K_sparse, F_vec);
    } catch (e: any) {
      prodX = new Array(n).fill(NaN);
      prodConverged = false;
    }

    // Apply mock mutations if specified (for adversarial testing)
    if (options.mockProductionCorruptions) {
      const mut = options.mockProductionCorruptions;
      if (mut.corruptSolutionIdx !== undefined && mut.corruptSolutionDelta !== undefined) {
        prodX[mut.corruptSolutionIdx] += mut.corruptSolutionDelta;
      }
      if (mut.injectNaN) {
        prodX[0] = NaN;
      }
      if (mut.injectInf) {
        prodX[0] = Infinity;
      }
      if (mut.forgedConvergence !== undefined) {
        prodConverged = mut.forgedConvergence;
      }
    }

    // 2. Path B: Independent Verification Reference Path (Zero-dependency first-principles)
    const choleskySol = SECP076SolverIntegrityKernel.solveDirectCholesky(K_dense, F_vec);
    let refX: number[];
    let refMethod: 'DIRECT_CHOLESKY' | 'DIRECT_GAUSSIAN' | 'INDEPENDENT_PCG' = 'DIRECT_CHOLESKY';

    if (choleskySol.success) {
      refX = choleskySol.x;
      refMethod = 'DIRECT_CHOLESKY';
    } else {
      // Fallback to Gaussian with partial pivoting
      const gaussianSol = SECP076SolverIntegrityKernel.solveDirectGaussian(K_dense, F_vec);
      if (gaussianSol.success) {
        refX = gaussianSol.x;
        refMethod = 'DIRECT_GAUSSIAN';
      } else {
        refX = new Array(n).fill(NaN);
      }
    }

    // Additional cross-solver reference (Iterative PCG reference)
    const pcgRef = SECP076SolverIntegrityKernel.solveIndependentPCG(K_dense, F_vec, 1e-10, 5000);
    const crossSolverCoverage: 'FULL' | 'LIMITED' = choleskySol.success && pcgRef.converged ? 'FULL' : 'LIMITED';

    // 3. Independent Residual Re-computations (NEVER trusting solver-reported residual!)
    const prodRes = SECP076SolverIntegrityKernel.computeResidual(K_dense, prodX, F_vec);
    const refRes = SECP076SolverIntegrityKernel.computeResidual(K_dense, refX, F_vec);

    // 4. Strain Energy Calculations
    const prodEnergy = SECP076SolverIntegrityKernel.computeEnergy(K_dense, prodX);
    const refEnergy = SECP076SolverIntegrityKernel.computeEnergy(K_dense, refX);

    // 5. Solution and Energy Discrepancies
    let discrepancy: SolutionDiscrepancyResult;
    try {
      discrepancy = SECP076SolverIntegrityKernel.computeSolutionDiscrepancy(K_dense, prodX, refX);
    } catch {
      discrepancy = { l2Diff: Infinity, linfDiff: Infinity, relativeDiff: Infinity, energyDiff: Infinity, relativeEnergyDiff: Infinity };
    }

    // 6. Spectral conditioning analysis
    const spectral = SECP076SolverIntegrityKernel.estimateConditioning(K_dense);

    // 7. Individual Check Invariants
    const noNanInfPass = SECP076SolverIntegrityKernel.isFiniteVector(prodX) && SECP076SolverIntegrityKernel.isFiniteVector(refX);
    const residualPass = noNanInfPass && prodRes.relativeResidual <= residualTol && refRes.relativeResidual <= residualTol;
    const solutionDiscrepancyPass = noNanInfPass && discrepancy.relativeDiff <= discrepancyTol;
    const energyDiscrepancyPass = noNanInfPass && discrepancy.relativeEnergyDiff <= energyTol && prodEnergy > 0;
    const positiveDefinitePass = choleskySol.success && choleskySol.minPivot > 0;

    // Convergence integrity: Solver cannot claim converged=true if residual is invalid or solution has NaN/Inf
    const convergenceIntegrityPass =
      noNanInfPass &&
      prodConverged &&
      prodRes.relativeResidual <= residualTol &&
      Number.isFinite(prodEnergy);

    // 8. Numerical Stability Classification
    let stabilityClass: NumericalStabilityClass;
    if (!noNanInfPass || !Number.isFinite(spectral.conditionNumber) || spectral.lambdaMin <= 0) {
      stabilityClass = 'INVALID';
    } else if (!residualPass || discrepancy.relativeDiff > 0.01) {
      stabilityClass = 'UNSTABLE';
    } else if (spectral.conditionNumber > 1e8) {
      stabilityClass = 'ILL_CONDITIONED';
    } else if (spectral.conditionNumber > 1e5 || discrepancy.relativeDiff > 1e-5) {
      stabilityClass = 'SENSITIVE';
    } else {
      stabilityClass = 'STABLE';
    }

    // Master acceptance rule:
    // PASS <=> independent residual + solution discrepancy + energy discrepancy + convergence integrity ALL within tolerances
    // and stabilityClass is STABLE or SENSITIVE (ILL_CONDITIONED requires explicit warning and cannot pass unflagged)
    const passed =
      noNanInfPass &&
      residualPass &&
      solutionDiscrepancyPass &&
      energyDiscrepancyPass &&
      convergenceIntegrityPass &&
      (stabilityClass === 'STABLE' || stabilityClass === 'SENSITIVE');

    const details = passed
      ? `Cross-kernel agreement confirmed (${refMethod}): relResidual=${prodRes.relativeResidual.toExponential(3)}, solDiff=${discrepancy.relativeDiff.toExponential(3)}, energyDiff=${discrepancy.relativeEnergyDiff.toExponential(3)}, κ(K)=${spectral.conditionNumber.toFixed(1)} [${stabilityClass}]`
      : `Cross-kernel rejection: residualPass=${residualPass}, solDiscrepancy=${discrepancy.relativeDiff.toExponential(3)} (tol=${discrepancyTol}), energyDiff=${discrepancy.relativeEnergyDiff.toExponential(3)} [${stabilityClass}]`;

    return {
      passed,
      stabilityClass,
      crossSolverCoverage,
      production: {
        x: prodX,
        strainEnergy: prodEnergy,
        independentResidual: prodRes,
        solverReportedConverged: prodConverged,
        solverReportedResidual: options.mockProductionCorruptions?.forgedResidualZero ? 0.0 : prodRes.normL2
      },
      reference: {
        x: refX,
        strainEnergy: refEnergy,
        independentResidual: refRes,
        method: refMethod
      },
      discrepancy,
      tolerances: {
        residualTol,
        discrepancyTol,
        energyTol
      },
      checks: {
        residualPass,
        solutionDiscrepancyPass,
        energyDiscrepancyPass,
        convergenceIntegrityPass,
        noNanInfPass,
        positiveDefinitePass
      },
      spectral,
      details
    };
  }

  private static createInvalidResult(n: number, reason: string): CrossKernelSolveResult {
    const invalidResidual: ResidualResult = {
      r: new Array(n).fill(NaN),
      normL1: NaN,
      normL2: NaN,
      normLinf: NaN,
      relativeResidual: NaN,
      maxComponent: NaN
    };

    return {
      passed: false,
      stabilityClass: 'INVALID',
      crossSolverCoverage: 'LIMITED',
      production: {
        x: new Array(n).fill(NaN),
        strainEnergy: NaN,
        independentResidual: invalidResidual,
        solverReportedConverged: false
      },
      reference: {
        x: new Array(n).fill(NaN),
        strainEnergy: NaN,
        independentResidual: invalidResidual,
        method: 'DIRECT_GAUSSIAN'
      },
      discrepancy: {
        l2Diff: NaN,
        linfDiff: NaN,
        relativeDiff: NaN,
        energyDiff: NaN,
        relativeEnergyDiff: NaN
      },
      tolerances: {
        residualTol: this.DEFAULT_RESIDUAL_TOL,
        discrepancyTol: this.DEFAULT_DISCREPANCY_TOL,
        energyTol: this.DEFAULT_ENERGY_TOL
      },
      checks: {
        residualPass: false,
        solutionDiscrepancyPass: false,
        energyDiscrepancyPass: false,
        convergenceIntegrityPass: false,
        noNanInfPass: false,
        positiveDefinitePass: false
      },
      spectral: {
        lambdaMin: 0,
        lambdaMax: 0,
        conditionNumber: Infinity
      },
      details: `INVALID: ${reason}`
    };
  }
}
