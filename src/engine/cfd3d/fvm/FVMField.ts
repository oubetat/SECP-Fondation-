/**
 * SECP Industrial OS v2 — FVM Field
 * PATCH-052: Finite Volume Core
 */

import { FVMField, FieldLocation } from './FVMTypes';
import { UnitsEngine } from '../../physics/units/UnitsEngine';

export class FVMFieldManager {
  /**
   * Validates that field dimensions match the mesh and contain finite values.
   */
  public static validateField<T>(field: FVMField<T>, expectedCount: number): { valid: boolean; error?: string } {
    if (!field.values) return { valid: false, error: 'Field values are missing' };
    if (field.values.length !== expectedCount) {
      return { 
        valid: false, 
        error: `Field size mismatch: expected ${expectedCount}, got ${field.values.length}` 
      };
    }

    for (let i = 0; i < field.values.length; i++) {
      const val = field.values[i];
      if (typeof val === 'number') {
        if (!Number.isFinite(val)) return { valid: false, error: `Non-finite value at index ${i}` };
      } else if (Array.isArray(val)) {
        for (const v of val) {
          if (!Number.isFinite(v)) return { valid: false, error: `Non-finite vector component at index ${i}` };
        }
      }
    }

    return { valid: true };
  }

  /**
   * Checks unit compatibility for two fields or a field and a target unit.
   */
  public static checkCompatibility(field: FVMField<any>, targetUnit: string): boolean {
    const check = UnitsEngine.convertUnit(1, field.unit, targetUnit);
    return check.valid;
  }
}
