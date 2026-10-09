/**
 * SECP Industrial OS — Plugin Authority Boundary Guard
 * 
 * Enforces POST-PLUGIN-FORENSIC-001:
 * Plugins may compute, propose, request, and transform data,
 * but CAN NEVER directly establish manufacturing truth, issue certificates,
 * or authorize physical releases outside the verified authority boundary.
 */

export interface PluginEngineeringClaim {
  pluginId: string;
  claimType: 'MANUFACTURED' | 'PHYSICAL_TRUTH' | 'CERTIFICATE_ISSUE' | 'RELEASE_APPROVAL';
  targetEntityId: string;
  targetRevision: string;
  declaredPayload: Record<string, any>;
  declaredStatus: 'SUCCESS' | 'APPROVED' | 'RELEASED';
}

export interface PluginBoundaryEvaluation {
  isAuthoritative: boolean;
  classification: 'DECLARED_ONLY' | 'REJECTED_UNAUTHORIZED' | 'AUTHORITY_BREACH';
  reason: string;
  canCrossReleaseBoundary: boolean;
}

export class PluginAuthorityBoundary {
  /**
   * Evaluates an unauthenticated claim or status submitted directly by a plugin.
   * Any direct attempt by a plugin to mark manufactured, approve truth, or release
   * is classified as DECLARED_ONLY and is structurally blocked from release authority.
   */
  public static evaluatePluginClaim(claim: PluginEngineeringClaim): PluginBoundaryEvaluation {
    if (!claim || !claim.pluginId) {
      return {
        isAuthoritative: false,
        classification: 'REJECTED_UNAUTHORIZED',
        reason: 'Missing plugin identity',
        canCrossReleaseBoundary: false
      };
    }

    // Direct authority assertion by plugin is strictly disallowed
    return {
      isAuthoritative: false,
      classification: 'DECLARED_ONLY',
      reason: `Plugin '${claim.pluginId}' declared ${claim.claimType} with status ${claim.declaredStatus}, but plugin claims are DECLARED_ONLY and cannot establish physical truth or cross the release boundary.`,
      canCrossReleaseBoundary: false
    };
  }

  /**
   * Intercepts rogue plugin calls attempting to mark parts manufactured.
   */
  public static markPartAsManufactured(pluginId: string, partId: string, status: string = 'SUCCESS'): PluginBoundaryEvaluation {
    return this.evaluatePluginClaim({
      pluginId,
      claimType: 'MANUFACTURED',
      targetEntityId: partId,
      targetRevision: 'UNKNOWN',
      declaredPayload: { timestamp: new Date().toISOString() },
      declaredStatus: status as any
    });
  }
}
