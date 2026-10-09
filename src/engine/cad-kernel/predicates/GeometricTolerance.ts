/**
 * SECP CAD Kernel — Centralized Geometric Tolerance Model
 * Phase 2 (PATCH-018)
 * 
 * Strict, immutable, deterministic, scale-aware tolerance model.
 * No arbitrary magic epsilon constants.
 */

export interface GeometricToleranceModel {
  readonly absoluteLength: number;
  readonly relativeLength: number;
  readonly angularRad: number;
  readonly area: number;
  readonly volume: number;
  readonly parameter: number;
  readonly determinant: number;
}

export class GeometricTolerance {
  /**
   * Canonical default tolerance configuration for SECP CAD modeling.
   */
  public static readonly DEFAULT: GeometricToleranceModel = Object.freeze({
    absoluteLength: 1e-7,       // 0.1 micrometer length threshold
    relativeLength: 1e-6,       // Relative coordinate drift
    angularRad: 1e-6,           // ~0.000057 degrees angular tolerance
    area: 1e-14,                // Square of linear tolerance
    volume: 1e-21,              // Cube of linear tolerance
    parameter: 1e-7,            // Parametric domain resolution
    determinant: 1e-12          // Scale-aware determinant resolution
  });

  /**
   * High-precision strict tolerance (used for algebraic verification).
   */
  public static readonly STRICT: GeometricToleranceModel = Object.freeze({
    absoluteLength: 1e-12,
    relativeLength: 1e-11,
    angularRad: 1e-9,
    area: 1e-24,
    volume: 1e-36,
    parameter: 1e-11,
    determinant: 1e-18
  });

  /**
   * Relaxed modeling tolerance (used for coarse tessellation or multi-step Booleans).
   */
  public static readonly RELAXED: GeometricToleranceModel = Object.freeze({
    absoluteLength: 1e-4,
    relativeLength: 1e-4,
    angularRad: 1e-4,
    area: 1e-8,
    volume: 1e-12,
    parameter: 1e-4,
    determinant: 1e-8
  });

  /**
   * Validates if all numbers in an input list or structure are finite.
   */
  public static isFiniteNumber(...values: number[]): boolean {
    for (let i = 0; i < values.length; i++) {
      const v = values[i];
      if (typeof v !== 'number' || !Number.isFinite(v)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Computes a scale-adjusted length tolerance based on the characteristic magnitude of coordinates.
   */
  public static getScaleAwareLengthTolerance(
    characteristicScale: number,
    model: GeometricToleranceModel = GeometricTolerance.DEFAULT
  ): number {
    const scale = Math.abs(characteristicScale);
    return Math.max(model.absoluteLength, scale * model.relativeLength);
  }

  /**
   * Computes a scale-adjusted determinant tolerance for 2D orientation (area-scaled).
   */
  public static getScaleAwareDet2DTolerance(
    maxCoordScale: number,
    model: GeometricToleranceModel = GeometricTolerance.DEFAULT
  ): number {
    const s = Math.abs(maxCoordScale);
    return Math.max(model.determinant, (s * s) * model.relativeLength);
  }

  /**
   * Computes a scale-adjusted determinant tolerance for 3D orientation (volume-scaled).
   */
  public static getScaleAwareDet3DTolerance(
    maxCoordScale: number,
    model: GeometricToleranceModel = GeometricTolerance.DEFAULT
  ): number {
    const s = Math.abs(maxCoordScale);
    return Math.max(model.determinant, (s * s * s) * model.relativeLength);
  }
}
