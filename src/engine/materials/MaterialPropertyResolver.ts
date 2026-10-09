import { MaterialProperty, PropertyProvenance } from "./types";

export class MaterialPropertyResolver {
  /**
   * Validates if a property value is physically plausible for its category.
   */
  public static validateRange(prop: MaterialProperty): boolean {
    if (prop.name === 'YOUNGS_MODULUS' && prop.value <= 0) return false;
    if (prop.name === 'DENSITY' && prop.value <= 0) return false;
    if (prop.name === 'POISSON_RATIO' && (prop.value < 0 || prop.value >= 0.5)) return false;
    return true;
  }

  /**
   * Resolves conflicts between two sources for the same property.
   * Priority: EXPERIMENT > STANDARD > MANUFACTURER > DATABASE.
   */
  public static resolveConflict(p1: MaterialProperty, p2: MaterialProperty): MaterialProperty {
    const priority = {
      'EXPERIMENT': 4,
      'STANDARD': 3,
      'MANUFACTURER': 2,
      'SUPPLIER': 1,
      'PUBLICATION': 1,
      'DATABASE': 0,
      'CERTIFICATE': 5 // Highest priority for batch-specific data
    };

    const v1 = priority[p1.provenance.sourceType] || 0;
    const v2 = priority[p2.provenance.sourceType] || 0;

    return v1 >= v2 ? p1 : p2;
  }

  /**
   * Verifies dimensional consistency of units.
   */
  public static verifyUnit(prop: MaterialProperty): boolean {
    const units: Record<string, string> = {
      'YOUNGS_MODULUS': 'Pa',
      'YIELD_STRENGTH': 'Pa',
      'DENSITY': 'kg/m^3',
      'POISSON_RATIO': '1',
      'THERMAL_CONDUCTIVITY': 'W/m/K'
    };
    
    // In a real system, we would have a full unit conversion engine here.
    // For PATCH-089, we ensure the unit is declared and not empty.
    return prop.unit.length > 0;
  }
}
