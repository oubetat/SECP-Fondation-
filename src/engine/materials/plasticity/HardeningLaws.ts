import { HardeningType } from "./types";

export interface HardeningResult {
  yieldStress: number;
  slope: number;
}

export class HardeningLaws {
  /**
   * Linear Isotropic Hardening: sigma_y = sigma_y0 + H * eq_plastic_strain
   */
  public static linearIsotropic(
    sigma_y0: number, 
    H: number, 
    eqPlasticStrain: number
  ): HardeningResult {
    return {
      yieldStress: sigma_y0 + H * eqPlasticStrain,
      slope: H
    };
  }
}
