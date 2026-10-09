/**
 * PATCH-SECP-070: Enterprise Trust Decision Engine
 * Final authority for deterministic trust decisions based on all evidence.
 */

import { TrustStatus, TrustDecision } from './EnterpriseTrustTypes';
import { TrustPolicyEngine } from './TrustPolicyEngine';
import { DecisionProvenanceEngine } from './DecisionProvenanceEngine';

export class EnterpriseTrustDecisionEngine {
  public static evaluateTrust(
    subjectType: string,
    action: string,
    evidenceIds: string[],
    integrityVerified: boolean
  ): TrustDecision {
    const status = TrustPolicyEngine.evaluate(subjectType, action, evidenceIds.length, integrityVerified);
    const reason = status === 'TRUSTED' ? 'All evidence verified' : 'Insufficient evidence or integrity violation';
    
    return DecisionProvenanceEngine.recordDecision(
      `subj-${subjectType}`,
      status,
      reason,
      evidenceIds,
      'POL-070-V1'
    );
  }
}
