/**
 * SECP Industrial OS — Engineering Truth Platform
 * PATCH-244 — Pressure-Velocity Coupling Types
 */

import { CfdCellEquation } from '../../fvm/FvmTypes';
import { CfdScalarField, CfdVectorField } from '../../mesh/CfdField';

export interface CouplingIterationResult {
  iteration: number;
  continuityResidual: number;
  momentumResidual: number;
  maxMassImbalance: number;
  isConverged: boolean;
}

export interface PressureCorrectionResult {
  correctionField: Map<string, number>;
  residual: number;
}

/**
 * PressureVelocityCouplingStrategy: Interface for algorithms like SIMPLE, PISO.
 */
export interface PressureVelocityCouplingStrategy {
  solve(
    velocity: CfdVectorField,
    pressure: CfdScalarField,
    momentumEquations: {
      u: Map<string, CfdCellEquation>;
      v: Map<string, CfdCellEquation>;
      w: Map<string, CfdCellEquation>;
    }
  ): CouplingIterationResult;
}
