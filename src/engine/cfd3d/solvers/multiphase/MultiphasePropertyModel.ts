/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-252 — Multiphase Property Model
 */

import { Phase } from './MultiphaseTypes';

export class MultiphasePropertyModel {
  /**
   * Calculate mixture density for each cell: rho = alpha * rho1 + (1 - alpha) * rho2
   */
  public static computeMixtureDensity(
    alpha1: number[],
    phase1: Phase,
    phase2: Phase
  ): number[] {
    return alpha1.map(a => {
      const boundedAlpha = Math.max(0, Math.min(1, a));
      return boundedAlpha * phase1.density + (1.0 - boundedAlpha) * phase2.density;
    });
  }

  /**
   * Calculate mixture viscosity for each cell: mu = alpha * mu1 + (1 - alpha) * mu2
   */
  public static computeMixtureViscosity(
    alpha1: number[],
    phase1: Phase,
    phase2: Phase
  ): number[] {
    return alpha1.map(a => {
      const boundedAlpha = Math.max(0, Math.min(1, a));
      return boundedAlpha * phase1.viscosity + (1.0 - boundedAlpha) * phase2.viscosity;
    });
  }

  /**
   * Calculate mixture thermal properties: k and Cp
   */
  public static computeMixtureThermalConductivity(
    alpha1: number[],
    phase1: Phase,
    phase2: Phase
  ): number[] {
    const k1 = phase1.thermalConductivity ?? 0.0262;
    const k2 = phase2.thermalConductivity ?? 0.6;
    return alpha1.map(a => {
      const boundedAlpha = Math.max(0, Math.min(1, a));
      return boundedAlpha * k1 + (1.0 - boundedAlpha) * k2;
    });
  }

  public static computeMixtureSpecificHeat(
    alpha1: number[],
    phase1: Phase,
    phase2: Phase
  ): number[] {
    const Cp1 = phase1.specificHeat ?? 1005.0;
    const Cp2 = phase2.specificHeat ?? 4184.0;
    return alpha1.map(a => {
      const boundedAlpha = Math.max(0, Math.min(1, a));
      return boundedAlpha * Cp1 + (1.0 - boundedAlpha) * Cp2;
    });
  }
}
