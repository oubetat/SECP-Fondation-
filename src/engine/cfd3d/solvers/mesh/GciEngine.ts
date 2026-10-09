/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-069: Observed Order, Richardson Extrapolation, and Grid Convergence Index (GCI)
 */

export interface GciCalculationResult {
  readonly observedOrder: number;
  readonly richardsonExtrapolation: number;
  readonly gciFine: number;
  readonly gciFineFraction: number;
  readonly gciFinePercent: number;
  readonly asymptoticRangeIndicator: number;
  readonly isAsymptotic: boolean;
  readonly isMonotonic: boolean;
}

export class GciEngine {
  public static calculate(
    phi1: number, // Fine
    phi2: number, // Medium
    phi3: number, // Coarse
    r: number,    // Constant refinement ratio (h_coarse / h_fine)
    safetyFactor: number = 1.25
  ): GciCalculationResult {
    const d21 = phi2 - phi1;
    const d32 = phi3 - phi2;

    // Check monotonicity: sign(d21) must equal sign(d32)
    const isMonotonic = Math.sign(d21) === Math.sign(d32) && d21 !== 0 && d32 !== 0;

    if (!isMonotonic) {
      return {
        observedOrder: 0.0,
        richardsonExtrapolation: phi1,
        gciFine: 1.0, // 100% uncertainty on non-monotonic
        gciFineFraction: 1.0,
        gciFinePercent: 100.0,
        asymptoticRangeIndicator: 0.0,
        isAsymptotic: false,
        isMonotonic: false
      };
    }

    // Observed order p = ln(|d32 / d21|) / ln(r)
    const observedOrder = Math.abs(Math.log(Math.abs(d32 / d21)) / Math.log(r));

    // Richardson Extrapolation: phi_ext = phi1 + (phi1 - phi2) / (r^p - 1)
    const divisor = Math.pow(r, observedOrder) - 1.0;
    const richardsonExtrapolation = divisor > 0 ? phi1 + (phi1 - phi2) / divisor : phi1;

    // Grid Convergence Index (GCI): GCI_fine = Fs * |(phi1 - phi2) / phi1| / (r^p - 1)
    const relativeError = Math.abs((phi1 - phi2) / (phi1 || 1e-15));
    const gciFine = divisor > 0 ? (safetyFactor * relativeError) / divisor : 1.0;
    const gciFineFraction = gciFine;
    const gciFinePercent = gciFine * 100.0;

    // GCI_coarse = Fs * |(phi2 - phi3) / phi2| / (r^p - 1)
    const relativeErrorCoarse = Math.abs((phi2 - phi3) / (phi2 || 1e-15));
    const gciCoarse = divisor > 0 ? (safetyFactor * relativeErrorCoarse) / divisor : 1.0;

    // Asymptotic Range Indicator: GCI_coarse / (r^p * GCI_fine)
    const term = Math.pow(r, observedOrder);
    const asymptoticRangeIndicator = term > 0 && gciFine > 0 ? gciCoarse / (term * gciFine) : 0.0;
    const isAsymptotic = Math.abs(asymptoticRangeIndicator - 1.0) < 0.1;

    return {
      observedOrder,
      richardsonExtrapolation,
      gciFine,
      gciFineFraction,
      gciFinePercent,
      asymptoticRangeIndicator,
      isAsymptotic,
      isMonotonic
    };
  }
}
