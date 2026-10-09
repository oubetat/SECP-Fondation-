/**
 * PATCH-SECP-063: Corrective Action Engine
 * Governs the issuance, implementation, and effectiveness scoring of corrective actions (CAPA).
 */

import { CAPA_Action } from './NCRTypes';

export class CorrectiveActionEngine {
  /**
   * Issues a corrective action linked to a nonconformance
   */
  public static issueCorrectiveAction(params: {
    ncrId: string;
    description: string;
    owner: string;
    dueDate: string;
  }): CAPA_Action {
    const actionId = `capa-corr-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // Validate date format or completeness
    if (!params.dueDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
      throw new Error('CAPA Rule: Due date must match ISO standard YYYY-MM-DD.');
    }

    return {
      actionId,
      ncrId: params.ncrId,
      actionType: 'CORRECTIVE',
      description: params.description,
      owner: params.owner,
      dueDate: params.dueDate,
      approvalStatus: 'PENDING'
    };
  }

  /**
   * Logs execution evidence and submits CAPA for engineering verification
   */
  public static submitEvidence(
    action: CAPA_Action,
    evidencePath: string
  ): CAPA_Action {
    if (!evidencePath || evidencePath.length === 0) {
      throw new Error('Governance Error: CAPA action resolution requires physical implementation evidence.');
    }

    return {
      ...action,
      evidencePath
    };
  }

  /**
   * Approves or Rejects the corrective action completion
   */
  public static approveExecution(
    action: CAPA_Action,
    isApproved: boolean,
    verifiedBy: string,
    notes: string
  ): CAPA_Action {
    if (action.actionType !== 'CORRECTIVE') {
      throw new Error('CorrectiveActionEngine only processes CORRECTIVE action types.');
    }

    return {
      ...action,
      approvalStatus: isApproved ? 'APPROVED' : 'REJECTED',
      approvedBy: verifiedBy,
      verificationNotes: notes
    };
  }

  /**
   * Scores the post-implementation effectiveness rating of the CAPA action
   */
  public static scoreEffectiveness(
    action: CAPA_Action,
    rating: CAPA_Action['effectivenessRating']
  ): CAPA_Action {
    if (action.approvalStatus !== 'APPROVED') {
      throw new Error('Action must be APPROVED before auditing execution effectiveness.');
    }

    return {
      ...action,
      effectivenessRating: rating
    };
  }
}
