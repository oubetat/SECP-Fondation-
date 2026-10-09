export class MeanStressCorrection {
  /**
   * Goodman: sigma_a / S_e + sigma_m / S_ut = 1
   * Corrected sigma_a = sigma_a / (1 - sigma_m / S_ut)
   */
  public static goodman(amplitude: number, meanStress: number, ultimateStrength: number): number {
    if (meanStress <= 0) return amplitude; // Typically only penalizes tensile mean stress
    const correction = 1 - (meanStress / ultimateStrength);
    if (correction <= 0) return Infinity; // Stress exceeds ultimate strength
    return amplitude / correction;
  }

  /**
   * Gerber: sigma_a / S_e + (sigma_m / S_ut)^2 = 1
   */
  public static gerber(amplitude: number, meanStress: number, ultimateStrength: number): number {
    if (meanStress <= 0) return amplitude;
    const correction = 1 - Math.pow(meanStress / ultimateStrength, 2);
    if (correction <= 0) return Infinity;
    return amplitude / correction;
  }

  /**
   * Soderberg: sigma_a / S_e + sigma_m / S_yt = 1
   */
  public static soderberg(amplitude: number, meanStress: number, yieldStrength: number): number {
    if (meanStress <= 0) return amplitude;
    const correction = 1 - (meanStress / yieldStrength);
    if (correction <= 0) return Infinity;
    return amplitude / correction;
  }
}
