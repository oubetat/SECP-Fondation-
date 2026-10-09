export class FatigueUtils {
  /**
   * Calculates stress ratio R = sigmaMin / sigmaMax
   */
  public static calculateR(sigmaMax: number, sigmaMin: number): number {
    if (Math.abs(sigmaMax) < 1e-15 && Math.abs(sigmaMin) < 1e-15) return -1;
    if (Math.abs(sigmaMax) < 1e-15) {
        // Technically undefined or infinite if sigmaMax is 0 and sigmaMin is not.
        // In fatigue, if sigmaMax is 0, it's usually compression-only.
        return sigmaMin / 1e-15; 
    }
    return sigmaMin / sigmaMax;
  }

  /**
   * Calculates stress amplitude sigmaA = (sigmaMax - sigmaMin) / 2
   */
  public static calculateAmplitude(sigmaMax: number, sigmaMin: number): number {
    return (sigmaMax - sigmaMin) / 2;
  }

  /**
   * Calculates mean stress sigmaM = (sigmaMax + sigmaMin) / 2
   */
  public static calculateMeanStress(sigmaMax: number, sigmaMin: number): number {
    return (sigmaMax + sigmaMin) / 2;
  }

  /**
   * Calculates stress range DeltaSigma = sigmaMax - sigmaMin
   */
  public static calculateRange(sigmaMax: number, sigmaMin: number): number {
    return sigmaMax - sigmaMin;
  }
}
