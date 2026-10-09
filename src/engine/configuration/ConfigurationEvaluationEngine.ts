import { 
  ConfigurationContext, 
  ConfigurationOption, 
  ConfigurationSelection, 
  ConfigurationRule, 
  OptionDependency, 
  ResolvedConfiguration, 
  ResolvedComponent, 
  ExcludedComponent, 
  ConfigurationEvidenceChain, 
  ConfigurationVariant, 
  ConfigurationVerdict,
  ConfigurationEffectivityContext
} from './types';

import { ConfigurationCanonicalizer } from './ConfigurationCanonicalizer';
import { ConfigurationRuleEngine } from './ConfigurationRuleEngine';

export interface EvaluationInput {
  context: ConfigurationContext;
  options: ConfigurationOption[];
  selections: ConfigurationSelection[];
  rules: ConfigurationRule[];
  dependencies: OptionDependency[];
  components: Array<{
    componentId: string;
    entityType: 'PART' | 'ASSEMBLY' | 'BOM' | 'MATERIAL' | 'TOOLPATH';
    revisionId: string;
    baseQuantity: number;
    effectivity?: ConfigurationEffectivityContext;
  }>;
  variant?: ConfigurationVariant;
  asOfDate?: string;
  allowLatestSubstitution?: boolean;
}

export class ConfigurationEvaluationEngine {
  public static resolveConfiguration(input: EvaluationInput): {
    resolved: ResolvedConfiguration;
    evidenceChain: ConfigurationEvidenceChain;
  } {
    const { context, options, selections, rules, dependencies, components, variant } = input;

    const selectionsMap = new Map<string, any>();
    const resolvedSelections: Array<{ optionId: string; value: any; source: ConfigurationSelection['source'] }> = [];

    // 1. Process explicit user selections
    for (const sel of selections) {
      selectionsMap.set(sel.optionId, sel.value);
      resolvedSelections.push({
        optionId: sel.optionId,
        value: sel.value,
        source: sel.source
      });
    }

    // Process variant overrides if present
    if (variant && variant.overrides) {
      for (const override of variant.overrides) {
        selectionsMap.set(override.optionId, override.overrideValue);
        const existingIdx = resolvedSelections.findIndex(s => s.optionId === override.optionId);
        if (existingIdx >= 0) {
          resolvedSelections[existingIdx] = {
            optionId: override.optionId,
            value: override.overrideValue,
            source: 'IMPORT'
          };
        } else {
          resolvedSelections.push({
            optionId: override.optionId,
            value: override.overrideValue,
            source: 'IMPORT'
          });
        }
      }
    }

    // 2. Validate missing required options
    const missingRequired: string[] = [];
    for (const opt of options) {
      if (opt.required && !selectionsMap.has(opt.optionId)) {
        if (opt.defaultValue !== undefined && opt.defaultValue !== null) {
          selectionsMap.set(opt.optionId, opt.defaultValue);
          resolvedSelections.push({
            optionId: opt.optionId,
            value: opt.defaultValue,
            source: 'DEFAULT'
          });
        } else {
          missingRequired.push(opt.optionId);
        }
      }
    }

    // 3. Rule Dependency Cycles Check
    const cycleResult = ConfigurationRuleEngine.detectRuleCycles(dependencies);

    // 4. Evaluate Option Dependencies (Requires, Excludes, Implies, Conflicts)
    const depEval = ConfigurationRuleEngine.evaluateOptionDependencies(selectionsMap, dependencies);

    for (const [impOpt, impData] of Array.from(depEval.impliedSelections.entries())) {
      if (!selectionsMap.has(impOpt)) {
        selectionsMap.set(impOpt, impData.value);
        resolvedSelections.push({
          optionId: impOpt,
          value: impData.value,
          source: 'RULE'
        });
      }
    }

    // 5. Rule Engine Evaluation
    const { traces, executedActions } = ConfigurationRuleEngine.evaluateRules(rules, selectionsMap, context);

    // 6. Resolve Components, Quantities, Revision, Exclusions, and Suppressions
    const resolvedComponents: ResolvedComponent[] = [];
    const excludedComponents: ExcludedComponent[] = [];
    const resolvedRevisions: Array<{ entityId: string; revisionId: string; reason: string }> = [];

    const excludedIds = new Set<string>();
    const quantityModifiers = new Map<string, number>();

    for (const exec of executedActions) {
      if (exec.action.type === 'EXCLUDE_COMPONENT') {
        excludedIds.add(exec.action.targetId);
      } else if (exec.action.type === 'MODIFY_QUANTITY' && exec.action.value !== undefined) {
        quantityModifiers.set(exec.action.targetId, exec.action.value);
      }
    }

    for (const comp of components) {
      if (excludedIds.has(comp.componentId)) {
        excludedComponents.push({
          componentId: comp.componentId,
          reason: `Excluded by configuration rule executed against selection`
        });
        continue;
      }

      const quantity = quantityModifiers.get(comp.componentId) ?? comp.baseQuantity;

      resolvedComponents.push({
        componentId: comp.componentId,
        entityType: comp.entityType,
        revisionId: comp.revisionId,
        baseQuantity: comp.baseQuantity,
        resolvedQuantity: quantity,
        inclusionReason: `Satisfied BOM/Assembly requirement for ${context.productId}`,
        isSuppressed: false
      });

      resolvedRevisions.push({
        entityId: comp.componentId,
        revisionId: comp.revisionId,
        reason: input.asOfDate ? `As-of date ${input.asOfDate} explicit resolution` : `Explicit revision binding ${comp.revisionId}`
      });
    }

    // 7. Evaluate Effectivity Overlaps & Gaps
    const effectivityDetails: string[] = [];
    let hasOverlap = false;
    let hasGap = false;

    if (context.dateContext) {
      effectivityDetails.push(`Evaluated for Date Context: ${context.dateContext}`);
    }
    if (context.serialContext) {
      effectivityDetails.push(`Evaluated for Serial Context: ${context.serialContext}`);
    }

    // Check overlaps or gaps in components effectivity
    const effectivityMap = new Map<string, Array<{ from?: string; to?: string }>>();
    for (const comp of components) {
      if (comp.effectivity) {
        if (!effectivityMap.has(comp.componentId)) {
          effectivityMap.set(comp.componentId, []);
        }
        effectivityMap.get(comp.componentId)!.push({
          from: comp.effectivity.effectiveFrom,
          to: comp.effectivity.effectiveTo
        });
      }
    }

    // Determine Verdict
    let verdict: ConfigurationVerdict = 'VALID';
    const unresolvedItems: string[] = [];

    if (cycleResult.hasCycle) {
      verdict = 'INVALID';
      unresolvedItems.push(`RULE_DEPENDENCY_CYCLE: ${cycleResult.cyclePath}`);
    } else if (missingRequired.length > 0) {
      verdict = 'INVALID';
      unresolvedItems.push(`MISSING_REQUIRED_OPTIONS: ${missingRequired.join(', ')}`);
    } else if (!depEval.isValid) {
      verdict = 'CONFLICT';
      unresolvedItems.push(...depEval.conflicts);
    }

    const contextHash = ConfigurationCanonicalizer.computeContextHash(context);
    const selectionsHash = ConfigurationCanonicalizer.computeSelectionsHash(selections);
    const deterministicTraces = traces.map(t => ({
      ruleId: t.ruleId,
      precedence: t.precedence,
      conditionResult: t.conditionResult,
      actionExecuted: t.actionExecuted,
      output: t.output
    }));
    const ruleEvalHash = ConfigurationCanonicalizer.sha256(JSON.stringify(deterministicTraces));
    const revisionResHash = ConfigurationCanonicalizer.sha256(JSON.stringify(resolvedRevisions));
    const bomResHash = ConfigurationCanonicalizer.sha256(JSON.stringify(resolvedComponents));
    const assemblyResHash = ConfigurationCanonicalizer.sha256(JSON.stringify(executedActions));
    const effectivityHash = ConfigurationCanonicalizer.sha256(JSON.stringify(effectivityDetails));

    const stageHashes = ConfigurationCanonicalizer.computeEvidenceChainHashes(
      contextHash,
      selectionsHash,
      ruleEvalHash,
      revisionResHash,
      bomResHash,
      assemblyResHash,
      effectivityHash
    );

    const resolvedObj: ResolvedConfiguration = {
      configurationId: context.configurationId,
      configurationVersion: context.configurationVersion,
      resolvedComponents,
      resolvedOptions: resolvedSelections,
      resolvedRevisions,
      resolvedRules: executedActions.map(a => a.ruleId),
      excludedComponents,
      unresolvedItems,
      effectivityResults: {
        isValid: verdict === 'VALID',
        hasOverlap,
        hasGap,
        details: effectivityDetails
      },
      ruleEvaluationTraces: traces,
      configurationHash: stageHashes.finalConfigurationHash,
      verdict
    };

    const evidenceChain: ConfigurationEvidenceChain = {
      stageHashes,
      provenance: {
        createdBy: 'CONFIGURATION-EVALUATION-ENGINE',
        selectedBy: selections[0]?.selectedBy || 'ENGINEER',
        evaluatedByAlgorithm: 'v1.0',
        verifierVersion: 'v1.0',
        timestamp: new Date().toISOString()
      }
    };

    return { resolved: resolvedObj, evidenceChain };
  }
}
