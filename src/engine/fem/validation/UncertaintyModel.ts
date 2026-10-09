export class UncertaintyModel {
  /**
   * Combines experimental and simulation uncertainties using RSS (Root Sum Square).
   */
  public static combineUncertainty(expUnc: number, simUnc: number): number {
    return Math.sqrt(expUnc * expUnc + simUnc * simUnc);
  }

  /**
   * Evaluates if a prediction is within the uncertainty-aware acceptance margin.
   */
  public static isWithinMargin(
    measured: number,
    predicted: number,
    threshold: number,
    combinedUncertainty: number
  ): boolean {
    const error = Math.abs(measured - predicted);
    // Acceptance if error is less than threshold PLUS combined uncertainty
    return error <= (threshold + combinedUncertainty);
  }
}
