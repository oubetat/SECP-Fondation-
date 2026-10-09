/**
 * SECP Industrial OS v3 — Nonlinear Structural Benchmark Suite (PATCH-238)
 *
 * Benchmarks problem metrics:
 * Nodes, Elements, DOFs, Load Steps, Newton Iterations, Linear Solver Iterations,
 * Residual Norms, Max Displacement, Max Stress, Plastic Point Count, Runtime, Memory.
 */

import { NonlinearAnalysisResult } from '../types/NonlinearStructuralTypes';

export interface BenchmarkMetrics {
  problemName: string;
  nodeCount: number;
  elementCount: number;
  totalDOFs: number;
  convergedSteps: number;
  totalNewtonIterations: number;
  avgNewtonItersPerStep: number;
  totalLinearIters: number;
  avgLinearItersPerNewton: number;
  finalResidualNorm: number;
  maxDisplacement: number;
  maxVonMisesStress: number;
  yieldedPointsCount: number;
  totalRuntimeMs: number;
  memoryEstimateMB: number;
}

export class NonlinearStructuralBenchmark {
  public static benchmark(
    result: NonlinearAnalysisResult,
    nodeCount: number,
    elementCount: number,
    totalDOFs: number
  ): BenchmarkMetrics {
    const convergedSteps = result.loadStepResults.filter(s => s.converged).length;
    const avgNewtonIters = convergedSteps > 0 ? result.totalNewtonIterations / convergedSteps : 0;
    const avgLinearIters = result.totalNewtonIterations > 0 ? result.totalLinearSolverIterations / result.totalNewtonIterations : 0;

    const lastStep = result.loadStepResults[result.loadStepResults.length - 1];
    const lastDiag = lastStep?.diagnostics[lastStep.diagnostics.length - 1];

    const memoryEstimateMB = (totalDOFs * totalDOFs * 8 + totalDOFs * 8 * 10) / (1024 * 1024);

    return {
      problemName: result.problemName,
      nodeCount,
      elementCount,
      totalDOFs,
      convergedSteps,
      totalNewtonIterations: result.totalNewtonIterations,
      avgNewtonItersPerStep: parseFloat(avgNewtonIters.toFixed(2)),
      totalLinearIters: result.totalLinearSolverIterations,
      avgLinearItersPerNewton: parseFloat(avgLinearIters.toFixed(2)),
      finalResidualNorm: lastDiag ? lastDiag.forceResidualNorm : 0.0,
      maxDisplacement: Math.hypot(...result.finalDisplacements),
      maxVonMisesStress: result.finalMaxVonMisesStress,
      yieldedPointsCount: result.finalYieldedPointCount,
      totalRuntimeMs: parseFloat(result.totalRuntimeMs.toFixed(2)),
      memoryEstimateMB: parseFloat(memoryEstimateMB.toFixed(3))
    };
  }
}
