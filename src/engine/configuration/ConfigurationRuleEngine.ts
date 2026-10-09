import { 
  ConfigurationRule, 
  ConfigurationContext, 
  ConfigurationOption, 
  OptionDependency, 
  RulePrecedenceLevel, 
  RuleEvaluationTrace 
} from './types';

export class ConfigurationRuleEngine {
  private static precedenceOrder: Record<RulePrecedenceLevel, number> = {
    SAFETY: 1,
    REGULATORY: 2,
    ENGINEERING: 3,
    MANUFACTURING: 4,
    COMMERCIAL: 5,
    DEFAULT: 6
  };

  public static sortRulesByPrecedence(rules: ConfigurationRule[]): ConfigurationRule[] {
    return [...rules].sort((a, b) => {
      const precA = ConfigurationRuleEngine.precedenceOrder[a.precedence] || 99;
      const precB = ConfigurationRuleEngine.precedenceOrder[b.precedence] || 99;
      if (precA !== precB) return precA - precB;
      if (a.priority !== b.priority) return a.priority - b.priority;
      return a.ruleId.localeCompare(b.ruleId);
    });
  }

  public static detectRuleCycles(dependencies: OptionDependency[]): { hasCycle: boolean; cyclePath?: string } {
    const adj = new Map<string, string[]>();
    for (const dep of dependencies) {
      if (!adj.has(dep.sourceOptionId)) {
        adj.set(dep.sourceOptionId, []);
      }
      adj.get(dep.sourceOptionId)!.push(dep.targetOptionId);
    }

    const visited = new Set<string>();
    const recStack = new Set<string>();
    let cycleNodes: string[] = [];

    const dfs = (curr: string, path: string[]): boolean => {
      visited.add(curr);
      recStack.add(curr);
      path.push(curr);

      const neighbors = adj.get(curr) || [];
      for (const next of neighbors) {
        if (!visited.has(next)) {
          if (dfs(next, path)) return true;
        } else if (recStack.has(next)) {
          path.push(next);
          cycleNodes = path;
          return true;
        }
      }

      recStack.delete(curr);
      path.pop();
      return false;
    };

    for (const node of Array.from(adj.keys())) {
      if (!visited.has(node)) {
        if (dfs(node, [])) {
          return {
            hasCycle: true,
            cyclePath: cycleNodes.join(' -> ')
          };
        }
      }
    }

    return { hasCycle: false };
  }

  public static evaluateOptionDependencies(
    selectionsMap: Map<string, any>,
    dependencies: OptionDependency[]
  ): { isValid: boolean; conflicts: string[]; impliedSelections: Map<string, { value: any; sourceRuleId: string }> } {
    const conflicts: string[] = [];
    const impliedSelections = new Map<string, { value: any; sourceRuleId: string }>();

    for (const dep of dependencies) {
      const srcVal = selectionsMap.get(dep.sourceOptionId);
      const tgtVal = selectionsMap.get(dep.targetOptionId);

      const isSrcActive = srcVal !== undefined && srcVal !== false && srcVal !== null;
      const isTgtActive = tgtVal !== undefined && tgtVal !== false && tgtVal !== null;

      switch (dep.dependencyType) {
        case 'OPTION_REQUIRES':
          if (isSrcActive && !isTgtActive) {
            conflicts.push(`OPTION_REQUIRES_VIOLATION: Option ${dep.sourceOptionId} requires ${dep.targetOptionId}`);
          }
          break;

        case 'OPTION_EXCLUDES':
          if (isSrcActive && isTgtActive) {
            conflicts.push(`OPTION_EXCLUDES_VIOLATION: Option ${dep.sourceOptionId} excludes ${dep.targetOptionId}`);
          }
          break;

        case 'OPTION_IMPLIES':
          if (isSrcActive) {
            const requiredVal = dep.targetRequiredValue !== undefined ? dep.targetRequiredValue : true;
            impliedSelections.set(dep.targetOptionId, {
              value: requiredVal,
              sourceRuleId: dep.dependencyId
            });
          }
          break;

        case 'OPTION_CONFLICTS':
          if (isSrcActive && isTgtActive) {
            conflicts.push(`OPTION_CONFLICTS_VIOLATION: Option ${dep.sourceOptionId} conflicts with ${dep.targetOptionId}`);
          }
          break;
      }
    }

    return {
      isValid: conflicts.length === 0,
      conflicts,
      impliedSelections
    };
  }

  public static evaluateRules(
    rules: ConfigurationRule[],
    selectionsMap: Map<string, any>,
    context: ConfigurationContext
  ): { traces: RuleEvaluationTrace[]; executedActions: Array<{ ruleId: string; action: ConfigurationRule['action'] }> } {
    const sortedRules = ConfigurationRuleEngine.sortRulesByPrecedence(rules);
    const traces: RuleEvaluationTrace[] = [];
    const executedActions: Array<{ ruleId: string; action: ConfigurationRule['action'] }> = [];

    for (const rule of sortedRules) {
      if (rule.status !== 'ACTIVE') continue;

      let condResult = false;
      try {
        condResult = rule.condition(selectionsMap, context);
      } catch (e: any) {
        condResult = false;
      }

      const trace: RuleEvaluationTrace = {
        ruleId: rule.ruleId,
        precedence: rule.precedence,
        conditionResult: condResult,
        actionExecuted: condResult ? rule.action.type : undefined,
        output: condResult ? rule.action.targetId : undefined,
        timestamp: new Date().toISOString()
      };

      traces.push(trace);

      if (condResult) {
        executedActions.push({
          ruleId: rule.ruleId,
          action: rule.action
        });
      }
    }

    return { traces, executedActions };
  }
}
