/**
 * SECP Industrial OS v2 — Unit Parser
 * PATCH-043: Units & Dimensions Engine
 */

import { Unit, UnitRegistry } from './Unit';
import { Dimension } from './Dimension';

export class UnitParser {
  /**
   * Parses basic compound units like "m/s", "kg/m^3".
   * For PATCH-043, we support single slash and simple symbols.
   */
  public static parse(expression: string): Unit {
    const trimmed = expression.trim();
    if (UnitRegistry.has(trimmed)) {
      return UnitRegistry.get(trimmed);
    }

    // Handle m/s pattern
    if (trimmed.includes('/')) {
      const [numPart, denPart] = trimmed.split('/');
      const numUnit = UnitRegistry.get(numPart.trim());
      const denUnit = UnitRegistry.get(denPart.trim());

      const compositeDim = numUnit.dimension.divide(denUnit.dimension);
      const compositeScale = numUnit.scale / denUnit.scale;

      return {
        id: `parsed_${trimmed}`,
        symbol: trimmed,
        name: `Parsed Unit ${trimmed}`,
        dimension: compositeDim,
        scale: compositeScale,
        offset: 0,
        system: 'OTHER',
        aliases: []
      };
    }

    throw new Error(`Failed to parse unit expression: ${expression}`);
  }
}
