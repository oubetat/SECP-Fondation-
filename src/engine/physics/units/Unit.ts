/**
 * SECP Industrial OS v2 — Unit Model
 * PATCH-043: Units & Dimensions Engine
 */

import { Dimension } from './Dimension';

export interface Unit {
  id: string;
  symbol: string;
  name: string;
  dimension: Dimension;
  scale: number;
  offset: number;
  system: 'SI' | 'METRIC' | 'IMPERIAL' | 'OTHER';
  aliases: string[];
}

export class UnitRegistry {
  private static units = new Map<string, Unit>();
  private static symbolMap = new Map<string, string>(); // symbol/alias -> id

  public static register(unit: Unit): void {
    if (this.units.has(unit.id)) {
      throw new Error(`Unit with ID ${unit.id} is already registered.`);
    }
    
    // Check for symbol/alias collisions
    const allSymbols = [unit.symbol, ...unit.aliases];
    for (const sym of allSymbols) {
      if (this.symbolMap.has(sym)) {
        throw new Error(`Symbol or Alias '${sym}' is already registered by unit ${this.symbolMap.get(sym)}.`);
      }
    }

    this.units.set(unit.id, unit);
    for (const sym of allSymbols) {
      this.symbolMap.set(sym, unit.id);
    }
  }

  public static get(idOrSymbol: string): Unit {
    const id = this.symbolMap.get(idOrSymbol) || idOrSymbol;
    const unit = this.units.get(id);
    if (!unit) {
      throw new Error(`Unit '${idOrSymbol}' not found in registry.`);
    }
    return unit;
  }

  public static has(idOrSymbol: string): boolean {
    return this.symbolMap.has(idOrSymbol) || this.units.has(idOrSymbol);
  }

  public static list(): Unit[] {
    return Array.from(this.units.values());
  }

  // Pre-populate with base units
  static {
    // LENGTH
    this.register({ id: 'meter', symbol: 'm', name: 'Meter', dimension: Dimension.LENGTH, scale: 1, offset: 0, system: 'SI', aliases: ['metre'] });
    this.register({ id: 'millimeter', symbol: 'mm', name: 'Millimeter', dimension: Dimension.LENGTH, scale: 0.001, offset: 0, system: 'SI', aliases: [] });
    this.register({ id: 'centimeter', symbol: 'cm', name: 'Centimeter', dimension: Dimension.LENGTH, scale: 0.01, offset: 0, system: 'SI', aliases: [] });
    this.register({ id: 'kilometer', symbol: 'km', name: 'Kilometer', dimension: Dimension.LENGTH, scale: 1000, offset: 0, system: 'SI', aliases: [] });

    // MASS
    this.register({ id: 'kilogram', symbol: 'kg', name: 'Kilogram', dimension: Dimension.MASS, scale: 1, offset: 0, system: 'SI', aliases: [] });
    this.register({ id: 'gram', symbol: 'g', name: 'Gram', dimension: Dimension.MASS, scale: 0.001, offset: 0, system: 'SI', aliases: [] });

    // TIME
    this.register({ id: 'second', symbol: 's', name: 'Second', dimension: Dimension.TIME, scale: 1, offset: 0, system: 'SI', aliases: ['sec'] });
    this.register({ id: 'millisecond', symbol: 'ms', name: 'Millisecond', dimension: Dimension.TIME, scale: 0.001, offset: 0, system: 'SI', aliases: [] });
    this.register({ id: 'minute', symbol: 'min', name: 'Minute', dimension: Dimension.TIME, scale: 60, offset: 0, system: 'SI', aliases: [] });
    this.register({ id: 'hour', symbol: 'h', name: 'Hour', dimension: Dimension.TIME, scale: 3600, offset: 0, system: 'SI', aliases: ['hr'] });

    // TEMPERATURE
    this.register({ id: 'kelvin', symbol: 'K', name: 'Kelvin', dimension: Dimension.TEMPERATURE, scale: 1, offset: 0, system: 'SI', aliases: [] });
    this.register({ id: 'celsius', symbol: '°C', name: 'Celsius', dimension: Dimension.TEMPERATURE, scale: 1, offset: 273.15, system: 'METRIC', aliases: ['C'] });

    // DERIVED
    this.register({ id: 'hertz', symbol: 'Hz', name: 'Hertz', dimension: Dimension.TIME.divide(Dimension.TIME).divide(Dimension.TIME), scale: 1, offset: 0, system: 'SI', aliases: [] }); // T^-1 actually
    // Fix Hertz dimension
    this.units.get('hertz')!.dimension = Dimension.SCALAR.divide(Dimension.TIME);

    this.register({ id: 'newton', symbol: 'N', name: 'Newton', dimension: Dimension.FORCE, scale: 1, offset: 0, system: 'SI', aliases: [] });
    this.register({ id: 'pascal', symbol: 'Pa', name: 'Pascal', dimension: Dimension.PRESSURE, scale: 1, offset: 0, system: 'SI', aliases: [] });
    this.register({ id: 'kilopascal', symbol: 'kPa', name: 'Kilopascal', dimension: Dimension.PRESSURE, scale: 1000, offset: 0, system: 'SI', aliases: [] });
    this.register({ id: 'megapascal', symbol: 'MPa', name: 'Megapascal', dimension: Dimension.PRESSURE, scale: 1e6, offset: 0, system: 'SI', aliases: [] });
    this.register({ id: 'bar', symbol: 'bar', name: 'Bar', dimension: Dimension.PRESSURE, scale: 1e5, offset: 0, system: 'METRIC', aliases: [] });

    this.register({ id: 'joule', symbol: 'J', name: 'Joule', dimension: Dimension.ENERGY, scale: 1, offset: 0, system: 'SI', aliases: [] });
    this.register({ id: 'watt', symbol: 'W', name: 'Watt', dimension: Dimension.POWER, scale: 1, offset: 0, system: 'SI', aliases: [] });
  }
}
