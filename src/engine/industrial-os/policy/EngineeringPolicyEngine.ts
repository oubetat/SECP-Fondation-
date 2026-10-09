import * as crypto from 'crypto';
import { 
  EngineeringPolicy, 
  PolicyContext, 
  PolicyDecision, 
  PolicyEffect,
  AggregatePolicyDecision,
  PolicyCondition
} from './types';

export class EngineeringPolicyEngine {
  private static instance: EngineeringPolicyEngine;
  private policies: EngineeringPolicy[] = [];

  constructor(initialPolicies: EngineeringPolicy[] = []) {
    this.policies = [...initialPolicies];
  }

  public static getInstance(initialPolicies: EngineeringPolicy[] = []): EngineeringPolicyEngine {
    if (!EngineeringPolicyEngine.instance) {
      EngineeringPolicyEngine.instance = new EngineeringPolicyEngine(initialPolicies);
    }
    return EngineeringPolicyEngine.instance;
  }

  /**
   * Registers a new policy or updates an existing one (versioned).
   */
  public registerPolicy(policy: EngineeringPolicy): void {
    // Validate schema
    if (!policy.policyId || !policy.policyVersion || !policy.effect) {
      throw new Error('[EngineeringPolicyEngine] Invalid policy schema');
    }

    // Check for duplicates of same ID and Version
    const existing = this.policies.find(p => p.policyId === policy.policyId && p.policyVersion === policy.policyVersion);
    if (existing) {
      throw new Error(`[EngineeringPolicyEngine] Policy ${policy.policyId} v${policy.policyVersion} already exists`);
    }

    this.policies.push(policy);
    
    // Maintain deterministic order: Priority (high to low), then ID, then Version
    this.sortPolicies();
  }

  /**
   * Evaluates a single operation against the active policy set.
   */
  public evaluate(context: PolicyContext): AggregatePolicyDecision {
    const activePolicies = this.policies
      .filter(p => p.status === 'ACTIVE')
      .filter(p => this.isPolicyInScope(p, context));

    const decisions: PolicyDecision[] = activePolicies.map(policy => this.evaluatePolicy(policy, context));

    const overallEffect = this.resolveConflicts(decisions);

    return {
      overallEffect,
      decisions,
      reason: this.generateAggregateReason(overallEffect, decisions),
      evaluatedAt: context.environment?.timestamp || new Date().toISOString()
    };
  }

  /**
   * Internal policy evaluator.
   */
  private evaluatePolicy(policy: EngineeringPolicy, context: PolicyContext): PolicyDecision {
    const matchedConditions: string[] = [];
    const failedConditions: string[] = [];

    for (const condition of policy.conditions) {
      if (this.checkCondition(condition, context)) {
        matchedConditions.push(condition.description || condition.field);
      } else {
        failedConditions.push(condition.description || condition.field);
      }
    }

    const isMatch = failedConditions.length === 0;
    const effect = isMatch ? policy.effect : this.getInverseEffect(policy.effect);

    return {
      decisionId: crypto.randomBytes(16).toString("hex"),
      policyId: policy.policyId,
      policyVersion: policy.policyVersion,
      effect: isMatch ? policy.effect : 'ALLOW', // Default to ALLOW if policy doesn't match? 
      // Wait, if it doesn't match, this policy doesn't "fire" its effect.
      // In many systems, a non-matching policy is just ignored.
      // But the requirement says "Same Context + Same Policy Set = Same Decision".
      subjectIdentityId: context.subject.identityId,
      operation: context.operation,
      matchedConditions,
      failedConditions,
      reason: isMatch ? `Policy matched: ${policy.name}` : `Policy criteria not met: ${policy.name}`,
      evaluatedAt: new Date().toISOString()
    };
  }

  /**
   * Resolves conflicts based on precedence and effect severity.
   * Rule: DENY/BLOCK overrides ALLOW.
   */
  private resolveConflicts(decisions: PolicyDecision[]): PolicyEffect {
    const effects = decisions.map(d => d.effect);

    if (effects.includes('BLOCK')) return 'BLOCK';
    if (effects.includes('DENY')) return 'DENY';
    if (effects.includes('CONFLICT')) return 'CONFLICT';
    
    if (effects.includes('REQUIRE_VERIFICATION')) return 'REQUIRE_VERIFICATION';
    if (effects.includes('REQUIRE_EVIDENCE')) return 'REQUIRE_EVIDENCE';
    if (effects.includes('REQUIRE_APPROVAL')) return 'REQUIRE_APPROVAL';
    
    if (effects.includes('WARN')) return 'WARN';
    if (effects.includes('ALLOW')) return 'ALLOW';

    return 'ALLOW'; // Default if no policies apply
  }

  private isPolicyInScope(policy: EngineeringPolicy, context: PolicyContext): boolean {
    if (policy.scope === 'GLOBAL') return true;
    if (policy.scope === context.subject.objectType) return true;
    if (policy.scope === 'PROJECT' && context.projectId) return true;
    // Add more scope checks as needed
    return false;
  }

  private checkCondition(condition: PolicyCondition, context: PolicyContext): boolean {
    const value = this.resolveFieldValue(condition.field, context);
    let targetValue = condition.value;

    // Resolve variable if targetValue is a string wrapped in curly braces
    if (typeof targetValue === 'string' && targetValue.startsWith('{') && targetValue.endsWith('}')) {
      const path = targetValue.substring(1, targetValue.length - 1);
      targetValue = this.resolveFieldValue(path, context);
    }
    
    return this.executeOperator(condition.operator, value, targetValue);
  }

  private executeOperator(operator: string, value: any, targetValue: any): boolean {
    switch (operator) {
      case 'EQUALS': return value === targetValue;
      case 'NOT_EQUALS': return value !== undefined && value !== targetValue;
      case 'IN': return Array.isArray(targetValue) && targetValue.includes(value);
      case 'NOT_IN': return Array.isArray(targetValue) && !targetValue.includes(value);
      case 'MATCHES': return typeof value === 'string' && new RegExp(targetValue).test(value);
      case 'EXISTS': return value !== undefined && value !== null;
      case 'GT': return value > targetValue;
      case 'LT': return value < targetValue;
      case 'CONTAINS': return Array.isArray(value) && value.includes(targetValue);
      case 'NOT_CONTAINS': return Array.isArray(value) && !value.includes(targetValue);
      default: return false;
    }
  }

  private resolveFieldValue(path: string, context: PolicyContext): any {
    const parts = path.split('.');
    let current: any = context;
    for (const part of parts) {
      if (current === undefined || current === null) return undefined;
      current = current[part];
    }
    return current;
  }

  private getInverseEffect(effect: PolicyEffect): PolicyEffect {
    // If a policy doesn't match, it shouldn't impose its effect.
    // However, some policies might be "Negated" or "Default Deny".
    // For this simple implementation, if it doesn't match, it's neutral.
    return 'ALLOW'; 
  }

  private sortPolicies(): void {
    this.policies.sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      if (a.policyId !== b.policyId) return a.policyId.localeCompare(b.policyId);
      return a.policyVersion.localeCompare(b.policyVersion);
    });
  }

  private generateAggregateReason(effect: PolicyEffect, decisions: PolicyDecision[]): string {
    const matching = decisions.filter(d => d.effect === effect);
    if (matching.length > 0) {
      return matching[0].reason;
    }
    return 'No explicit policies matched. Defaulting to system baseline.';
  }
}
