/**
 * SECP Industrial OS v3 — Master Nonlinear Structural Solver Engine (PATCH-238)
 *
 * Master Orchestrator for Nonlinear FEM Analysis:
 * Mesh -> Elements -> Material -> State Variables -> Internal Forces -> Tangent Stiffness
 *      -> Residual -> Incremental-Iterative Loop -> Sparse Linear Solve -> Convergence -> Updated State
 */

import { ElementGeometryData } from '../assembly/InternalForceAssembler';
import { MaterialPointStateTracker } from '../materials/MaterialPointStateTracker';
import {
  LoadStepResult,
  LoadStepSettings,
  NonlinearAnalysisResult,
  NonlinearConvergenceTolerances,
  NonlinearKinematicsMode,
  NonlinearSolverType,
  ReturnMappingOptions
} from '../types/NonlinearStructuralTypes';
import { FixedBoundaryCondition, NewtonRaphsonSolver } from './NewtonRaphsonSolver';
import { ModifiedNewtonSolver } from './ModifiedNewtonSolver';
import { LoadStepController } from './LoadStepController';

export interface StructuralProblemDefinition {
  name: string;
  solverType: NonlinearSolverType;
  kinematicsMode: NonlinearKinematicsMode;
  materialOptions: ReturnMappingOptions;
  elements: ElementGeometryData[];
  nodeCount: number;
  dofsPerNode?: number;
  fixedBCs: FixedBoundaryCondition[];
  appliedLoads: { dofIndex: number; totalMagnitude: number }[];
  stepSettings?: Partial<LoadStepSettings>;
  tolerances?: Partial<NonlinearConvergenceTolerances>;
  enableLineSearch?: boolean;
  preferredLinearSolver?: 'CHOLESKY' | 'PCG' | 'CG' | 'GMRES';
}

export class NonlinearStructuralSolver {
  /**
   * Executes a complete Incremental-Iterative multi-step nonlinear structural analysis
   */
  public static solve(problem: StructuralProblemDefinition): NonlinearAnalysisResult {
    const startTime = performance.now();

    const dofsPerNode = problem.dofsPerNode || 2;
    const totalDOFs = problem.nodeCount * dofsPerNode;

    // Full external force vector at \lambda = 1.0
    const fullAppliedLoads = new Array(totalDOFs).fill(0.0);
    problem.appliedLoads.forEach(l => {
      fullAppliedLoads[l.dofIndex] = l.totalMagnitude;
    });

    const stepSettings: LoadStepSettings = {
      numLoadSteps: problem.stepSettings?.numLoadSteps || 10,
      initialIncrement: problem.stepSettings?.initialIncrement || 0.1,
      minIncrement: problem.stepSettings?.minIncrement || 1e-4,
      maxIncrement: problem.stepSettings?.maxIncrement || 0.25,
      maxStepRetries: problem.stepSettings?.maxStepRetries || 5,
      adaptiveSteppingEnabled: problem.stepSettings?.adaptiveSteppingEnabled ?? true,
      targetNewtonIterations: problem.stepSettings?.targetNewtonIterations || 4
    };

    const tolerances: NonlinearConvergenceTolerances = {
      forceTolerance: problem.tolerances?.forceTolerance || 1e-4,
      displacementTolerance: problem.tolerances?.displacementTolerance || 1e-4,
      energyTolerance: problem.tolerances?.energyTolerance || 1e-6,
      maxIterationsPerStep: problem.tolerances?.maxIterationsPerStep || 25
    };

    // Initialize Material Point State Tracker across all integration points
    const stateTracker = new MaterialPointStateTracker();
    const elemConfigs = problem.elements.map(e => ({
      id: e.elementId,
      gaussPointCount: e.gaussPoints.length
    }));
    stateTracker.initializeDomain(elemConfigs, problem.materialOptions);

    const stepController = new LoadStepController(stepSettings);
    let currentDisplacements = new Array(totalDOFs).fill(0.0);

    const loadStepResults: LoadStepResult[] = [];
    const loadDisplacementCurve: { loadFactor: number; displacement: number; reaction: number; maxPlasticStrain: number }[] = [];

    let totalNewtonIters = 0;
    let totalLinearIters = 0;
    let overallSuccess = true;
    let failureReason = '';

    // Record initial state at \lambda = 0.0
    loadDisplacementCurve.push({
      loadFactor: 0.0,
      displacement: 0.0,
      reaction: 0.0,
      maxPlasticStrain: 0.0
    });

    // Main Incremental Load Step Loop
    while (true) {
      const target = stepController.getNextStepTarget();
      if (target.isCompleted) break;

      let stepRes: LoadStepResult;

      if (problem.solverType === 'MODIFIED_NEWTON') {
        stepRes = ModifiedNewtonSolver.solveStep(
          target.stepIndex,
          target.targetLambda,
          target.deltaLambda,
          problem.elements,
          currentDisplacements,
          fullAppliedLoads,
          problem.fixedBCs,
          stateTracker,
          problem.materialOptions,
          tolerances,
          totalDOFs,
          dofsPerNode
        );
      } else {
        stepRes = NewtonRaphsonSolver.solveStep(
          target.stepIndex,
          target.targetLambda,
          target.deltaLambda,
          problem.elements,
          currentDisplacements,
          fullAppliedLoads,
          problem.fixedBCs,
          stateTracker,
          problem.materialOptions,
          tolerances,
          totalDOFs,
          dofsPerNode,
          problem.enableLineSearch ?? true,
          problem.preferredLinearSolver || 'CHOLESKY'
        );
      }

      totalNewtonIters += stepRes.iterationsCount;
      stepRes.diagnostics.forEach(d => {
        totalLinearIters += d.linearSolverIterations;
      });

      if (stepRes.converged) {
        currentDisplacements = [...stepRes.displacements];
        loadStepResults.push(stepRes);
        stepController.recordStepSuccess(stepRes.iterationsCount);

        const maxDisp = Math.hypot(...currentDisplacements);
        const maxRxn = Math.hypot(...stepRes.reactionForces);

        loadDisplacementCurve.push({
          loadFactor: stepRes.loadFactor,
          displacement: maxDisp,
          reaction: maxRxn,
          maxPlasticStrain: stepRes.maxEquivalentPlasticStrain
        });
      } else {
        const cutback = stepController.recordStepFailure();
        stepRes.retryCount = target.retryCount + 1;

        if (!cutback.canRetry) {
          overallSuccess = false;
          failureReason = cutback.reason;
          loadStepResults.push(stepRes);
          break;
        }
      }
    }

    const endTime = performance.now();
    const runtimeMs = endTime - startTime;

    const lastStep = loadStepResults[loadStepResults.length - 1];
    const finalDomainState = stateTracker.getDomainSummary();

    const finalReactionForces = lastStep ? lastStep.reactionForces : new Array(totalDOFs).fill(0.0);

    // Cryptographic signature payload
    const signatureStr = `${problem.name}:${problem.solverType}:${problem.kinematicsMode}:${totalNewtonIters}:${lastStep?.maxVonMisesStress.toFixed(4)}:${overallSuccess}`;
    const cryptographicSignature = `SECP-NLSTRUCT-SIG-${Math.abs(this.simpleHash(signatureStr)).toString(16).toUpperCase()}`;

    return {
      problemName: problem.name,
      success: overallSuccess,
      statusMessage: overallSuccess
        ? 'CONVERGED: Analysis completed successfully across all load steps.'
        : failureReason || 'NONLINEAR_SOLVER_FAILED: Load step divergence.',
      solverType: problem.solverType,
      kinematicsMode: problem.kinematicsMode,
      totalLoadSteps: loadStepResults.filter(s => s.converged).length,
      finalLoadFactor: lastStep ? lastStep.loadFactor : 0.0,
      totalNewtonIterations: totalNewtonIters,
      totalLinearSolverIterations: totalLinearIters,
      finalDisplacements: currentDisplacements,
      finalReactionForces,
      finalMaxVonMisesStress: lastStep ? lastStep.maxVonMisesStress : 0.0,
      finalMaxEquivalentPlasticStrain: finalDomainState.maxEquivalentPlasticStrain,
      finalYieldedPointCount: finalDomainState.yieldedPointCount,
      loadStepResults,
      loadDisplacementCurve,
      totalRuntimeMs: runtimeMs,
      cryptographicSignature
    };
  }

  private static simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return hash;
  }
}
