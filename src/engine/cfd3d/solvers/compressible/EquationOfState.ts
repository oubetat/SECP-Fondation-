/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-253 — Equation of State & Thermodynamics State Calculator
 */

import { ThermodynamicState, CompressibleFailureCode253 } from './CompressibleTypes';

export class EquationOfState {
  /**
   * Reconstruct thermodynamic state from core variables
   * R = gas constant (J/kg*K)
   * gamma = cp/cv ratio
   */
  public static calculateStateFromPrimitive(
    density: number,
    velocity: [number, number, number],
    temperature: number,
    R: number,
    gamma: number
  ): ThermodynamicState {
    if (density <= 0) {
      throw new Error(`${CompressibleFailureCode253.NEGATIVE_DENSITY}: Density must be greater than zero. Received: ${density}`);
    }
    if (temperature <= 0) {
      throw new Error(`${CompressibleFailureCode253.INVALID_THERMODYNAMIC_STATE}: Temperature must be greater than zero. Received: ${temperature}`);
    }

    const pressure = density * R * temperature;
    if (pressure <= 0) {
      throw new Error(`${CompressibleFailureCode253.NEGATIVE_PRESSURE}: Pressure must be greater than zero. Received: ${pressure}`);
    }

    const cv = R / (gamma - 1);
    const cp = cv * gamma;
    const internalEnergy = cv * temperature;
    const enthalpy = cp * temperature;

    const velSq = velocity[0] * velocity[0] + velocity[1] * velocity[1] + velocity[2] * velocity[2];
    const kineticEnergy = 0.5 * velSq;
    const totalEnergy = internalEnergy + kineticEnergy;

    const speedOfSound = Math.sqrt(gamma * R * temperature);
    const speed = Math.sqrt(velSq);
    const machNumber = speedOfSound > 0 ? speed / speedOfSound : 0;

    return {
      density,
      pressure,
      temperature,
      internalEnergy,
      enthalpy,
      totalEnergy,
      speedOfSound,
      machNumber
    };
  }

  /**
   * Reconstruct state from conservative variables: U = [rho, rho*u, rho*v, rho*w, rho*E]
   */
  public static calculateStateFromConservative(
    rho: number,
    rhoU: number,
    rhoV: number,
    rhoW: number,
    rhoE: number,
    R: number,
    gamma: number
  ): ThermodynamicState {
    if (rho <= 0) {
      throw new Error(`${CompressibleFailureCode253.NEGATIVE_DENSITY}: Conservative density must be greater than zero. Received: ${rho}`);
    }

    const u = rhoU / rho;
    const v = rhoV / rho;
    const w = rhoW / rho;
    const totalEnergy = rhoE / rho;

    const kineticEnergy = 0.5 * (u * u + v * v + w * w);
    const internalEnergy = totalEnergy - kineticEnergy;

    const cv = R / (gamma - 1);
    const temperature = internalEnergy / cv;

    if (temperature <= 0) {
      throw new Error(`${CompressibleFailureCode253.INVALID_THERMODYNAMIC_STATE}: Reconstructed temperature must be positive. Received: ${temperature}`);
    }

    const pressure = rho * R * temperature;
    if (pressure <= 0) {
      throw new Error(`${CompressibleFailureCode253.NEGATIVE_PRESSURE}: Reconstructed pressure must be positive. Received: ${pressure}`);
    }

    const cp = cv * gamma;
    const enthalpy = cp * temperature;
    const speedOfSound = Math.sqrt(gamma * R * temperature);
    const speed = Math.sqrt(u * u + v * v + w * w);
    const machNumber = speedOfSound > 0 ? speed / speedOfSound : 0;

    return {
      density: rho,
      pressure,
      temperature,
      internalEnergy,
      enthalpy,
      totalEnergy,
      speedOfSound,
      machNumber
    };
  }
}
