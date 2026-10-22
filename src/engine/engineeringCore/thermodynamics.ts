/**
 * SECP Engineering Calculation Core — Thermodynamics & Spatial Thermal Engine
 * 1D Fourier & Newton Relations, Continuum Laws, and Multilayer Spatial PCB Solvers.
 */

import {
  PcbThermalBoardConfig,
  PcbStackupLayer,
  computePcbThermalCanonicalHash
} from './PcbThermalModel';
import {
  SpatialThermalSolver,
  SpatialThermalFieldResult,
  PcbEffectiveConductivityResult
} from './SpatialThermalSolver';

export * from './PcbThermalModel';
export * from './SpatialThermalSolver';

export class ThermodynamicsEngine {
  /** Fourier Conduction Heat Flow Q = k * A * (T1 - T2) / L (Watts) */
  public static calculateConductionHeatWatts(
    thermalConductivityWMK: number,
    areaM2: number,
    deltaTCelsius: number,
    thicknessM: number
  ): number {
    if (thicknessM <= 0) return 0;
    return (thermalConductivityWMK * areaM2 * deltaTCelsius) / thicknessM;
  }

  /** Newton Convective Heat Flow Q = h * A * (T_surface - T_fluid) (Watts) */
  public static calculateConvectionHeatWatts(
    convectiveCoeffWM2K: number,
    areaM2: number,
    deltaTCelsius: number
  ): number {
    return convectiveCoeffWM2K * areaM2 * deltaTCelsius;
  }

  /** Thermal Expansion Stress sigma_th = E * alpha * deltaT (MPa) */
  public static calculateThermalStressMPa(
    youngModulusGPa: number,
    expansionCoeff1K: number,
    deltaTCelsius: number
  ): number {
    return (youngModulusGPa * 1e9 * expansionCoeff1K * deltaTCelsius) / 1e6;
  }

  /** Heat Energy Q = m * c_p * deltaT (Joules) */
  public static calculateHeatEnergyJoules(
    massKg: number,
    specificHeatJKgK: number,
    deltaTCelsius: number
  ): number {
    return massKg * specificHeatJKgK * deltaTCelsius;
  }

  /**
   * Solves 2D/multilayer PCB heat spreading and conjugate boundary heat transfer.
   */
  public static solvePcbThermalField(config: PcbThermalBoardConfig): SpatialThermalFieldResult {
    const result = SpatialThermalSolver.solve(config);
    result.canonicalHash = computePcbThermalCanonicalHash(config);
    return result;
  }

  /**
   * Computes anisotropic effective thermal conductivity for multilayer stackup.
   */
  public static calculateMultilayerEffectiveConductivity(layers: PcbStackupLayer[]): PcbEffectiveConductivityResult {
    return SpatialThermalSolver.calculateEffectiveConductivity(layers);
  }
}
