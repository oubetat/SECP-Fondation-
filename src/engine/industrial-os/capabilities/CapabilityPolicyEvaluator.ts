import { EngineeringCapability, AuthorizationDecision } from './types';
import { EngineeringPolicyEngine } from '../policy/EngineeringPolicyEngine';
import { INITIAL_SECP_POLICIES } from '../policy/DefaultPolicies';

export class CapabilityPolicyEvaluator {
  private static policyEngine = EngineeringPolicyEngine.getInstance(INITIAL_SECP_POLICIES);

  /**
   * Evaluates if an actor is authorized to run a capability on a specific engineering object.
   */
  public static evaluate(
    actor: string,
    capability: EngineeringCapability,
    object: any,
    additionalPolicies: string[] = []
  ): AuthorizationDecision {
    const context = {
      subject: object?.identity || { identityId: object?.id || 'ANONYMOUS', objectType: 'OBJECT' as any },
      operation: `EXECUTE_${capability.id}`,
      actor: { id: actor, type: 'USER', capabilities: [] },
      metadata: { capability },
      environment: { timestamp: new Date().toISOString(), stage: 'PRODUCTION' as any }
    };

    const decision = this.policyEngine.evaluate(context);

    if (decision.overallEffect === 'DENY' || decision.overallEffect === 'BLOCK') {
      return {
        allowed: false,
        reason: `POLICY_REJECTION: ${decision.reason}`
      };
    }

    return {
      allowed: true,
      reason: 'CAPABILITY_AUTHORIZED'
    };
  }
}
