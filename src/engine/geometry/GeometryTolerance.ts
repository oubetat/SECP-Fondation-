/**
 * SECP Geometry Tolerance Configuration
 * Segmented tolerance layers to handle strict algebraic verification (1e-15)
 * while ensuring modeling operations do not fail under sequential Boolean evaluations.
 */

export const Tolerance = {
  // Strict algebraic consistency checking (ideal for deterministic kernel assertions)
  KERNEL_NUMERICAL: 1e-15,

  // Validation tolerance for volume, surface area and general test suite expectations
  VALIDATION: 1e-7,

  // Modeling tolerance for sequential B-Rep Boolean operations (fuse, cut, common)
  MODELING: 1e-5,

  // Merging and topology consolidation limits
  MERGE: 1e-4,

  // Angular deviation limit in radians for smooth tangency matching
  ANGULAR: 1e-9,

  // Linear / angular deflection threshold for lightweight viewport tessellation
  DISPLAY_TESSELLATION: 0.1
};

export class ToleranceManager {
  /**
   * Compares two scalar values under a specific tolerance context
   */
  public static isWithin(a: number, b: number, tol = Tolerance.VALIDATION): boolean {
    return Math.abs(a - b) < tol;
  }

  /**
   * Validates geometric equivalence of two properties under modeling conditions
   */
  public static equalModeling(a: number, b: number): boolean {
    return Math.abs(a - b) < Tolerance.MODELING;
  }

  /**
   * Validates high-precision numerical assertions
   */
  public static equalStrict(a: number, b: number): boolean {
    return Math.abs(a - b) < Tolerance.KERNEL_NUMERICAL;
  }
}
