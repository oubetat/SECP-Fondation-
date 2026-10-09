import { PhysicsResidual } from './types';

export interface ResidualComparisonRequest {
  predictionId: string;
  predictedValue: number;
  referenceType: 'ANALYTICAL' | 'NUMERICAL_SOLVER' | 'EXPERIMENTAL';
  referenceValue: number;
  tolerance: number;
  measurementUncertainty?: number;
}

export class PhysicsResidualEngine {
  public static calculateResidual(req: ResidualComparisonRequest): PhysicsResidual {
    const absError = Math.abs(req.predictedValue - req.referenceValue);
    const refMag = Math.max(Math.abs(req.referenceValue), 1e-9);
    const relError = absError / refMag;

    const scale = req.measurementUncertainty && req.measurementUncertainty > 0
      ? req.measurementUncertainty
      : req.tolerance * refMag;

    const normalizedResidual = absError / scale;

    const isPass = relError <= req.tolerance;

    return {
      residualId: `RES-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      predictionId: req.predictionId,
      referenceType: req.referenceType,
      referenceValue: req.referenceValue,
      predictedValue: req.predictedValue,
      absoluteError: absError,
      relativeError: relError,
      normalizedResidual,
      verdict: isPass ? 'MATCH_PASS' : 'RESIDUAL_EXCEEDED'
    };
  }

  /**
   * Evaluate analytical solution for Hagen-Poiseuille pipe flow rate
   * Q = (pi * deltaP * R^4) / (8 * mu * L)
   */
  public static evaluatePoiseuilleFlow(
    deltaP: number, // Pressure drop [Pa]
    radius: number, // Pipe radius [m]
    viscosity: number, // Dynamic viscosity [Pa*s]
    length: number // Pipe length [m]
  ): number {
    return (Math.PI * deltaP * Math.pow(radius, 4)) / (8 * viscosity * length);
  }

  /**
   * Evaluate 1D Heat Conduction rate
   * Q_dot = k * A * (T_hot - T_cold) / L
   */
  public static evaluate1DHeatConduction(
    k: number, // Conductivity [W/(m*K)]
    area: number, // Cross sectional area [m^2]
    tHot: number, // Temperature Hot [K]
    tCold: number, // Temperature Cold [K]
    thickness: number // Length [m]
  ): number {
    return (k * area * (tHot - tCold)) / thickness;
  }
}
