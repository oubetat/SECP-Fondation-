/**
 * PATCH-SECP-063: Preventive Action Engine
 * Issues and monitors preventive actions (CAPA) targeting systematic process upgrades.
 */

import { CAPA_Action } from './NCRTypes';

export class PreventiveActionEngine {
  /**
   * Issues a preventive action
   */
  public static issuePreventiveAction(params: {
    ncrId: string;
    description: string;
    owner: string;
    dueDate: string;
  }): CAPA_Action {
    const actionId = `capa-prev-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    if (!params.dueDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
      throw new Error('CAPA Rule: Due date must match ISO standard YYYY-MM-DD.');
    }

    return {
      actionId,
      ncrId: params.ncrId,
      actionType: 'PREVENTIVE',
      description: params.description,
      owner: params.owner,
      dueDate: params.dueDate,
      approvalStatus: 'PENDING'
    };
  }

  /**
   * Approves a preventive action completion
   */
  public static approveExecution(
    action: CAPA_Action,
    isApproved: boolean,
    verifiedBy: string,
    notes: string
  ): CAPA_Action {
    if (action.actionType !== 'PREVENTIVE') {
      throw new Error('PreventiveActionEngine only processes PREVENTIVE action types.');
    }

    return {
      ...action,
      approvalStatus: isApproved ? 'APPROVED' : 'REJECTED',
      approvedBy: verifiedBy,
      verificationNotes: notes
    };
  }
}
