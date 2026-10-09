/**
 * SECP Industrial OS v2 — Energy Conservation Framework
 * PATCH-059: Energy State Representation
 */

import { EnergyFormulation } from './EnergyConservationTypes';

export class EnergyState {
  constructor(
    public readonly temperature: number,          // [K]
    public readonly density: number,              // [kg/m^3]
    public readonly velocity: [number, number, number], // [m/s]
    public readonly specificHeatCv: number,        // [J/(kg*K)]
    public readonly specificHeatCp: number,        // [J/(kg*K)]
    public readonly formulation: EnergyFormulation = EnergyFormulation.TOTAL_ENERGY
  ) {
    if (!Number.isFinite(temperature) || temperature <= 0) {
      throw new Error(`Invalid non-positive temperature: ${temperature}`);
    }
    if (!Number.isFinite(density) || density <= 0) {
      throw new Error(`Invalid non-positive density: ${density}`);
    }
    if (!Number.isFinite(specificHeatCv) || specificHeatCv <= 0) {
      throw new Error(`Invalid non-positive Cv: ${specificHeatCv}`);
    }
    if (!Number.isFinite(specificHeatCp) || specificHeatCp <= 0) {
      throw new Error(`Invalid non-positive Cp: ${specificHeatCp}`);
    }
    if (velocity.some(v => !Number.isFinite(v))) {
      throw new Error(`Non-finite velocity component in EnergyState: [${velocity.join(', ')}]`);
    }
  }

  /**
   * Specific internal energy e = Cv * T [J/kg]
   */
  public get specificInternalEnergy(): number {
    return this.specificHeatCv * this.temperature;
  }

  /**
   * Specific kinetic energy k_e = 0.5 * |u|^2 [J/kg]
   */
  public get specificKineticEnergy(): number {
    const v2 = this.velocity[0] ** 2 + this.velocity[1] ** 2 + this.velocity[2] ** 2;
    return 0.5 * v2;
  }

  /**
   * Specific total energy E = e + k_e [J/kg]
   */
  public get specificTotalEnergy(): number {
    return this.specificInternalEnergy + this.specificKineticEnergy;
  }

  /**
   * Total energy density rho * E [J/m^3]
   */
  public get energyDensity(): number {
    return this.density * this.specificTotalEnergy;
  }

  /**
   * Specific enthalpy h = Cp * T [J/kg]
   */
  public get specificEnthalpy(): number {
    return this.specificHeatCp * this.temperature;
  }

  /**
   * Specific total enthalpy H = h + k_e [J/kg]
   */
  public get specificTotalEnthalpy(): number {
    return this.specificEnthalpy + this.specificKineticEnergy;
  }

  public getEnergyValue(formulation: EnergyFormulation): number {
    switch (formulation) {
      case EnergyFormulation.INTERNAL_ENERGY:
        return this.specificInternalEnergy;
      case EnergyFormulation.TOTAL_ENERGY:
        return this.specificTotalEnergy;
      case EnergyFormulation.ENTHALPY:
        return this.specificEnthalpy;
      case EnergyFormulation.TOTAL_ENTHALPY:
        return this.specificTotalEnthalpy;
      default:
        return this.specificTotalEnergy;
    }
  }
}
