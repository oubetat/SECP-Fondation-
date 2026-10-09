/**
 * SECP Industrial OS v2 — Units & Dimensions Validator
 * PATCH-043: Units & Dimensions Engine
 */

import { Dimension } from './Dimension';
import { Unit, UnitRegistry } from './Unit';
import { Quantity } from './Quantity';

export class UnitValidator {
  public static verifyUnit(unitSymbol: string): boolean {
    return UnitRegistry.has(unitSymbol);
  }

  public static verifyDimension(q: Quantity, expectedDim: Dimension): boolean {
    return q.dimension.equals(expectedDim);
  }

  public static verifyConversion(value: number, from: string, to: string, expected: number, tolerance: number = 1e-6): boolean {
    const q = new Quantity(value, UnitRegistry.get(from));
    const converted = q.convertTo(to);
    return Math.abs(converted.value - expected) <= tolerance;
  }

  public static areCompatible(a: string | Unit, b: string | Unit): boolean {
    const u1 = typeof a === 'string' ? UnitRegistry.get(a) : a;
    const u2 = typeof b === 'string' ? UnitRegistry.get(b) : b;
    return u1.dimension.equals(u2.dimension);
  }
}
