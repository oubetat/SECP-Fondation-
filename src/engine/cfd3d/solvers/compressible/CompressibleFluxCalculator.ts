/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-253 — Numerical Flux Calculator & Shock Capturing Engine
 */

import { FluxSchemeType, ThermodynamicState } from './CompressibleTypes';

export class CompressibleFluxCalculator {
  /**
   * Computes the numerical flux vector for: [rho, rho*u, rho*v, rho*w, rho*E]
   * given left and right thermodynamic states across a face.
   */
  public static computeFlux(
    stateL: ThermodynamicState,
    velL: [number, number, number],
    stateR: ThermodynamicState,
    velR: [number, number, number],
    normal: [number, number, number], // unit normal vector
    scheme: FluxSchemeType,
    gamma: number,
    artificialViscosity: boolean = true
  ): {
    massFlux: number;
    momentumFlux: [number, number, number];
    energyFlux: number;
  } {
    // Normal projections of velocity
    const uNL = velL[0] * normal[0] + velL[1] * normal[1] + velL[2] * normal[2];
    const uNR = velR[0] * normal[0] + velR[1] * normal[1] + velR[2] * normal[2];

    // Left state fluxes
    const fMassL = stateL.density * uNL;
    const fMomL: [number, number, number] = [
      stateL.density * velL[0] * uNL + stateL.pressure * normal[0],
      stateL.density * velL[1] * uNL + stateL.pressure * normal[1],
      stateL.density * velL[2] * uNL + stateL.pressure * normal[2]
    ];
    const fEnergyL = (stateL.density * stateL.totalEnergy + stateL.pressure) * uNL;

    // Right state fluxes
    const fMassR = stateR.density * uNR;
    const fMomR: [number, number, number] = [
      stateR.density * velR[0] * uNR + stateR.pressure * normal[0],
      stateR.density * velR[1] * uNR + stateR.pressure * normal[1],
      stateR.density * velR[2] * uNR + stateR.pressure * normal[2]
    ];
    const fEnergyR = (stateR.density * stateR.totalEnergy + stateR.pressure) * uNR;

    // Default return fluxes
    let massFlux = 0;
    let momentumFlux: [number, number, number] = [0, 0, 0];
    let energyFlux = 0;

    switch (scheme) {
      case FluxSchemeType.CENTRAL:
        // Pure central scheme
        massFlux = 0.5 * (fMassL + fMassR);
        momentumFlux = [
          0.5 * (fMomL[0] + fMomR[0]),
          0.5 * (fMomL[1] + fMomR[1]),
          0.5 * (fMomL[2] + fMomR[2])
        ];
        energyFlux = 0.5 * (fEnergyL + fEnergyR);
        break;

      case FluxSchemeType.UPWIND: {
        // Upwind biased based on average normal velocity
        const uAvg = 0.5 * (uNL + uNR);
        if (uAvg >= 0) {
          massFlux = fMassL;
          momentumFlux = fMomL;
          energyFlux = fEnergyL;
        } else {
          massFlux = fMassR;
          momentumFlux = fMomR;
          energyFlux = fEnergyR;
        }
        break;
      }

      case FluxSchemeType.LAX_FRIEDRICHS:
      case FluxSchemeType.HLL:
      default: {
        // Local Lax-Friedrichs (Rusanov) flux
        // Maximum wave speed: c = max(|uN| + a)
        const cL = Math.abs(uNL) + stateL.speedOfSound;
        const cR = Math.abs(uNR) + stateR.speedOfSound;
        const lambda = Math.max(cL, cR);

        // Diffusive stabilizing term
        const diffMass = 0.5 * lambda * (stateL.density - stateR.density);
        const diffMom: [number, number, number] = [
          0.5 * lambda * (stateL.density * velL[0] - stateR.density * velR[0]),
          0.5 * lambda * (stateL.density * velL[1] - stateR.density * velR[1]),
          0.5 * lambda * (stateL.density * velL[2] - stateR.density * velR[2])
        ];
        const diffEnergy = 0.5 * lambda * (stateL.density * stateL.totalEnergy - stateR.density * stateR.totalEnergy);

        massFlux = 0.5 * (fMassL + fMassR) + diffMass;
        momentumFlux = [
          0.5 * (fMomL[0] + fMomR[0]) + diffMom[0],
          0.5 * (fMomL[1] + fMomR[1]) + diffMom[1],
          0.5 * (fMomL[2] + fMomR[2]) + diffMom[2]
        ];
        energyFlux = 0.5 * (fEnergyL + fEnergyR) + diffEnergy;
        break;
      }
    }

    // Apply artificial viscosity (Shock Capturing) if requested
    if (artificialViscosity) {
      // Scale based on pressure gradients or differences
      const pDiff = Math.abs(stateL.pressure - stateR.pressure);
      const pMax = Math.max(stateL.pressure, stateR.pressure, 1e-5);
      const shockSensor = Math.min(1.0, pDiff / pMax);

      if (shockSensor > 0.05) {
        // Dynamic blending with upwind / dissipative flux
        const lambda = Math.max(stateL.speedOfSound, stateR.speedOfSound);
        massFlux += 0.2 * shockSensor * lambda * (stateL.density - stateR.density);
        momentumFlux[0] += 0.2 * shockSensor * lambda * (stateL.density * velL[0] - stateR.density * velR[0]);
        momentumFlux[1] += 0.2 * shockSensor * lambda * (stateL.density * velL[1] - stateR.density * velR[1]);
        momentumFlux[2] += 0.2 * shockSensor * lambda * (stateL.density * velL[2] - stateR.density * velR[2]);
        energyFlux += 0.2 * shockSensor * lambda * (stateL.density * stateL.totalEnergy - stateR.density * stateR.totalEnergy);
      }
    }

    return { massFlux, momentumFlux, energyFlux };
  }
}
