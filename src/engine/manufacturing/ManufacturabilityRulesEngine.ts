import { 
  ManufacturabilityRule, 
  ManufacturabilityViolation, 
  RecognizedManufacturingFeature, 
  ManufacturingFeatureType, 
  ProcessType, 
  RuleSeverity 
} from './ManufacturingTypes';

/**
 * PATCH-SECP-049-C — Manufacturability Rules Engine
 * Evaluates manufacturing features against industrial process rules
 * (Corner radii, Hole aspect ratios, Tool reach, Thin walls, Undercuts).
 */
export class ManufacturabilityRulesEngine {
  private rules: Map<string, ManufacturabilityRule> = new Map();

  constructor() {
    this.registerBuiltInRules();
  }

  public registerRule(rule: ManufacturabilityRule): void {
    this.rules.set(rule.ruleId, rule);
  }

  public getRule(ruleId: string): ManufacturabilityRule | undefined {
    return this.rules.get(ruleId);
  }

  public evaluateFeatures(
    features: RecognizedManufacturingFeature[],
    targetProcess: ProcessType = ProcessType.MILLING_3AXIS
  ): ManufacturabilityViolation[] {
    const violations: ManufacturabilityViolation[] = [];

    for (const feat of features) {
      for (const rule of this.rules.values()) {
        const isProcessMatch = rule.processType === targetProcess || 
          (targetProcess === ProcessType.MILLING_3AXIS && rule.processType === ProcessType.DRILLING) ||
          (targetProcess === ProcessType.MILLING_5AXIS && rule.processType === ProcessType.DRILLING);

        if (isProcessMatch) {
          const v = rule.evaluator(feat);
          if (v) {
            violations.push(v);
          }
        }
      }
    }

    return violations;
  }

  private registerBuiltInRules(): void {
    // Rule 1: Sharp Internal Corner in Pockets (Milling Cutter Access)
    this.registerRule({
      ruleId: 'R1_SHARP_INTERNAL_CORNER',
      name: 'Sharp Internal Pocket Corner',
      processType: ProcessType.MILLING_3AXIS,
      description: 'Internal pocket corners must have a non-zero radius for rotating milling cutters.',
      severity: RuleSeverity.CRITICAL,
      evaluator: (feat) => {
        if (feat.type === ManufacturingFeatureType.POCKET) {
          if (feat.geometricParams.hasSharpInternalCorner || (feat.geometricParams.cornerRadius !== undefined && feat.geometricParams.cornerRadius <= 0.001)) {
            return {
              ruleId: 'R1_SHARP_INTERNAL_CORNER',
              ruleName: 'Sharp Internal Pocket Corner',
              mfgFeatureId: feat.mfgFeatureId,
              processType: ProcessType.MILLING_3AXIS,
              severity: RuleSeverity.CRITICAL,
              description: `Pocket ${feat.mfgFeatureId} contains a sharp 90-degree internal corner impossible to mill with a rotating end mill.`,
              measuredValue: 0,
              requiredValue: 1.5,
              remediationSuggestion: 'Add an internal fillet radius R >= 1.5mm or specify sinker EDM.'
            };
          }
        }
        return null;
      }
    });

    // Rule 2: Deep Hole Aspect Ratio (L/D <= 10)
    this.registerRule({
      ruleId: 'R2_MAX_HOLE_ASPECT_RATIO',
      name: 'Deep Hole Aspect Ratio Limit',
      processType: ProcessType.DRILLING,
      description: 'Hole depth-to-diameter ratio L/D must not exceed 10 to avoid drill wandering or breakage.',
      severity: RuleSeverity.CRITICAL,
      evaluator: (feat) => {
        if (feat.type === ManufacturingFeatureType.HOLE) {
          const ratio = feat.geometricParams.aspectRatio || 0;
          if (ratio > 10.0) {
            return {
              ruleId: 'R2_MAX_HOLE_ASPECT_RATIO',
              ruleName: 'Deep Hole Aspect Ratio Limit',
              mfgFeatureId: feat.mfgFeatureId,
              processType: ProcessType.DRILLING,
              severity: RuleSeverity.CRITICAL,
              description: `Hole ${feat.mfgFeatureId} has an excessive aspect ratio L/D = ${ratio.toFixed(1)} (> 10.0 max limit).`,
              measuredValue: ratio,
              requiredValue: 10.0,
              remediationSuggestion: 'Increase hole diameter or reduce depth to achieve L/D <= 10, or specify gun-drilling.'
            };
          }
        }
        return null;
      }
    });

    // Rule 3: Minimum Machinable Wall Thickness
    this.registerRule({
      ruleId: 'R3_MIN_WALL_THICKNESS',
      name: 'Minimum Machinable Wall Thickness',
      processType: ProcessType.MILLING_3AXIS,
      description: 'Walls thinner than 1.5mm suffer severe vibration and deflection during machining.',
      severity: RuleSeverity.WARNING,
      evaluator: (feat) => {
        if (feat.type === ManufacturingFeatureType.THIN_WALL || feat.geometricParams.wallThickness !== undefined) {
          const t = feat.geometricParams.wallThickness || 10;
          if (t < 1.5) {
            return {
              ruleId: 'R3_MIN_WALL_THICKNESS',
              ruleName: 'Minimum Machinable Wall Thickness',
              mfgFeatureId: feat.mfgFeatureId,
              processType: ProcessType.MILLING_3AXIS,
              severity: RuleSeverity.WARNING,
              description: `Wall thickness ${t.toFixed(2)}mm on feature ${feat.mfgFeatureId} is below minimum recommended 1.50mm limit.`,
              measuredValue: t,
              requiredValue: 1.5,
              remediationSuggestion: 'Increase wall thickness to >= 1.5mm or switch to additive manufacturing.'
            };
          }
        }
        return null;
      }
    });

    // Rule 4: Undercut Accessibility in 3-Axis Milling
    this.registerRule({
      ruleId: 'R4_UNDERCUT_ACCESSIBILITY',
      name: 'Undercut Accessibility Limit',
      processType: ProcessType.MILLING_3AXIS,
      description: '3-axis milling cannot reach undercut features without 5-axis or special tool indexing.',
      severity: RuleSeverity.CRITICAL,
      evaluator: (feat) => {
        if (feat.type === ManufacturingFeatureType.UNDERCUT) {
          return {
            ruleId: 'R4_UNDERCUT_ACCESSIBILITY',
            ruleName: 'Undercut Accessibility Limit',
            mfgFeatureId: feat.mfgFeatureId,
            processType: ProcessType.MILLING_3AXIS,
            severity: RuleSeverity.CRITICAL,
            description: `Feature ${feat.mfgFeatureId} contains an undercut inaccessible from standard 3-axis milling setups.`,
            measuredValue: 1,
            requiredValue: 0,
            remediationSuggestion: 'Use 5-axis milling or redesign geometry to eliminate undercut.'
          };
        }
        return null;
      }
    });

    // Rule 5: Tool Obstructed Approach
    this.registerRule({
      ruleId: 'R5_TOOL_OBSTRUCTED_APPROACH',
      name: 'Tool Approach Obstruction',
      processType: ProcessType.MILLING_3AXIS,
      description: 'Tool approach vector is obstructed by overhanging CAD geometry.',
      severity: RuleSeverity.CRITICAL,
      evaluator: (feat) => {
        if (feat.geometricParams.isObstructed) {
          return {
            ruleId: 'R5_TOOL_OBSTRUCTED_APPROACH',
            ruleName: 'Tool Approach Obstruction',
            mfgFeatureId: feat.mfgFeatureId,
            processType: ProcessType.MILLING_3AXIS,
            severity: RuleSeverity.CRITICAL,
            description: `Feature ${feat.mfgFeatureId} tool approach vector is obstructed by overhanging CAD geometry.`,
            measuredValue: 1,
            requiredValue: 0,
            remediationSuggestion: 'Modify surrounding geometry to provide clear straight tool clearance.'
          };
        }
        return null;
      }
    });
  }
}
