import { 
  ECOImplementationPlan, 
  ImplementationStep, 
  ImplementationStepStatus, 
  ECOOperation 
} from './types';

export class ECOExecutionEngine {

  public static executePlan(
    plan: ECOImplementationPlan,
    actorId: string,
    existingRevisions: Map<string, { revisionId: string; lifecycleState: string }>
  ): { plan: ECOImplementationPlan; success: boolean; error?: string } {
    
    // Sort steps by sequence and dependencies
    const steps = [...plan.steps].sort((a, b) => a.sequence - b.sequence);

    for (const step of steps) {
      // Check step dependencies
      for (const depId of step.dependencies) {
        const parentStep = steps.find(s => s.stepId === depId);
        if (!parentStep || parentStep.status !== ImplementationStepStatus.COMPLETED) {
          step.status = ImplementationStepStatus.BLOCKED;
          return {
            plan,
            success: false,
            error: `DEPENDENCY_BLOCKED: Step ${step.stepId} depends on step ${depId} which is not COMPLETED.`
          };
        }
      }

      // Check revision immutability rule: Cannot directly modify a RELEASED revision
      if (step.operation === ECOOperation.MODIFY || step.operation === ECOOperation.REVISE) {
        const targetRev = existingRevisions.get(step.targetEntity);
        if (targetRev && targetRev.lifecycleState === 'RELEASED' && step.operation === ECOOperation.MODIFY) {
          step.status = ImplementationStepStatus.FAILED;
          return {
            plan,
            success: false,
            error: `ILLEGAL_MUTATION: Cannot directly modify RELEASED revision ${step.targetEntity}. Must issue new revision.`
          };
        }
      }

      // Mark step as completed with execution evidence
      step.status = ImplementationStepStatus.COMPLETED;
      step.startedAt = new Date().toISOString();
      step.completedAt = new Date().toISOString();
      step.evidenceIds.push(`EXEC-EVID-${Date.now()}-${step.sequence}`);
    }

    return { plan, success: true };
  }
}
