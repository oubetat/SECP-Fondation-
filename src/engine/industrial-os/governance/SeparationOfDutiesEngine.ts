import { GovernanceContext, GovernanceVerdict } from './types';
import { ApprovalRecord } from './types';

export class SeparationOfDutiesEngine {
  private static instance: SeparationOfDutiesEngine;

  private constructor() {}

  public static getInstance(): SeparationOfDutiesEngine {
    if (!SeparationOfDutiesEngine.instance) {
      SeparationOfDutiesEngine.instance = new SeparationOfDutiesEngine();
    }
    return SeparationOfDutiesEngine.instance;
  }

  /**
   * Validates if an action violates Separation of Duties.
   */
  public validate(context: GovernanceContext, approvals: ApprovalRecord[]): { valid: boolean; reason?: string } {
    if (!context.object) return { valid: true };

    const creatorId = context.object.creatorId;
    const actorId = context.identity;

    // Rule 1: Creator cannot be Approver for critical transitions (e.g., RELEASE)
    if (context.requestedAction.includes('RELEASE') || context.requestedAction.includes('APPROVE')) {
      if (actorId === creatorId) {
        return {
          valid: false,
          reason: `Separation of Duties Violation: Creator (${creatorId}) cannot approve or release their own work.`
        };
      }
    }

    // Rule 2: Reviewer must be different from the person who requested the review
    // (This is implicitly handled by Rule 1 if we consider "requesting review" as a creator action)

    // Rule 3: Sequential approvals must be by different people
    const existingApprovers = approvals
      .filter(a => a.decision === 'APPROVED')
      .map(a => a.approverId);

    if (existingApprovers.includes(actorId)) {
      return {
        valid: false,
        reason: `Separation of Duties Violation: Actor (${actorId}) has already provided an approval for this revision.`
      };
    }

    return { valid: true };
  }
}
