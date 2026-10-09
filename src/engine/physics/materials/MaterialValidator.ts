/**
 * SECP Industrial OS v2 — Material Validator
 * PATCH-044: Material Model
 */

import { MaterialModel } from './MaterialModel';
import { Dimension } from '../units/Dimension';

export class MaterialValidator {
  
  public static validate(material: MaterialModel): string[] {
    const errors: string[] = [];

    // 1. Check Identity
    if (!material.identity.materialId) errors.push('Missing materialId');
    if (!material.identity.canonicalName) errors.push('Missing canonicalName');
    
    // 2. Validate Properties
    for (const [propId, prop] of Object.entries(material.properties)) {
      if (!prop.propertyId || prop.propertyId !== propId) {
        errors.push(`Property ID mismatch for ${propId}`);
      }

      // Check physical validity of values
      if (prop.model.type === 'CONSTANT') {
        const val = prop.model.value;
        
        // Negative Density check
        if (propId === 'DENSITY') {
          if (!val.dimension.equals(Dimension.DENSITY)) {
            errors.push(`DENSITY property has invalid dimension: ${val.dimension.toString()}`);
          }
          if (val.value < 0) {
            errors.push(`Negative DENSITY is physically invalid: ${val.value}`);
          }
        }

        // Young's Modulus check
        if (propId === 'YOUNGS_MODULUS') {
          if (!val.dimension.equals(Dimension.PRESSURE)) {
             errors.push(`YOUNGS_MODULUS property has invalid dimension (should be Pressure): ${val.dimension.toString()}`);
          }
          if (val.value <= 0) {
            errors.push(`Zero or negative YOUNGS_MODULUS is physically invalid: ${val.value}`);
          }
        }

        // Poisson's Ratio check (typically -1.0 < v < 0.5 for stable isotropic materials, but we'll enforce < 0.5)
        if (propId === 'POISSONS_RATIO') {
          if (!val.dimension.equals(Dimension.SCALAR)) {
            errors.push(`POISSONS_RATIO must be scalar (dimensionless)`);
          }
          if (val.value <= -1.0 || val.value >= 0.5) {
            errors.push(`POISSONS_RATIO out of theoretical valid range (-1.0 to 0.5): ${val.value}`);
          }
        }
      }
    }

    return errors;
  }
}
