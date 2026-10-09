import { FractureMode } from "./types";

export class FractureUtils {
  /**
   * Calculates Mode I Stress Intensity Factor: K_I = Y * sigma * sqrt(PI * a)
   */
  public static calculateKI(sigma: number, a: number, Y: number): number {
    if (a < 0) throw new Error("Crack length cannot be negative.");
    return Y * sigma * Math.sqrt(Math.PI * a);
  }

  /**
   * Mixed-mode interaction (Simplified example: KI/KIC + KII/KIIC = 1)
   */
  public static checkMixedMode(KI: number, KII: number, KIC: number, KIIC: number): number {
    return (KI / KIC) + (KII / KIIC);
  }

  /**
   * Plane strain condition check for KIc validity: B >= 2.5 * (KIC / sigma_y)^2
   */
  public static isPlaneStrainQualified(B: number, KIC: number, yieldStrength: number): boolean {
    const minB = 2.5 * Math.pow(KIC / yieldStrength, 2);
    return B >= minB;
  }
}
