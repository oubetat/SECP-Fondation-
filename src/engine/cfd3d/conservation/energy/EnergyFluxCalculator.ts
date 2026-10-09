/**
 * SECP Industrial OS v2 — Energy Conservation Framework
 * PATCH-059: Convective Energy Flux Calculator
 */

import { CFDMeshFace3D } from '../../mesh/CFDMeshTypes';
import { EnergyState } from './EnergyState';
import { EnergyFormulation } from './EnergyConservationTypes';

export class EnergyFluxCalculator {
  /**
   * Calculates convective energy flux across a face: F_conv = rho * E * (u . n) * A
   * Positive = Outflow of energy
   */
  public static calculateConvectiveEnergyFlux(
    face: CFDMeshFace3D,
    state: EnergyState,
    normal: [number, number, number]
  ): number {
    const energyVal = state.getEnergyValue(state.formulation);
    const uDotN = state.velocity[0] * normal[0] +
                 state.velocity[1] * normal[1] +
                 state.velocity[2] * normal[2];

    const flux = state.density * energyVal * uDotN * face.area;
    if (!Number.isFinite(flux)) {
      throw new Error(`Non-finite convective energy flux calculated`);
    }
    return flux;
  }

  public static recomputeConvectiveEnergyFlux(
    face: CFDMeshFace3D,
    rho: number,
    energyVal: number,
    velocity: [number, number, number],
    normal: [number, number, number]
  ): number {
    if (!Number.isFinite(rho) || rho <= 0) {
      throw new Error(`Invalid density for energy flux recomputation: ${rho}`);
    }
    if (!Number.isFinite(energyVal)) {
      throw new Error(`Invalid energy value for recomputation: ${energyVal}`);
    }
    const uDotN = velocity[0] * normal[0] + velocity[1] * normal[1] + velocity[2] * normal[2];
    return rho * energyVal * uDotN * face.area;
  }
}
