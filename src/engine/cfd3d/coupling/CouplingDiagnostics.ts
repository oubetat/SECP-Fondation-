/**
 * SECP Industrial OS v2 — Coupling Diagnostics
 * PATCH-054: Pressure-Velocity Coupling
 */

export enum CouplingDiagnostic {
  PRESSURE_DIVERGENCE = "PRESSURE_DIVERGENCE",
  VELOCITY_DIVERGENCE = "VELOCITY_DIVERGENCE",
  NON_FINITE_VALUE = "NON_FINITE_VALUE",
  SINGULAR_PRESSURE_MATRIX = "SINGULAR_PRESSURE_MATRIX",
  INVALID_PRESSURE_SYSTEM = "INVALID_PRESSURE_SYSTEM",
  NEGATIVE_COEFFICIENT = "NEGATIVE_COEFFICIENT",
  EXCESSIVE_CORRECTION = "EXCESSIVE_CORRECTION",
  OSCILLATORY_RESIDUAL = "OSCILLATORY_RESIDUAL",
  STAGNATING_RESIDUAL = "STAGNATING_RESIDUAL",
  NON_FINITE_MASS_FLUX = "NON_FINITE_MASS_FLUX",
  CONTINUITY_GROWTH = "CONTINUITY_GROWTH",
  MISSING_PRESSURE_REFERENCE = "MISSING_PRESSURE_REFERENCE",
  UNSUPPORTED_BOUNDARY_CONDITION = "UNSUPPORTED_BOUNDARY_CONDITION",
  UNSUPPORTED_PHYSICS_MODEL = "UNSUPPORTED_PHYSICS_MODEL",
  INVALID_RELAXATION_FACTOR = "INVALID_RELAXATION_FACTOR",
  MASS_IMBALANCE_VIOLATION = "MASS_IMBALANCE_VIOLATION"
}

export class CouplingDiagnosticsHelper {

  public static isFiniteNumber(val: number): boolean {
    return typeof val === 'number' && Number.isFinite(val) && !Number.isNaN(val);
  }

  public static isFiniteArray(arr: ArrayLike<number>): boolean {
    for (let i = 0; i < arr.length; i++) {
      if (!this.isFiniteNumber(arr[i])) return false;
    }
    return true;
  }

  public static maxAbsValue(arr: ArrayLike<number>): number {
    let maxVal = 0;
    for (let i = 0; i < arr.length; i++) {
      const absVal = Math.abs(arr[i]);
      if (absVal > maxVal) maxVal = absVal;
    }
    return maxVal;
  }
}
