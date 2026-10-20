/**
 * SECP Wiring Harness Design Rules & Safety Constraints (Phase 3)
 * Configurable ruleset governing bend radius, spacing, clearances,
 * temperature limits, gauge compatibility, and mechanical protection.
 */

export interface WiringHarnessRuleset {
  rulesetId: string;
  version: string;
  units: 'metric';
  minBendRadiusMultiplier: number; // e.g. 5x cable diameter
  minChassisClearanceMm: number;
  maxUnclampedSpanMm: number;
  maxCurrentAmpsByAwg: Record<string, number>;
  maxTemperatureCelsius: number;
}

export class WiringHarnessDesignRulesManager {
  public static getDefaultRuleset(): WiringHarnessRuleset {
    return {
      rulesetId: 'WH_RULES_DEFAULT_001',
      version: '1.0.0',
      units: 'metric',
      minBendRadiusMultiplier: 4.0,
      minChassisClearanceMm: 15.0,
      maxUnclampedSpanMm: 300.0,
      maxCurrentAmpsByAwg: {
        'AWG 18': 10.0,
        'AWG 20': 7.5,
        'AWG 22': 5.0,
        'AWG 24': 3.5
      },
      maxTemperatureCelsius: 105.0
    };
  }
}
