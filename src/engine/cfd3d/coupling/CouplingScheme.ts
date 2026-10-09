/**
 * SECP Industrial OS v2 — Pressure-Velocity Coupling Scheme Contract
 * PATCH-054: Pressure-Velocity Coupling
 */

import { CFDMesh3D } from '../mesh/CFDMeshTypes';
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

export interface PressureVelocityCouplingScheme {
  readonly id: string;
  readonly version: string;

  initialize(
    mesh: CFDMesh3D,
    density: number,
    viscosity: number,
    initialPressure: Float64Array,
    initialVelocity: { u: Float64Array; v: Float64Array; w: Float64Array }
  ): CouplingState;

  predictMomentum(
    mesh: CFDMesh3D,
    density: number,
    viscosity: number,
    state: CouplingState,
    relaxation: UnderRelaxationConfig
  ): MomentumPrediction;

  assemblePressureCorrection(
    mesh: CFDMesh3D,
    density: number,
    predictedFlux: Float64Array,
    momentumPred: MomentumPrediction,
    refPolicy: PressureReferencePolicy
  ): PressureCorrectionSystem;

  correctPressure(
    currentPressure: Float64Array,
    pPrime: Float64Array,
    relaxation: UnderRelaxationConfig
  ): PressureField;

  correctVelocity(
    mesh: CFDMesh3D,
    momentumPred: MomentumPrediction,
    pPrimeGrad: Float64Array,
    relaxation: UnderRelaxationConfig
  ): VelocityField;

  correctFaceFlux(
    mesh: CFDMesh3D,
    density: number,
    predictedFlux: Float64Array,
    pPrime: Float64Array,
    momentumPred: MomentumPrediction
  ): FaceFluxField;

  checkContinuity(
    mesh: CFDMesh3D,
    faceFluxes: Float64Array
  ): ContinuityResult;

  checkGlobalMassBalance(
    mesh: CFDMesh3D,
    faceFluxes: Float64Array
  ): GlobalMassBalance;
}
