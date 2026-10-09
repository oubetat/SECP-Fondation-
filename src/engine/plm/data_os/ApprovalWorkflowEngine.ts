/**
 * SECP Industrial OS v3 — PATCH-181: Approval Workflow Engine
 * Orchestrates multi-role approval pipelines (Draft -> Review -> Verification -> Quality -> Management -> Released).
 */

import { ApprovalWorkflow, ApprovalStep, DigitalSignature } from './EngineeringDataOSTypes';
import { generateDeterministicHashSync } from '../../../lib/hash';

export class ApprovalWorkflowEngine {
  private static workflows: Map<string, ApprovalWorkflow> = new Map();

  public static clear(): void {
    this.workflows.clear();
  }

  /**
   * Initializes a standard industrial engineering release workflow.
   */
  public static createDefaultWorkflow(targetObjectId: string, targetRevisionId: string, targetType: ApprovalWorkflow['targetType'] = 'REVISION'): ApprovalWorkflow {
    const workflowId = `WF-${generateDeterministicHashSync({ obj: targetObjectId, rev: targetRevisionId, t: Date.now() }).substring(0, 8)}`;
    
    const steps: ApprovalStep[] = [
      {
        stepIndex: 0,
        stepName: 'Engineering Review',
        requiredRole: 'LEAD_ENGINEER',
        status: 'PENDING',
        isParallel: false
      },
      {
        stepIndex: 1,
        stepName: 'Technical Verification (FEM/CFD/CAM)',
        requiredRole: 'VERIFICATION_SPECIALIST',
        status: 'PENDING',
        isParallel: false
      },
      {
        stepIndex: 2,
        stepName: 'Quality & Regulatory Review',
        requiredRole: 'QUALITY_DIRECTOR',
        status: 'PENDING',
        isParallel: false
      },
      {
        stepIndex: 3,
        stepName: 'Management Authorization & Release',
        requiredRole: 'CHIEF_ENGINEER',
        status: 'PENDING',
        isParallel: false
      }
    ];

    const wf: ApprovalWorkflow = {
      workflowId,
      targetObjectId,
      targetRevisionId,
      targetType,
      steps,
      currentStepIndex: 0,
      overallStatus: 'IN_PROGRESS',
      startedAt: new Date().toISOString()
    };

    this.workflows.set(workflowId, wf);
    return wf;
  }

  /**
   * Submits an approval or rejection for the current step.
   */
  public static processStepDecision(
    workflowId: string,
    decidedBy: string,
    decision: 'APPROVE' | 'REJECT' | 'REQUEST_REWORK',
    comments: string,
    signature?: DigitalSignature
  ): ApprovalWorkflow {
    const wf = this.workflows.get(workflowId);
    if (!wf) throw new Error(`Workflow ${workflowId} not found`);

    if (wf.overallStatus !== 'IN_PROGRESS') {
      throw new Error(`Workflow ${workflowId} is already ${wf.overallStatus}`);
    }

    const currentStep = wf.steps[wf.currentStepIndex];
    if (!currentStep) {
      throw new Error(`Invalid step index ${wf.currentStepIndex}`);
    }

    currentStep.decidedBy = decidedBy;
    currentStep.decidedAt = new Date().toISOString();
    currentStep.comments = comments;
    currentStep.signature = signature;

    if (decision === 'APPROVE') {
      currentStep.status = 'APPROVED';
      if (wf.currentStepIndex < wf.steps.length - 1) {
        wf.currentStepIndex++;
      } else {
        // All steps completed!
        wf.overallStatus = 'APPROVED';
        wf.completedAt = new Date().toISOString();
      }
    } else if (decision === 'REJECT') {
      currentStep.status = 'REJECTED';
      wf.overallStatus = 'REJECTED';
      wf.completedAt = new Date().toISOString();
    } else if (decision === 'REQUEST_REWORK') {
      currentStep.status = 'REWORK_REQUESTED';
      wf.overallStatus = 'REWORK';
      // Reset back to step 0
      wf.currentStepIndex = 0;
      wf.steps.forEach(s => {
        if (s.stepIndex > 0) s.status = 'PENDING';
      });
    }

    return wf;
  }

  public static getWorkflow(workflowId: string): ApprovalWorkflow | undefined {
    return this.workflows.get(workflowId);
  }
}
