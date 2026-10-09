/**
 * SECP Industrial OS — CAP-SUP-003 Independent Mathematical Oracle
 *
 * Provides a completely decoupled, independent reference implementation
 * for manufactured analytical solutions, exact calculus derivatives,
 * exact domain integrals, and ASME V&V 20-2009 verification mathematics.
 *
 * CRITICAL INDEPENDENCE RULE:
 * This module does NOT import or rely on any production solver,
 * verifier, or matrix algebra routines.
 */

export interface IndependentMmsReference {
  exact1D: (x: number) => number;
  exact1DPrime: (x: number) => number;
  exact1DDoublePrime: (x: number) => number;
  exact1DIntegral: number; // Analytical integral over [0, 1]
  exactSource1D: (x: number, nu: number) => number;
  
  exact2D: (x: number, y: number) => number;
  exact2DGradient: (x: number, y: number) => [number, number];
  exact2DLaplacian: (x: number, y: number) => number;
  exact2DIntegral: number; // Analytical integral over [0,1]x[0,1]
  exactSource2D: (x: number, y: number, k: number) => number;
}

export interface IndependentGciReferenceResult {
  apparentOrder: number;
  extrapolatedValue: number;
  approximateRelativeError: number;
  extrapolatedRelativeError: number;
  fineGciPercent: number;
  mediumGciPercent: number;
  asymptoticIndex: number;
  discretizationUncertainty: number;
  isMonotonic: boolean;
  isInAsymptoticRange: boolean;
}

export class IndependentMmsOracle {

  /**
   * Reference analytical solutions and exact derivatives.
   */
  public static readonly AnalyticalTruth: IndependentMmsReference = {
    // 1D Convection-Diffusion: u(x) = sin(pi * x)
    exact1D: (x: number): number => Math.sin(Math.PI * x),
    exact1DPrime: (x: number): number => Math.PI * Math.cos(Math.PI * x),
    exact1DDoublePrime: (x: number): number => -Math.PI * Math.PI * Math.sin(Math.PI * x),
    // \int_0^1 sin(pi*x) dx = [-cos(pi*x)/pi]_0^1 = 2 / pi
    exact1DIntegral: 2.0 / Math.PI,
    
    // -nu * u'' + u * u' = nu * pi^2 * sin(pi*x) + pi * sin(pi*x) * cos(pi*x)
    exactSource1D: (x: number, nu: number): number => {
      const s = Math.sin(Math.PI * x);
      const c = Math.cos(Math.PI * x);
      return nu * Math.PI * Math.PI * s + Math.PI * s * c;
    },

    // 2D Poisson: u(x, y) = sin(pi * x) * sin(pi * y)
    exact2D: (x: number, y: number): number => Math.sin(Math.PI * x) * Math.sin(Math.PI * y),
    exact2DGradient: (x: number, y: number): [number, number] => [
      Math.PI * Math.cos(Math.PI * x) * Math.sin(Math.PI * y),
      Math.PI * Math.sin(Math.PI * x) * Math.cos(Math.PI * y)
    ],
    // d2u/dx2 + d2u/dy2 = -2 * pi^2 * sin(pi*x) * sin(pi*y)
    exact2DLaplacian: (x: number, y: number): number => {
      return -2.0 * Math.PI * Math.PI * Math.sin(Math.PI * x) * Math.sin(Math.PI * y);
    },
    // \int_0^1 \int_0^1 sin(pi*x)sin(pi*y) dx dy = (2/pi) * (2/pi) = 4 / pi^2
    exact2DIntegral: 4.0 / (Math.PI * Math.PI),

    // -k * laplacian(u) = 2 * k * pi^2 * sin(pi*x) * sin(pi*y)
    exactSource2D: (x: number, y: number, k: number): number => {
      return 2.0 * k * Math.PI * Math.PI * Math.sin(Math.PI * x) * Math.sin(Math.PI * y);
    }
  };

  /**
   * Independent analytical verification of error norms against continuous exact solution.
   */
  public static computeIndependentNorms(
    numerical: readonly number[],
    exact: readonly number[]
  ): { l1: number; l2: number; lInf: number } {
    if (numerical.length !== exact.length || numerical.length === 0) {
      throw new Error('Dimension mismatch in independent norm computation.');
    }
    const N = numerical.length;
    let sumAbs = 0;
    let sumSq = 0;
    let maxAbs = 0;

    for (let i = 0; i < N; i++) {
      const diff = Math.abs(numerical[i] - exact[i]);
      sumAbs += diff;
      sumSq += diff * diff;
      if (diff > maxAbs) {
        maxAbs = diff;
      }
    }

    return {
      l1: sumAbs / N,
      l2: Math.sqrt(sumSq / N),
      lInf: maxAbs
    };
  }

  /**
   * Decoupled ASME V&V 20-2009 Standard Calculation of Grid Convergence Index (GCI).
   *
   * @param phi1 Fine grid solution (h1)
   * @param phi2 Medium grid solution (h2)
   * @param phi3 Coarse grid solution (h3)
   * @param r21 Refinement ratio h2 / h1 (must be >= 1.1, typically 1.3 to 2.0)
   * @param r32 Refinement ratio h3 / h2
   * @param Fs Safety factor (1.25 for 3-grid study per ASME V&V 20)
   */
  public static computeIndependentGci(
    phi1: number,
    phi2: number,
    phi3: number,
    r21: number,
    r32: number,
    Fs: number = 1.25
  ): IndependentGciReferenceResult {
    const eps21 = phi2 - phi1;
    const eps32 = phi3 - phi2;

    const monotonicityRatio = Math.abs(eps32) > 1e-15 ? eps21 / eps32 : 0;
    const isMonotonic = monotonicityRatio > 0 && monotonicityRatio < 1.0;

    // Solve for apparent order p
    let p = 2.0;
    if (Math.abs(eps21) > 1e-15 && Math.abs(eps32) > 1e-15) {
      if (Math.abs(r21 - r32) < 1e-6) {
        // Constant refinement ratio: analytical closed form
        p = Math.abs(Math.log(Math.abs(eps32 / eps21)) / Math.log(r21));
      } else {
        // Variable refinement ratio: solve transcendental equation f(p) = 0 via Newton-Raphson
        p = this.solveVariableRefinementOrder(eps32, eps21, r21, r32);
      }
    }

    // Richardson extrapolation
    const denom21 = Math.pow(r21, p) - 1.0;
    const extrapolatedValue = Math.abs(denom21) > 1e-14
      ? (Math.pow(r21, p) * phi1 - phi2) / denom21
      : phi1;

    // Relative errors
    const ea21 = Math.abs(phi1) > 1e-15 ? Math.abs((phi1 - phi2) / phi1) : Math.abs(phi1 - phi2);
    const ea32 = Math.abs(phi2) > 1e-15 ? Math.abs((phi2 - phi3) / phi2) : Math.abs(phi2 - phi3);
    const eExt = Math.abs(extrapolatedValue) > 1e-15
      ? Math.abs((extrapolatedValue - phi1) / extrapolatedValue)
      : 0;

    // Grid Convergence Indices (in %)
    const denom32 = Math.pow(r32, p) - 1.0;
    const fineGciPercent = Math.abs(denom21) > 1e-14 ? (Fs * ea21 / denom21) * 100.0 : 0.0;
    const mediumGciPercent = Math.abs(denom32) > 1e-14 ? (Fs * ea32 / denom32) * 100.0 : 0.0;

    // Asymptotic range check: GCI_medium / (r21^p * GCI_fine) ~ 1.0
    const asymptoticDenominator = Math.pow(r21, p) * fineGciPercent;
    const asymptoticIndex = asymptoticDenominator > 1e-14
      ? mediumGciPercent / asymptoticDenominator
      : 1.0;

    const isInAsymptoticRange = asymptoticIndex >= 0.90 && asymptoticIndex <= 1.10;

    // Discretization uncertainty u_num (ASME V&V 20: u_num = GCI_fine / Fs * |phi1|)
    const discretizationUncertainty = (fineGciPercent / 100.0) * Math.abs(phi1);

    return {
      apparentOrder: p,
      extrapolatedValue,
      approximateRelativeError: ea21,
      extrapolatedRelativeError: eExt,
      fineGciPercent,
      mediumGciPercent,
      asymptoticIndex,
      discretizationUncertainty,
      isMonotonic,
      isInAsymptoticRange
    };
  }

  /**
   * Newton-Raphson solver for apparent order with variable grid refinement ratios.
   * Based on Celik et al. (2008), ASME J. Fluids Eng.
   */
  private static solveVariableRefinementOrder(
    eps32: number,
    eps21: number,
    r21: number,
    r32: number
  ): number {
    let p = 2.0;
    const s = Math.sign(eps32 / eps21);
    const targetRatio = Math.abs(eps32 / eps21);

    for (let iter = 0; iter < 50; iter++) {
      const q = Math.log((Math.pow(r21, p) - s) / (Math.pow(r32, p) - s));
      const f = (1.0 / Math.log(r21)) * Math.abs(Math.log(targetRatio) + q) - p;
      if (Math.abs(f) < 1e-8) break;
      // Fixed point relaxation
      p = p + 0.5 * f;
      if (p <= 0.1) p = 0.1;
      if (p > 10.0) p = 10.0;
    }
    return p;
  }
}
