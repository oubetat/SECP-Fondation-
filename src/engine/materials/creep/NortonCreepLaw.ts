import { CreepModelConfig } from "./types";

export class NortonCreepLaw {
  /**
   * Calculates the equivalent creep strain rate.
   * epsilon_dot_cr = A * sigma_eq^n
   * A = A0 * exp(-Q / (R * T))
   */
  public static calculateRate(
    sigmaEq: number,
    temperature: number,
    params: { A0: number; n: number; Q: number; R: number }
  ): number {
    const { A0, n, Q, R } = params;
    
    // Arrhenius temperature dependence
    // T must be in Kelvin
    const activationTerm = Math.exp(-Q / (R * temperature));
    const A = A0 * activationTerm;
    
    return A * Math.pow(Math.abs(sigmaEq), n);
  }
}
