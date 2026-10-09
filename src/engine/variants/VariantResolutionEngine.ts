import { 
  Variant, 
  VariantDefinition, 
  ResolvedVariant, 
  VariantVerdict, 
  VariantEvidenceChain 
} from './types';
import { VariantInheritanceResolver } from './VariantInheritanceResolver';
import { VariantRuleEngine } from './VariantRuleEngine';
import { 
  ConfigurationContext, 
  ConfigurationOption, 
  ConfigurationSelection, 
  ConfigurationRule, 
  OptionDependency,
  ResolvedConfiguration
} from '../configuration/types';
import { ConfigurationEvaluationEngine, EvaluationInput } from '../configuration/ConfigurationEvaluationEngine';
import * as crypto from 'crypto';

export interface VariantResolutionInput {
  variantId: string;
  allVariants: Map<string, Variant>;
  definitions: Map<string, VariantDefinition>;
  context: ConfigurationContext;
  configOptions: ConfigurationOption[];
  configRules: ConfigurationRule[];
  configDependencies: OptionDependency[];
  components: any[]; // Simplified for this context
}

export class VariantResolutionEngine {
  public static resolveVariant(input: VariantResolutionInput): {
    resolved: ResolvedVariant;
    evidence: VariantEvidenceChain;
  } {
    const { variantId, allVariants, definitions, context, configOptions, configRules, configDependencies, components } = input;

    // 1. Resolve Inheritance
    const inheritancePath = VariantInheritanceResolver.resolvePath(variantId, allVariants);
    const mergedDef = VariantInheritanceResolver.mergeDefinitions(inheritancePath, definitions);

    // 2. Evaluate Variant Rules
    const { executedActions, evaluatedRuleIds, conflicts } = VariantRuleEngine.evaluateRules(mergedDef.variantRules, context, configOptions);

    // 3. Map Variant Selections/Actions to Configuration Selections
    const selections: ConfigurationSelection[] = [];
    const selectionMap = new Map<string, any>();

    // Apply Overrides from Merged Definition
    for (const override of mergedDef.overrides) {
      selectionMap.set(override.targetId, override.value);
      selections.push({
        selectionId: `OVERRIDE-${override.targetId}`,
        configurationId: context.configurationId,
        optionId: override.targetId,
        value: override.value,
        source: 'RULE', // Treated as rule-based since it comes from definition logic
        selectedAt: new Date().toISOString(),
        selectedBy: 'VARIANT-ENGINE'
      });
    }

    // Apply Actions from Variant Rules
    for (const action of executedActions) {
      if (action.type === 'SELECT_OPTION') {
        selectionMap.set(action.targetId, action.value);
        selections.push({
          selectionId: `ACTION-${action.targetId}`,
          configurationId: context.configurationId,
          optionId: action.targetId,
          value: action.value,
          source: 'RULE',
          selectedAt: new Date().toISOString(),
          selectedBy: 'VARIANT-ENGINE'
        });
      }
    }

    // 4. Invoke Configuration Resolution Engine (PATCH-118)
    const configEvalInput: EvaluationInput = {
      context,
      options: configOptions,
      selections,
      rules: configRules,
      dependencies: configDependencies,
      components: components.map(c => ({
        ...c,
        entityType: c.entityType || 'PART' // Default for testing
      }))
    };

    const { resolved: resolvedConfig } = ConfigurationEvaluationEngine.resolveConfiguration(configEvalInput);

    // 5. Final Verdict & Hash
    let verdict: VariantVerdict = 'VALID';
    if (conflicts.length > 0 || resolvedConfig.verdict === 'INVALID') {
      verdict = 'INVALID';
    }

    const variantHash = this.computeHash({
      variantId,
      inheritancePath,
      evaluatedRuleIds,
      configHash: resolvedConfig.configurationHash
    });

    const resolved: ResolvedVariant = {
      variantId,
      variantVersion: allVariants.get(variantId)?.variantVersion || '1.0',
      resolvedConfiguration: resolvedConfig,
      evidence: {
        inheritancePath,
        evaluatedRules: evaluatedRuleIds,
        conflicts
      },
      variantHash,
      verdict
    };

    const evidenceChain: VariantEvidenceChain = {
      variantId,
      stages: {
        definitionHash: this.sha256(JSON.stringify(mergedDef)),
        inheritanceHash: this.sha256(JSON.stringify(inheritancePath)),
        optionResolutionHash: this.sha256(JSON.stringify(selections)),
        ruleEvalHash: this.sha256(JSON.stringify(evaluatedRuleIds)),
        configResolutionHash: resolvedConfig.configurationHash,
        finalVariantHash: variantHash
      },
      provenance: {
        createdBy: 'VARIANT-RESOLUTION-ENGINE',
        timestamp: new Date().toISOString()
      }
    };

    return { resolved, evidence: evidenceChain };
  }

  private static sha256(data: string): string {
    return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
  }

  private static computeHash(data: any): string {
    return this.sha256(JSON.stringify(data));
  }
}
