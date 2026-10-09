/**
 * SECP Engineering Calculation Core — Thermodynamics Engine
 * Conduction, Convection, Thermal Stress, Heat Capacity.
 */

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
}
