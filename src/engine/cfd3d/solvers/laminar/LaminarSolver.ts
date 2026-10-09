/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-061: Laminar CFD Solver
 */

import { CFDMesh3D } from '../../mesh/CFDMeshTypes';
import { 
  LaminarSolverVerdict, 
  LaminarFormulation, 
  IterationResiduals,
  IterationConservationMetrics,
  ConservationVerdict,
  EnergySolveStatus
} from './LaminarSolverTypes';
import { LaminarSolverInput, LaminarSolverInputValidator } from './LaminarSolverInput';
import { LaminarSolverResult } from './LaminarSolverResult';
import { LaminarEquationSystem } from './LaminarEquationSystem';
import { LaminarIteration } from './LaminarIteration';
import { LaminarSolverState } from './LaminarSolverState';
import { LaminarSolverFailureCode } from './LaminarFailure';

export class LaminarSolver {
  public static readonly VERSION = '1.0.0';

  public async solve(input: LaminarSolverInput): Promise<LaminarSolverResult> {
    const startTime = new Date().toISOString();
    
    // 1. Validation
    const validationErrors = LaminarSolverInputValidator.validate(input);
    if (validationErrors.length > 0) {
      return this.createFailureResult(input, LaminarSolverFailureCode.INVALID_INPUT, validationErrors, startTime);
    }

    const { mesh, config } = input;
    const cellCount = mesh.cells.length;
    const system = new LaminarEquationSystem(cellCount, config.energyEnabled);
    
    let currentState = new LaminarSolverState(
      0,
      input.initialState,
      this.initialResiduals(),
      this.initialConservation(),
      { momentumXIterations: 0, momentumYIterations: 0, momentumZIterations: 0, pressureIterations: 0 },
      LaminarSolverVerdict.UNPROVEN
    );

    const diagnostics: string[] = [];
    const failureCodes: LaminarSolverFailureCode[] = [];

    // 2. Iteration Loop
    try {
      for (let i = 0; i < config.maxIterations; i++) {
        currentState = LaminarIteration.performIteration(input, currentState, system);
        
        // Convergence Check
        if (this.isConverged(currentState.residuals, config)) {
          diagnostics.push(`Solver converged at iteration ${currentState.iterationIndex}`);
          break;
        }

        // Divergence Check
        if (this.isDiverged(currentState.residuals)) {
          failureCodes.push(LaminarSolverFailureCode.RESIDUAL_DIVERGENCE);
          break;
        }
      }
    } catch (error) {
      failureCodes.push(LaminarSolverFailureCode.INTERNAL_ERROR);
      diagnostics.push(`Internal Error: ${error instanceof Error ? error.message : String(error)}`);
    }

    const endTime = new Date().toISOString();

    // 3. Final Verdict
    let finalVerdict = LaminarSolverVerdict.NOT_CONVERGED;
    if (failureCodes.length > 0) {
      finalVerdict = LaminarSolverVerdict.INVALID;
    } else if (this.isConverged(currentState.residuals, config)) {
      finalVerdict = LaminarSolverVerdict.CONVERGED;
    } else if (currentState.iterationIndex >= config.maxIterations) {
      failureCodes.push(LaminarSolverFailureCode.MAX_ITERATIONS_REACHED);
    }

    return new LaminarSolverResult({
      runId: `run-${Date.now()}`,
      solverVersion: LaminarSolver.VERSION,
      formulation: config.formulation,
      meshHash: input.meshHash,
      materialHash: input.materialHash,
      boundaryConditionHash: input.boundaryConditionHash,
      initialStateHash: input.initialStateHash,
      configurationHash: config.configHash,
      finalStateHash: currentState.fieldState.hash,
      iterationCount: currentState.iterationIndex,
      convergenceState: finalVerdict,
      residualMetrics: currentState.residuals,
      massConservation: currentState.conservation,
      momentumConservation: {
        x: currentState.conservation.momentumXImbalance,
        y: currentState.conservation.momentumYImbalance,
        z: currentState.conservation.momentumZImbalance
      },
      failureCodes,
      diagnostics,
      provenance: { startTime, endTime },
      evidenceHash: `evidence-${currentState.hash}`
    });
  }

  private isConverged(residuals: IterationResiduals, config: any): boolean {
    return residuals.maxResidual < config.absoluteContinuityTolerance;
  }

  private isDiverged(residuals: IterationResiduals): boolean {
    return residuals.maxResidual > 1e10 || isNaN(residuals.maxResidual);
  }

  private initialResiduals(): IterationResiduals {
    return {
      continuityResidual: 1.0,
      momentumXResidual: 1.0,
      momentumYResidual: 1.0,
      momentumZResidual: 1.0,
      maxResidual: 1.0
    };
  }

  private initialConservation(): IterationConservationMetrics {
    return {
      massImbalance: 1.0,
      momentumXImbalance: 1.0,
      momentumYImbalance: 1.0,
      momentumZImbalance: 1.0,
      massVerdict: ConservationVerdict.UNPROVEN,
      momentumVerdict: ConservationVerdict.UNPROVEN,
      energyStatus: EnergySolveStatus.UNPROVEN
    };
  }

  private createFailureResult(
    input: LaminarSolverInput, 
    code: LaminarSolverFailureCode, 
    diagnostics: string[],
    startTime: string
  ): LaminarSolverResult {
    return new LaminarSolverResult({
      runId: `fail-${Date.now()}`,
      solverVersion: LaminarSolver.VERSION,
      formulation: input.config.formulation,
      meshHash: input.meshHash,
      materialHash: input.materialHash,
      boundaryConditionHash: input.boundaryConditionHash,
      initialStateHash: input.initialStateHash,
      configurationHash: input.config.configHash,
      finalStateHash: 'INVALID',
      iterationCount: 0,
      convergenceState: LaminarSolverVerdict.INVALID,
      residualMetrics: this.initialResiduals(),
      massConservation: this.initialConservation(),
      momentumConservation: { x: 0, y: 0, z: 0 },
      failureCodes: [code],
      diagnostics,
      provenance: { startTime, endTime: new Date().toISOString() },
      evidenceHash: 'INVALID'
    });
  }
}
