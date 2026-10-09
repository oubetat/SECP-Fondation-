/**
 * SECP Industrial OS v2 — Pressure-Velocity Coupling Iteration Controller
 * PATCH-054: Pressure-Velocity Coupling
 */

import { CFDMesh3D } from '../mesh/CFDMeshTypes';
import { 
  CouplingState, 
  UnderRelaxationConfig, 
  PressureReferencePolicy, 
  CouplingIterationState,
  PressureCorrectionSystem
} from './PressureVelocityTypes';
import { SimpleCouplingScheme } from './SimpleCoupling';
import { FaceFluxEngine } from './FaceFluxCorrection';
import { ConvergenceStatus } from '../../physics/convergence/ConvergenceTypes';
import { EngineeringClock, SystemClock, toISOString } from '../../core/clock';

export interface CouplingIterationResult {
  readonly state: CouplingState;
  readonly status: ConvergenceStatus;
  readonly converged: boolean;
  readonly diagnostics: string[];
}

export class CouplingIterationEngine {

  /**
   * Solves linear pressure-correction system A_p * p' = b using Gauss-Seidel iteration.
   */
  public static solvePressureCorrectionLinearSystem(
    sys: PressureCorrectionSystem,
    maxIter: number = 200,
    tol: number = 1e-6
  ): { pPrime: Float64Array; iterations: number; residual: number; converged: boolean } {
    const numCells = sys.aP.length;
    const pPrime = new Float64Array(numCells);

    let finalRes = Infinity;
    let converged = false;

    for (let iter = 0; iter < maxIter; iter++) {
      let maxChange = 0;

      for (let c = 0; c < numCells; c++) {
        const aP = sys.aP[c];
        if (aP <= 0) continue;

        let sumN = 0;
        const neighbors = sys.aN[c];
        for (const [neighId, aN] of neighbors.entries()) {
          sumN += aN * pPrime[neighId];
        }

        const pNew = (sys.b[c] + sumN) / aP;
        const change = Math.abs(pNew - pPrime[c]);
        if (change > maxChange) maxChange = change;

        pPrime[c] = pNew;
      }

      finalRes = maxChange;
      if (maxChange < tol) {
        converged = true;
        return { pPrime, iterations: iter + 1, residual: finalRes, converged: true };
      }
    }

    return { pPrime, iterations: maxIter, residual: finalRes, converged };
  }

  /**
   * Runs a single iteration of Pressure-Velocity Coupling (e.g. SIMPLE algorithm).
   */
  public static stepIteration(
    mesh: CFDMesh3D,
    density: number,
    viscosity: number,
    currentState: CouplingState,
    scheme: SimpleCouplingScheme,
    relaxation: UnderRelaxationConfig,
    refPolicy: PressureReferencePolicy,
    clock: EngineeringClock = new SystemClock()
  ): CouplingIterationResult {
    const diagnostics: string[] = [];

    // 1. Predict momentum (u*, v*, w*)
    const momPred = scheme.predictMomentum(mesh, density, viscosity, currentState, relaxation);
    if (!momPred.valid) {
      return {
        state: currentState,
        status: 'INVALID',
        converged: false,
        diagnostics: ['Momentum prediction failed', ...momPred.diagnostics]
      };
    }

    // 2. Compute predicted face mass flux m_f*
    const pGrad = scheme.computePressureGradient(mesh, currentState.pressure.pressure);
    const predictedFlux = FaceFluxEngine.computePredictedFaceFlux(
      mesh, density, momPred.uStar, momPred.vStar, momPred.wStar,
      currentState.pressure.pressure, pGrad, momPred.coefficients
    );

    // 3. Assemble pressure correction system A_p * p' = b
    const pSys = scheme.assemblePressureCorrection(mesh, density, predictedFlux, momPred, refPolicy);
    if (!pSys.valid) {
      return {
        state: currentState,
        status: 'INVALID',
        converged: false,
        diagnostics: ['Pressure equation assembly failed', ...pSys.diagnostics]
      };
    }

    // 4. Solve pressure correction linear system
    const pSolve = this.solvePressureCorrectionLinearSystem(pSys);

    // 5. Correct pressure: p = p* + alpha_p * p'
    const newPressure = scheme.correctPressure(currentState.pressure.pressure, pSolve.pPrime, relaxation);

    // 6. Compute p' gradient and correct velocity field
    const pPrimeGrad = scheme.computePressureGradient(mesh, pSolve.pPrime);
    const newVelocity = scheme.correctVelocity(mesh, momPred, pPrimeGrad, relaxation);

    // 7. Correct face mass fluxes: m_f = m_f* + m_f'
    const newFaceFlux = scheme.correctFaceFlux(mesh, density, predictedFlux, pSolve.pPrime, momPred);

    // 8. Evaluate continuity & global mass balance
    const continuity = scheme.checkContinuity(mesh, newFaceFlux.correctedFlux);
    const massBalance = scheme.checkGlobalMassBalance(mesh, newFaceFlux.correctedFlux);

    // Max corrections
    let maxUCorr = 0; let maxPCorr = 0;
    for (let c = 0; c < mesh.cells.length; c++) {
      const uC = Math.abs(newVelocity.uCorrection[c]);
      if (uC > maxUCorr) maxUCorr = uC;
      const pC = Math.abs(pSolve.pPrime[c]);
      if (pC > maxPCorr) maxPCorr = pC;
    }

    const nextIter = currentState.iteration + 1;
    const iterRecord: CouplingIterationState = {
      iteration: nextIter,
      pressureResidual: pSolve.residual,
      momentumResidual: momPred.residual,
      continuityResidual: continuity.absoluteResidual,
      globalMassImbalance: massBalance.netMassImbalance,
      maxVelocityCorrection: maxUCorr,
      maxPressureCorrection: maxPCorr,
      underRelaxation: relaxation,
      solverStatuses: {
        momentum: 'SOLVED',
        pressureCorrection: pSolve.converged ? 'CONVERGED' : 'NOT_CONVERGED'
      },
      timestamp: toISOString(clock)
    };

    const newHistory = [...currentState.history, iterRecord];

    const updatedState: CouplingState = {
      pressure: newPressure,
      velocity: newVelocity,
      faceFlux: newFaceFlux,
      continuity,
      massBalance,
      iteration: nextIter,
      history: newHistory
    };

    // Check convergence criteria
    const converged = continuity.converged && massBalance.balanced && momPred.residual < 1e-4;
    const status: ConvergenceStatus = converged ? 'CONVERGED' : 'NOT_CONVERGED';

    return {
      state: updatedState,
      status,
      converged,
      diagnostics
    };
  }
}
