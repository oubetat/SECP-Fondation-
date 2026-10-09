import { FatigueCurveParameters, FatigueCurveType } from "./types";

export class BasquinModel {
  /**
   * Basquin's Law: sigma_a = sigma_f' * (2Nf)^b
   * returns cycles to failure Nf
   */
  public static predictLife(amplitude: number, params: Record<string, number>): number {
    const sigmaF = params.sigmaF;
    const b = params.b;
    
    // sigma_a / sigma_f' = (2Nf)^b
    // (sigma_a / sigma_f')^(1/b) = 2Nf
    // Nf = 0.5 * (sigma_a / sigma_f')^(1/b)
    
    if (amplitude <= 0) return Infinity;
    const reversals = Math.pow(amplitude / sigmaF, 1 / b);
    return 0.5 * reversals;
  }
}

export class CoffinMansonModel {
  /**
   * Coffin-Manson: eps_pa = eps_f' * (2Nf)^c
   */
  public static predictPlasticLife(plasticAmplitude: number, params: Record<string, number>): number {
    const epsF = params.epsF;
    const c = params.c;
    
    if (plasticAmplitude <= 0) return Infinity;
    const reversals = Math.pow(plasticAmplitude / epsF, 1 / c);
    return 0.5 * reversals;
  }
}
