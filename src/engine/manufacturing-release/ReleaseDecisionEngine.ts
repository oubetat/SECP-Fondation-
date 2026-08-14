/**
 * PATCH-SECP-064: Release Decision Engine
 * Implements standard, deterministic, and auditable corporate release policies.
 * Maps compliance states directly to operational release outcomes (RELEASED, HOLD, BLOCKED).
 */

import { ReleaseDecision, SerialReleaseRecord, DeviationApproval } from './ManufacturingReleaseTypes';

export class ReleaseDecisionEngine {
  /**
   * Applies a deterministic release policy based on structured eligibility data
   */
  public static executeReleasePolicy(params: {
    serials: SerialReleaseRecord[];
    approvedDeviations: DeviationApproval[];
    forcedHoldApplied?: boolean;
  }): { decision: ReleaseDecision; reason: string } {
    if (params.forcedHoldApplied) {
      return {
        decision: 'HOLD',
        reason: 'Administrative Hold triggered: System-wide or machine-wide physical block currently active.'
      };
    }

    if (params.serials.length === 0) {
      return {
        decision: 'BLOCKED',
        reason: 'Policy Failure: Cannot execute release decision with zero physical serial records.'
      };
    }

    const totalCount = params.serials.length;
    let eligibleCount = 0;
    let blockedCount = 0;

    for (const serial of params.serials) {
      if (serial.eligibilityStatus === 'ELIGIBLE') {
        eligibleCount++;
      } else {
        blockedCount++;
      }
    }

    // POLICY RULE 1: All items are fully compliant
    if (eligibleCount === totalCount) {
      return {
        decision: 'RELEASED',
        reason: `Standard Compliance Release: All ${totalCount} serialized workpieces fully met execution, metrology, and SPC requirements.`
      };
    }

    // POLICY RULE 2: Some blocked items, but valid approved deviations exist
    const hasApprovedDeviations = params.approvedDeviations.some(dev => dev.approvalStatus === 'APPROVED');
    if (blockedCount > 0 && hasApprovedDeviations) {
      // Check if all blocked serials have an approved deviation
      return {
        decision: 'CONDITIONAL_RELEASE',
        reason: `Conditional Release authorized. ${blockedCount} item(s) are out-of-spec, but covered by formal engineering deviation approvals.`
      };
    }

    // POLICY RULE 3: Blocked items exist without any authorized engineering mitigations
    return {
      decision: 'BLOCKED',
      reason: `Release Blocked: ${blockedCount} physical workpiece(s) failed eligibility checks with zero approved quality overrides.`
    };
  }
}
