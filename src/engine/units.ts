/**
 * PATCH-SECP-002 — Unit & Measurement Engine
 * Canonical SI Base Units inside kernel:
 * - Length: meters (m)
 * - Mass: kilograms (kg)
 * - Force: Newtons (N)
 * - Pressure: Pascals (Pa)
 * - Power: Watts (W)
 * - Angular Velocity: Radians per second (rad/s)
 */

export type UnitCategory = 'LENGTH' | 'MASS' | 'FORCE' | 'PRESSURE' | 'POWER' | 'ANGULAR_VELOCITY';

export interface UnitDefinition {
  symbol: string;
  name: string;
  category: UnitCategory;
  toCanonicalFactor: number; // Multiply by this to get SI canonical value
}

export const UNIT_DEFINITIONS: Record<string, UnitDefinition> = {
  // LENGTH (Canonical = m)
  m: { symbol: 'm', name: 'Meters', category: 'LENGTH', toCanonicalFactor: 1.0 },
  cm: { symbol: 'cm', name: 'Centimeters', category: 'LENGTH', toCanonicalFactor: 0.01 },
  mm: { symbol: 'mm', name: 'Millimeters', category: 'LENGTH', toCanonicalFactor: 0.001 },
  inch: { symbol: 'inch', name: 'Inches', category: 'LENGTH', toCanonicalFactor: 0.0254 },

  // MASS (Canonical = kg)
  kg: { symbol: 'kg', name: 'Kilograms', category: 'MASS', toCanonicalFactor: 1.0 },
  g: { symbol: 'g', name: 'Grams', category: 'MASS', toCanonicalFactor: 0.001 },

  // FORCE (Canonical = N)
  N: { symbol: 'N', name: 'Newtons', category: 'FORCE', toCanonicalFactor: 1.0 },
  kN: { symbol: 'kN', name: 'Kilonewtons', category: 'FORCE', toCanonicalFactor: 1000.0 },

  // PRESSURE (Canonical = Pa)
  Pa: { symbol: 'Pa', name: 'Pascals', category: 'PRESSURE', toCanonicalFactor: 1.0 },
  bar: { symbol: 'bar', name: 'Bars', category: 'PRESSURE', toCanonicalFactor: 100000.0 },
  MPa: { symbol: 'MPa', name: 'Megapascals', category: 'PRESSURE', toCanonicalFactor: 1000000.0 },

  // POWER (Canonical = W)
  W: { symbol: 'W', name: 'Watts', category: 'POWER', toCanonicalFactor: 1.0 },
  kW: { symbol: 'kW', name: 'Kilowatts', category: 'POWER', toCanonicalFactor: 1000.0 },

  // ANGULAR VELOCITY (Canonical = rad/s)
  'rad/s': { symbol: 'rad/s', name: 'Radians / Second', category: 'ANGULAR_VELOCITY', toCanonicalFactor: 1.0 },
  Hz: { symbol: 'Hz', name: 'Hertz (Cycles/sec)', category: 'ANGULAR_VELOCITY', toCanonicalFactor: 2 * Math.PI },
  rpm: { symbol: 'rpm', name: 'Revolutions / Min', category: 'ANGULAR_VELOCITY', toCanonicalFactor: (2 * Math.PI) / 60.0 },
};

export class UnitEngine {
  /**
   * Convert value from source unit to target unit.
   */
  public static convert(value: number, fromUnitSymbol: string, toUnitSymbol: string): number {
    const fromDef = UNIT_DEFINITIONS[fromUnitSymbol];
    const toDef = UNIT_DEFINITIONS[toUnitSymbol];

    if (!fromDef || !toDef) {
      throw new Error(`Invalid unit symbol: '${fromUnitSymbol}' or '${toUnitSymbol}'`);
    }

    if (fromDef.category !== toDef.category) {
      throw new Error(`Incompatible unit categories: ${fromDef.category} vs ${toDef.category}`);
    }

    // Step 1: Convert to SI Canonical value
    const canonicalValue = value * fromDef.toCanonicalFactor;

    // Step 2: Convert from SI Canonical value to target unit
    const targetValue = canonicalValue / toDef.toCanonicalFactor;

    return targetValue;
  }

  /**
   * Convert value to canonical SI base unit.
   */
  public static toCanonical(value: number, unitSymbol: string): { value: number; canonicalUnit: string } {
    const def = UNIT_DEFINITIONS[unitSymbol];
    if (!def) throw new Error(`Unknown unit: ${unitSymbol}`);

    const canonicalUnit =
      def.category === 'LENGTH'
        ? 'm'
        : def.category === 'MASS'
        ? 'kg'
        : def.category === 'FORCE'
        ? 'N'
        : def.category === 'PRESSURE'
        ? 'Pa'
        : def.category === 'POWER'
        ? 'W'
        : 'rad/s';

    return {
      value: value * def.toCanonicalFactor,
      canonicalUnit,
    };
  }

  /**
   * Verify all required acceptance test conversions for PATCH-SECP-002
   */
  public static runUnitEngineTests(): Array<{
    testName: string;
    from: string;
    to: string;
    inputVal: number;
    expectedVal: number;
    actualVal: number;
    passed: boolean;
  }> {
    const testCases = [
      { name: 'mm → m', from: 'mm', to: 'm', val: 1000, expected: 1.0 },
      { name: 'inch → mm', from: 'inch', to: 'mm', val: 1, expected: 25.4 },
      { name: 'bar → Pa', from: 'bar', to: 'Pa', val: 1, expected: 100000.0 },
      { name: 'kN → N', from: 'kN', to: 'N', val: 1, expected: 1000.0 },
      { name: 'rpm → rad/s', from: 'rpm', to: 'rad/s', val: 60, expected: 2 * Math.PI },
    ];

    return testCases.map(tc => {
      const actual = UnitEngine.convert(tc.val, tc.from, tc.to);
      const passed = Math.abs(actual - tc.expected) < 0.0001;
      return {
        testName: tc.name,
        from: tc.from,
        to: tc.to,
        inputVal: tc.val,
        expectedVal: tc.expected,
        actualVal: actual,
        passed,
      };
    });
  }
}
