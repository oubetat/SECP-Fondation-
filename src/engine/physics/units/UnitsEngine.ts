/**
 * SECP Industrial OS v2 — Units Engine Adapter
 * PATCH-043 / PATCH-050
 */

import { UnitParser } from "./UnitParser";
import { Quantity } from "./Quantity";

export interface UnitConversionResult {
  valid: boolean;
  value?: number;
  errors: string[];
}

export class UnitsEngine {
  public static convertUnit(value: number, fromUnitStr: string, toUnitStr: string): UnitConversionResult {
    try {
      if (!fromUnitStr || !toUnitStr) {
        return { valid: false, errors: ["Missing unit specification"] };
      }

      const fromUnit = UnitParser.parse(fromUnitStr);
      const toUnit = UnitParser.parse(toUnitStr);

      if (!fromUnit.dimension.equals(toUnit.dimension)) {
        return {
          valid: false,
          errors: [`Incompatible dimensions: '${fromUnitStr}' (${fromUnit.dimension.toString()}) vs '${toUnitStr}' (${toUnit.dimension.toString()})`]
        };
      }

      const q = new Quantity(value, fromUnit);
      const converted = q.convertTo(toUnit);

      return {
        valid: true,
        value: converted.value,
        errors: []
      };
    } catch (err: any) {
      return {
        valid: false,
        errors: [err.message || String(err)]
      };
    }
  }
}
