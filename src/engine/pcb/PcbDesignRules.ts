/**
 * SECP Industrial OS — SECP-PCB-PHASE-2-001
 * Comprehensive Design Rules (DRC) & Manufacturing Rules (DFM) Subsystem:
 * Unified authoritative ruleset with stable IDs, scopes, validation, and cryptographic hashing.
 */

import { createHash } from 'crypto';

export type RuleScope = 'GLOBAL' | 'LAYER_SPECIFIC' | 'NET_CLASS' | 'COMPONENT_SPECIFIC';
export type RuleSeverity = 'ERROR' | 'WARNING';
export type RuleCategory = 
  | 'CLEARANCE'
  | 'WIDTH'
  | 'DRILL_ANNULAR'
  | 'BOARD_MARGIN'
  | 'SOLDER_MASK'
  | 'ELECTRICAL';

export interface PcbRuleDefinition<T = number> {
  id: string;
  name: string;
  category: RuleCategory;
  scope: RuleScope;
  target?: string; // e.g. layer name ('TOP_COPPER') or net class ('POWER')
  value: T;
  unit: 'mm' | 'mil' | 'deg' | 'count';
  severity: RuleSeverity;
  description: string;
  isActive: boolean;
}

export interface PcbDesignRuleset {
  rulesetId: string;
  rulesetName: string;
  manufacturerProfile: 'STANDARD_PCB' | 'HIGH_DENSITY_HDI' | 'AEROSPACE_CLASS3' | 'CUSTOM';
  version: string;
  rules: Record<string, PcbRuleDefinition<number>>;
  netClassOverrides?: Record<string, {
    minTraceWidthMm?: number;
    minClearanceMm?: number;
  }>;
  layerOverrides?: Record<string, {
    minTraceWidthMm?: number;
    minClearanceMm?: number;
  }>;
}

export interface RuleValidationResult {
  valid: boolean;
  errors: string[];
  rulesetHash: string;
}

export class PcbDesignRulesManager {
  /**
   * Default IPC Class 2 / Standard Commercial PCB ruleset.
   */
  public static getDefaultStandardRuleset(): PcbDesignRuleset {
    return {
      rulesetId: 'DRC-STD-001',
      rulesetName: 'SECP Standard Commercial Industrial 2-4 Layer Ruleset',
      manufacturerProfile: 'STANDARD_PCB',
      version: '2.0.0',
      rules: {
        'DRC-CLR-001': {
          id: 'DRC-CLR-001',
          name: 'Minimum Copper to Copper Clearance',
          category: 'CLEARANCE',
          scope: 'GLOBAL',
          value: 0.20, // 0.20mm ~ 8mil
          unit: 'mm',
          severity: 'ERROR',
          description: 'Minimum physical air gap between different electrical nets on same copper layer',
          isActive: true
        },
        'DRC-WID-001': {
          id: 'DRC-WID-001',
          name: 'Minimum Trace Width',
          category: 'WIDTH',
          scope: 'GLOBAL',
          value: 0.15, // 0.15mm ~ 6mil
          unit: 'mm',
          severity: 'ERROR',
          description: 'Minimum physical copper conductor width for signal routing',
          isActive: true
        },
        'DRC-DRL-001': {
          id: 'DRC-DRL-001',
          name: 'Minimum Via Drill Diameter',
          category: 'DRILL_ANNULAR',
          scope: 'GLOBAL',
          value: 0.30, // 0.30mm ~ 12mil
          unit: 'mm',
          severity: 'ERROR',
          description: 'Minimum mechanically drillable via hole diameter',
          isActive: true
        },
        'DRC-ANN-001': {
          id: 'DRC-ANN-001',
          name: 'Minimum Annular Ring Width',
          category: 'DRILL_ANNULAR',
          scope: 'GLOBAL',
          value: 0.125, // 0.125mm ~ 5mil: (padDia - drillDia)/2
          unit: 'mm',
          severity: 'ERROR',
          description: 'Minimum copper annular ring enclosing plated through hole or via',
          isActive: true
        },
        'DRC-EDG-001': {
          id: 'DRC-EDG-001',
          name: 'Minimum Copper to Board Edge Margin',
          category: 'BOARD_MARGIN',
          scope: 'GLOBAL',
          value: 0.50, // 0.50mm ~ 20mil
          unit: 'mm',
          severity: 'ERROR',
          description: 'Minimum clearance between copper conductors and routed board outline',
          isActive: true
        },
        'DRC-EDG-002': {
          id: 'DRC-EDG-002',
          name: 'Minimum Component Placement to Board Edge Margin',
          category: 'BOARD_MARGIN',
          scope: 'GLOBAL',
          value: 1.00, // 1.0mm
          unit: 'mm',
          severity: 'ERROR',
          description: 'Minimum clearance from component body/pads to board edge',
          isActive: true
        },
        'DRC-HL-001': {
          id: 'DRC-HL-001',
          name: 'Minimum Copper to Unplated Hole Clearance',
          category: 'CLEARANCE',
          scope: 'GLOBAL',
          value: 0.35, // 0.35mm
          unit: 'mm',
          severity: 'ERROR',
          description: 'Clearance from copper traces/vias to mechanical mounting holes',
          isActive: true
        },
        'DRC-MSK-001': {
          id: 'DRC-MSK-001',
          name: 'Minimum Solder Mask Sliver / Dam',
          category: 'SOLDER_MASK',
          scope: 'GLOBAL',
          value: 0.10, // 0.10mm ~ 4mil
          unit: 'mm',
          severity: 'WARNING',
          description: 'Minimum solder mask web between adjacent copper pads to prevent solder bridging',
          isActive: true
        },
        'DRC-MSK-002': {
          id: 'DRC-MSK-002',
          name: 'Solder Mask Expansion Clearance',
          category: 'SOLDER_MASK',
          scope: 'GLOBAL',
          value: 0.05, // 0.05mm ~ 2mil
          unit: 'mm',
          severity: 'WARNING',
          description: 'Nominal solder mask expansion per edge over copper pad',
          isActive: true
        }
      },
      netClassOverrides: {
        'POWER': {
          minTraceWidthMm: 0.40,
          minClearanceMm: 0.25
        },
        'HIGH_VOLTAGE': {
          minTraceWidthMm: 0.50,
          minClearanceMm: 0.80
        }
      }
    };
  }

  /**
   * Validates integrity and consistency of a design ruleset.
   * Ensures non-negative, finite dimensions, valid categories, and unique keys.
   */
  public static validateRuleset(ruleset: PcbDesignRuleset): RuleValidationResult {
    const errors: string[] = [];

    if (!ruleset.rulesetId || typeof ruleset.rulesetId !== 'string') {
      errors.push('Ruleset must define a non-empty rulesetId');
    }
    if (!ruleset.version) {
      errors.push('Ruleset must specify a version');
    }

    const mandatoryRules = ['DRC-CLR-001', 'DRC-WID-001', 'DRC-DRL-001', 'DRC-ANN-001', 'DRC-EDG-001'];
    for (const ruleKey of mandatoryRules) {
      const r = ruleset.rules[ruleKey];
      if (!r) {
        errors.push(`Mandatory rule '${ruleKey}' is missing from ruleset`);
        continue;
      }
      if (!Number.isFinite(r.value) || r.value <= 0) {
        errors.push(`Mandatory rule '${ruleKey}' value must be positive finite number (got: ${r.value})`);
      }
      if (r.unit !== 'mm') {
        errors.push(`Mandatory rule '${ruleKey}' must be defined in 'mm' (got: ${r.unit})`);
      }
    }

    // Check all rules for non-negativity and non-NaN
    for (const [key, rule] of Object.entries(ruleset.rules)) {
      if (!Number.isFinite(rule.value) || rule.value < 0) {
        errors.push(`Rule '${key}' has invalid value: ${rule.value}`);
      }
      if (!rule.id || rule.id !== key) {
        errors.push(`Rule key '${key}' does not match rule.id '${rule?.id}'`);
      }
    }

    const rulesetHash = this.computeRulesetHash(ruleset);
    return {
      valid: errors.length === 0,
      errors,
      rulesetHash
    };
  }

  /**
   * Computes deterministic SHA-256 hash digest of a ruleset.
   */
  public static computeRulesetHash(ruleset: PcbDesignRuleset): string {
    const sortedRuleKeys = Object.keys(ruleset.rules).sort();
    const normalizedPayload = {
      rulesetId: ruleset.rulesetId,
      rulesetName: ruleset.rulesetName,
      profile: ruleset.manufacturerProfile,
      version: ruleset.version,
      rules: sortedRuleKeys.map(k => {
        const r = ruleset.rules[k];
        return {
          id: r.id,
          category: r.category,
          scope: r.scope,
          value: Number(r.value.toFixed(4)),
          unit: r.unit,
          severity: r.severity,
          isActive: r.isActive
        };
      }),
      netClassOverrides: Object.keys(ruleset.netClassOverrides || {}).sort().map(nk => ({
        netClass: nk,
        minTraceWidthMm: ruleset.netClassOverrides?.[nk]?.minTraceWidthMm ?? null,
        minClearanceMm: ruleset.netClassOverrides?.[nk]?.minClearanceMm ?? null
      }))
    };

    const json = JSON.stringify(normalizedPayload);
    return createHash('sha256').update(json, 'utf8').digest('hex');
  }

  /**
   * Resolves effective clearance rule for a net on a given layer.
   */
  public static getEffectiveClearance(
    ruleset: PcbDesignRuleset,
    netClass?: string,
    layer?: string
  ): number {
    if (netClass && ruleset.netClassOverrides?.[netClass]?.minClearanceMm) {
      return ruleset.netClassOverrides[netClass].minClearanceMm!;
    }
    if (layer && ruleset.layerOverrides?.[layer]?.minClearanceMm) {
      return ruleset.layerOverrides[layer].minClearanceMm!;
    }
    return ruleset.rules['DRC-CLR-001']?.value ?? 0.20;
  }

  /**
   * Resolves effective trace width rule for a net on a given layer.
   */
  public static getEffectiveTraceWidth(
    ruleset: PcbDesignRuleset,
    netClass?: string,
    layer?: string
  ): number {
    if (netClass && ruleset.netClassOverrides?.[netClass]?.minTraceWidthMm) {
      return ruleset.netClassOverrides[netClass].minTraceWidthMm!;
    }
    if (layer && ruleset.layerOverrides?.[layer]?.minTraceWidthMm) {
      return ruleset.layerOverrides[layer].minTraceWidthMm!;
    }
    return ruleset.rules['DRC-WID-001']?.value ?? 0.15;
  }
}
