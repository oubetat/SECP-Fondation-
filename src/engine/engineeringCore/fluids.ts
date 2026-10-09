/**
 * SECP Engineering Calculation Core — Fluids Engine
 * Flow Rate, Mass Flow, Velocity, Pressure Drop, Reynolds Number, Hydrostatic Pressure.
 */

export class FluidsEngine {
  /** Volumetric Flow Rate Q = A * v (m³/s) */
  public static calculateFlowRate(areaM2: number, velocityMS: number): number {
    return areaM2 * velocityMS;
  }

  /** Mass Flow Rate m_dot = rho * Q (kg/s) */
  public static calculateMassFlowRate(densityKgM3: number, flowRateM3S: number): number {
    return densityKgM3 * flowRateM3S;
  }

  /** Fluid Velocity v = Q / A (m/s) */
  public static calculateVelocity(flowRateM3S: number, diameterM: number): number {
    const area = (Math.PI * Math.pow(diameterM, 2)) / 4;
    if (area <= 0) return 0;
    return flowRateM3S / area;
  }

  /** Reynolds Number Re = (rho * v * D) / mu */
  public static calculateReynoldsNumber(
    densityKgM3: number,
    velocityMS: number,
    diameterM: number,
    dynamicViscosityPaS: number
  ): { reynoldsNumber: number; flowType: 'LAMINAR' | 'TRANSIENT' | 'TURBULENT' } {
    if (dynamicViscosityPaS <= 0) return { reynoldsNumber: 0, flowType: 'LAMINAR' };
    const Re = (densityKgM3 * velocityMS * diameterM) / dynamicViscosityPaS;
    let flowType: 'LAMINAR' | 'TRANSIENT' | 'TURBULENT' = 'LAMINAR';
    if (Re > 4000) flowType = 'TURBULENT';
    else if (Re >= 2300) flowType = 'TRANSIENT';
    return { reynoldsNumber: Re, flowType };
  }

  /** Darcy-Weisbach Pressure Drop deltaP = f * (L / D) * (rho * v^2 / 2) (Pa) */
  public static calculatePressureDropPa(
    frictionFactor: number,
    lengthM: number,
    diameterM: number,
    densityKgM3: number,
    velocityMS: number
  ): number {
    if (diameterM <= 0) return 0;
    return frictionFactor * (lengthM / diameterM) * ((densityKgM3 * Math.pow(velocityMS, 2)) / 2);
  }

  /** Hydrostatic Pressure P = rho * g * h (Pa) */
  public static calculateHydrostaticPressurePa(densityKgM3: number, depthM: number): number {
    return densityKgM3 * 9.80665 * depthM;
  }
}
