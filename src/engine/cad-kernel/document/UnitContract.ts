/**
 * SECP CAD Kernel — Engineering Unit Contract (PATCH-038D)
 * 
 * Formal conversion boundaries between Geometric modeling space and Physical properties:
 * - Geometric coordinates (B-Rep vertices, sketches, assembly occurrence positions/offsets): Millimetres (mm)
 * - Physical Mass properties (centerOfGravity, volume, mass): SI Standard Units (metres, m³, kg)
 * 
 * Non-Negotiable Contract:
 * Magic arithmetic (such as naked `/ 1000` or `* 1000`) is strictly forbidden across UI and kernels.
 * All conversions must pass through this explicit contract boundary.
 */

export const SECP_UNIT_CONTRACT = {
  GEOMETRY_LENGTH_UNIT: 'mm',
  PHYSICAL_LENGTH_UNIT: 'm',
  VOLUME_UNIT: 'm3',
  MASS_UNIT: 'kg',

  /**
   * Converts millimetres (CAD Geometric space) to metres (Physical SI space).
   * Used when mapping B-Rep coordinates to physical Center of Gravity (CoG).
   */
  mmToMetres(mm: number): number {
    return mm / 1000.0;
  },

  /**
   * Converts metres (Physical SI space) to millimetres (CAD Geometric space).
   */
  metresToMm(m: number): number {
    return m * 1000.0;
  },

  /**
   * Converts volume from cubic millimetres (mm³) to cubic metres (m³).
   */
  mm3ToM3(mm3: number): number {
    return mm3 / 1e9;
  },

  /**
   * Converts volume from cubic metres (m³) to cubic millimetres (mm³).
   */
  m3ToMm3(m3: number): number {
    return m3 * 1e9;
  }
} as const;
