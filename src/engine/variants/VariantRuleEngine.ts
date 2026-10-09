import { VariantRule, VariationDimension } from './types';
import { ConfigurationContext, ConfigurationOption } from '../configuration/types';

export class VariantRuleEngine {
  private static precedenceOrder: Record<string, number> = {
    SAFETY: 1,
    REGULATORY: 2,
    ENGINEERING: 3,
    MANUFACTURING: 4,
    COMMERCIAL: 5,
    DEFAULT: 6
  };

  public static sortRules(rules: VariantRule[]): VariantRule[] {
    return [...rules].sort((a, b) => {
      // For variant rules, we might use a slightly different precedence mapping or just use priority
      if (a.priority !== b.priority) return a.priority - b.priority;
      return a.ruleId.localeCompare(b.ruleId);
    });
  }

  public static evaluateRules(
    rules: VariantRule[],
    context: ConfigurationContext,
    options: ConfigurationOption[]
  ): { executedActions: VariantRule['action'][]; evaluatedRuleIds: string[]; conflicts: string[] } {
    const sortedRules = this.sortRules(rules);
    const executedActions: VariantRule['action'][] = [];
    const evaluatedRuleIds: string[] = [];
    const conflicts: string[] = [];

    // Track state to detect immediate conflicts during evaluation
    const selectionState = new Map<string, any>();

    for (const rule of sortedRules) {
      if (rule.status !== 'ACTIVE') continue;

      let conditionMet = false;
      try {
        conditionMet = rule.condition(context, options);
      } catch (e) {
        conditionMet = false;
      }

      if (conditionMet) {
        evaluatedRuleIds.push(rule.ruleId);
        
        // Basic conflict detection for SELECT_OPTION
        if (rule.action.type === 'SELECT_OPTION') {
          const existing = selectionState.get(rule.action.targetId);
          if (existing !== undefined && existing !== rule.action.value) {
            conflicts.push(`VARIANT_RULE_CONFLICT: Rule ${rule.ruleId} tries to set ${rule.action.targetId}=${rule.action.value} but it was already set to ${existing}`);
          }
          selectionState.set(rule.action.targetId, rule.action.value);
        }

        executedActions.push(rule.action);
      }
    }

    return { executedActions, evaluatedRuleIds, conflicts };
  }
}
