/**
 * SECP CAD Kernel — Numerical Policy
 */

export interface TolerancePolicy {
  absoluteTolerance: number;
  relativeTolerance: number;
  angularToleranceRad: number;
  parameterTolerance: number;
  modelTolerance: number;
}

export class NumericalPolicy {
  public static readonly DEFAULT_POLICY: TolerancePolicy = {
    absoluteTolerance: 1e-7,
    relativeTolerance: 1e-5,
    angularToleranceRad: 1e-4,
    parameterTolerance: 1e-6,
    modelTolerance: 1e-5
  };

  public static isZero(value: number, tol = this.DEFAULT_POLICY.absoluteTolerance): boolean {
    return Math.abs(value) <= tol;
  }
}
