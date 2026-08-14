/**
 * PATCH-SECP-064: Deviation Approval Engine
 * Manages administrative deviations, allowing controlled engineering release
 * of items with minor, mitigated out-of-spec dimensions under rigid governance rules.
 */

import { DeviationApproval, DeviationSeverity } from './ManufacturingReleaseTypes';

export class DeviationApprovalEngine {
  /**
   * Files a formal product deviation record
   */
  public static initiateDeviation(params: {
    ncrId?: string;
    severity: DeviationSeverity;
    description: string;
    mitigationActions: string[];
    authorizedEngineerId: string;
  }): DeviationApproval {
    const deviationId = `dev-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // Critical deviations are structurally forbidden from automated/fast-track deviation paths
    if (params.severity === 'CRITICAL') {
      throw new Error('Regulatory Security Block: Critical deviations cannot be approved via standard deviation channels. Must go to Executive MRB board.');
    }

    if (params.description.length < 15) {
      throw new Error('Deviation Error: Standard deviation descriptions must be a minimum of 15 characters.');
    }

    if (params.mitigationActions.length === 0) {
      throw new Error('Deviation Error: A deviation requires at least one actionable, documented physical mitigation plan.');
    }

    // Generate secure engineering validation signature hash
    const signaturePayload = `${deviationId}|${params.severity}|${params.authorizedEngineerId}|${params.mitigationActions.join(',')}`;
    const signatureHash = this.computeDeviationSignature(signaturePayload);

    return {
      deviationId,
      ncrId: params.ncrId,
      severity: params.severity,
      description: params.description,
      mitigationActions: [...params.mitigationActions],
      authorizedEngineerId: params.authorizedEngineerId,
      signatureHash,
      approvalStatus: 'PENDING',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Authorizes or Rejects the deviation record
   */
  public static processApproval(
    deviation: DeviationApproval,
    isApproved: boolean,
    approverId: string
  ): DeviationApproval {
    if (approverId !== deviation.authorizedEngineerId) {
      throw new Error('Authentication Error: Deviation approval signature does not match original authorized quality engineer ID.');
    }

    return {
      ...deviation,
      approvalStatus: isApproved ? 'APPROVED' : 'REJECTED',
      timestamp: new Date().toISOString()
    };
  }

  private static computeDeviationSignature(payload: string): string {
    let hash = 0x543210fe;
    for (let i = 0; i < payload.length; i++) {
      hash = (hash << 5) - hash + payload.charCodeAt(i);
      hash &= hash;
    }
    return `sig-dev-approved-${Math.abs(hash).toString(16).toUpperCase()}`;
  }
}
