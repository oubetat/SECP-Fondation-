/**
 * SECP Industrial OS v2 — SIMPLE Coupling Scheme
 * PATCH-054: Pressure-Velocity Coupling
 */

import { CFDMesh3D, BoundaryType } from '../mesh/CFDMeshTypes';
import { 
  CouplingState, 
  MomentumPrediction, 
  PressureCorrectionSystem, 
  PressureField, 
  VelocityField, 
  FaceFluxField, 
  ContinuityResult, 
  GlobalMassBalance,
  UnderRelaxationConfig,
  PressureReferencePolicy
} from './PressureVelocityTypes';
import { PressureVelocityCouplingScheme } from './CouplingScheme';
import { MomentumEquationEngine } from './MomentumEquation';
import { PressureEquationEngine } from './PressureEquation';
import { FaceFluxEngine } from './FaceFluxCorrection';
import { PressureCorrectionEngine } from './PressureCorrection';
import { CouplingDiagnosticsHelper } from './CouplingDiagnostics';

export class SimpleCouplingScheme implements PressureVelocityCouplingScheme {
  public readonly id = 'SIMPLE_COUPLING_INCOMPRESSIBLE_3D';
  public readonly version = '1.0.0';

  public initialize(
    mesh: CFDMesh3D,
    density: number,
    viscosity: number,
    initialPressure: Float64Array,
    initialVelocity: { u: Float64Array; v: Float64Array; w: Float64Array }
  ): CouplingState {
    const numCells = mesh.cells.length;
    const numFaces = mesh.faces.length;

    const pressure: PressureField = {
      pressure: new Float64Array(initialPressure),
      correction: new Float64Array(numCells),
      underRelaxation: 0.3
    };

    const velocity: VelocityField = {
      u: new Float64Array(initialVelocity.u),
      v: new Float64Array(initialVelocity.v),
      w: new Float64Array(initialVelocity.w),
      uCorrection: new Float64Array(numCells),
      vCorrection: new Float64Array(numCells),
      wCorrection: new Float64Array(numCells)
    };

    // Initial face mass flux estimate
    const faceFluxes = new Float64Array(numFaces);
    for (let fIdx = 0; fIdx < numFaces; fIdx++) {
      const face = mesh.faces[fIdx];
      const owner = face.ownerCellId;
      const uO = velocity.u[owner];
      const vO = velocity.v[owner];
      const wO = velocity.w[owner];
      const vN = uO * face.normal[0] + vO * face.normal[1] + wO * face.normal[2];
      faceFluxes[fIdx] = density * vN * face.area;
    }

    const faceFlux: FaceFluxField = {
      predictedFlux: faceFluxes,
      correctedFlux: faceFluxes,
      fluxCorrection: new Float64Array(numFaces)
    };

    const continuity = this.checkContinuity(mesh, faceFluxes);
    const massBalance = this.checkGlobalMassBalance(mesh, faceFluxes);

    return {
      pressure,
      velocity,
      faceFlux,
      continuity,
      massBalance,
      iteration: 0,
      history: []
    };
  }

  public predictMomentum(
    mesh: CFDMesh3D,
    density: number,
    viscosity: number,
    state: CouplingState,
    relaxation: UnderRelaxationConfig
  ): MomentumPrediction {
    const numCells = mesh.cells.length;

    // Assemble momentum coefficients
    const coeffs = MomentumEquationEngine.assembleCoefficients(
      mesh, density, viscosity, state.velocity, state.faceFlux.correctedFlux, relaxation
    );

    // Calculate pressure gradient (Gauss-Green)
    const pGrad = this.computePressureGradient(mesh, state.pressure.pressure);

    // Predict star velocity field
    return MomentumEquationEngine.predictVelocity(mesh, coeffs, pGrad, state.velocity);
  }

  public assemblePressureCorrection(
    mesh: CFDMesh3D,
    density: number,
    predictedFlux: Float64Array,
    momentumPred: MomentumPrediction,
    refPolicy: PressureReferencePolicy
  ): PressureCorrectionSystem {
    return PressureEquationEngine.assembleSystem(
      mesh, density, predictedFlux, momentumPred.coefficients, refPolicy
    );
  }

  public correctPressure(
    currentPressure: Float64Array,
    pPrime: Float64Array,
    relaxation: UnderRelaxationConfig
  ): PressureField {
    return PressureCorrectionEngine.correctPressure(currentPressure, pPrime, relaxation);
  }

  public correctVelocity(
    mesh: CFDMesh3D,
    momentumPred: MomentumPrediction,
    pPrimeGrad: Float64Array,
    relaxation: UnderRelaxationConfig
  ): VelocityField {
    return PressureCorrectionEngine.correctVelocity(
      mesh, momentumPred.uStar, momentumPred.vStar, momentumPred.wStar,
      pPrimeGrad, momentumPred.coefficients, relaxation
    );
  }

  public correctFaceFlux(
    mesh: CFDMesh3D,
    density: number,
    predictedFlux: Float64Array,
    pPrime: Float64Array,
    momentumPred: MomentumPrediction
  ): FaceFluxField {
    return FaceFluxEngine.computeCorrectedFaceFlux(
      mesh, density, predictedFlux, pPrime, momentumPred.coefficients
    );
  }

  public checkContinuity(
    mesh: CFDMesh3D,
    faceFluxes: Float64Array
  ): ContinuityResult {
    const numCells = mesh.cells.length;
    const cellImbalances = new Float64Array(numCells);

    let totalAbsResidual = 0;
    let maxImbalance = 0;
    let totalDomainImbalance = 0;

    for (let fIdx = 0; fIdx < mesh.faces.length; fIdx++) {
      const face = mesh.faces[fIdx];
      const mF = faceFluxes[fIdx];

      if (face.ownerCellId >= 0 && face.ownerCellId < numCells) {
        cellImbalances[face.ownerCellId] += mF; // Outward mass flux
      }

      if (!face.isBoundary && face.neighborCellId !== null && face.neighborCellId >= 0 && face.neighborCellId < numCells) {
        cellImbalances[face.neighborCellId] -= mF; // Inward mass flux
      }
    }

    for (let c = 0; c < numCells; c++) {
      const absImb = Math.abs(cellImbalances[c]);
      totalAbsResidual += absImb;
      totalDomainImbalance += cellImbalances[c];
      if (absImb > maxImbalance) maxImbalance = absImb;
    }

    const normFactor = Math.max(1e-10, numCells);
    const normalizedResidual = totalAbsResidual / normFactor;

    return {
      absoluteResidual: totalAbsResidual,
      normalizedResidual,
      maxCellImbalance: maxImbalance,
      totalDomainImbalance: Math.abs(totalDomainImbalance),
      cellImbalances,
      converged: maxImbalance < 1e-6
    };
  }

  public checkGlobalMassBalance(
    mesh: CFDMesh3D,
    faceFluxes: Float64Array
  ): GlobalMassBalance {
    let inletMassFlow = 0;
    let outletMassFlow = 0;

    for (let fIdx = 0; fIdx < mesh.faces.length; fIdx++) {
      const face = mesh.faces[fIdx];
      if (!face.isBoundary) continue;

      const mF = faceFluxes[fIdx];
      if (mF < 0) {
        // Inflow into domain
        inletMassFlow += Math.abs(mF);
      } else {
        // Outflow from domain
        outletMassFlow += mF;
      }
    }

    const netImbalance = Math.abs(inletMassFlow - outletMassFlow);
    const refFlow = Math.max(1e-10, Math.max(inletMassFlow, outletMassFlow));
    const relativeImbalance = netImbalance / refFlow;

    return {
      inletMassFlow,
      outletMassFlow,
      netMassImbalance: netImbalance,
      relativeImbalance,
      balanced: relativeImbalance < 1e-5
    };
  }

  /**
   * Helper: Gauss-Green Cell-Centered Pressure Gradient computation
   */
  public computePressureGradient(mesh: CFDMesh3D, pressure: Float64Array): Float64Array {
    const numCells = mesh.cells.length;
    const gradP = new Float64Array(numCells * 3);

    for (let fIdx = 0; fIdx < mesh.faces.length; fIdx++) {
      const face = mesh.faces[fIdx];
      const owner = face.ownerCellId;

      let pFace = pressure[owner];
      if (!face.isBoundary && face.neighborCellId !== null) {
        pFace = 0.5 * (pressure[owner] + pressure[face.neighborCellId]);
      }

      const fX = pFace * face.normal[0] * face.area;
      const fY = pFace * face.normal[1] * face.area;
      const fZ = pFace * face.normal[2] * face.area;

      gradP[3 * owner + 0] += fX;
      gradP[3 * owner + 1] += fY;
      gradP[3 * owner + 2] += fZ;

      if (!face.isBoundary && face.neighborCellId !== null) {
        gradP[3 * face.neighborCellId + 0] -= fX;
        gradP[3 * face.neighborCellId + 1] -= fY;
        gradP[3 * face.neighborCellId + 2] -= fZ;
      }
    }

    for (let c = 0; c < numCells; c++) {
      const invVol = 1.0 / mesh.cells[c].volume;
      gradP[3 * c + 0] *= invVol;
      gradP[3 * c + 1] *= invVol;
      gradP[3 * c + 2] *= invVol;
    }

    return gradP;
  }
}
