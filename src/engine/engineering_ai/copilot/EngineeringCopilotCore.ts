import {
  EngineeringContext,
  EngineeringIntent,
  EngineeringActionProposal,
  CopilotResponseClassification,
  CopilotProvenance,
  CopilotSafetyClassification,
  ActionProposalState,
  EngineeringCopilotEvidenceBundle
} from './types';
import { globalToolRegistry } from './EngineeringToolRegistry';
import * as crypto from 'crypto';

export class EngineeringCopilotCore {
  public static resolveContext(rawContext: Partial<EngineeringContext>): { valid: boolean; context?: EngineeringContext; missing?: string[] } {
    const missing = [];
    if (!rawContext.projectId) missing.push('projectId');
    if (!rawContext.revisionId) missing.push('revisionId');

    if (missing.length > 0) {
      return { valid: false, missing };
    }
    
    return { valid: true, context: rawContext as EngineeringContext };
  }

  public static classifySafety(intent: EngineeringIntent): CopilotSafetyClassification {
    if (intent.operation === 'MODIFY' || intent.operation === 'OPTIMIZE') {
      return 'HIGH_IMPACT';
    }
    if (intent.operation === 'RELEASE') {
      return 'CRITICAL_ENGINEERING_ACTION';
    }
    return 'LOW_RISK';
  }

  public static async proposeAction(
    intent: EngineeringIntent,
    context: EngineeringContext,
    target: string,
    proposedState: any,
    reason: string
  ): Promise<EngineeringActionProposal> {
    const safety = this.classifySafety(intent);
    
    let initialState: ActionProposalState = 'PROPOSED';
    if (safety === 'HIGH_IMPACT' || safety === 'CRITICAL_ENGINEERING_ACTION') {
      initialState = 'REVIEW_REQUIRED';
    }

    return {
      proposalId: `PROP-${Date.now()}`,
      action: intent.operation,
      target,
      currentState: context.geometryState, // Mock
      proposedState,
      reason,
      expectedImpact: 'Pending analysis',
      risks: safety === 'CRITICAL_ENGINEERING_ACTION' ? ['High risk of breaking compliance'] : [],
      evidence: [],
      verificationPlan: 'Requires independent solver verification',
      state: initialState
    };
  }

  public static evaluateEvidence(question: string, context: EngineeringContext, availableEvidence: any[]): { classification: CopilotResponseClassification, answer: string } {
    if (availableEvidence.length === 0) {
      return { classification: 'INSUFFICIENT_EVIDENCE', answer: 'SAFETY CANNOT BE VERIFIED: Missing required analysis and verification evidence.' };
    }

    const verified = availableEvidence.filter(e => e.verificationState === 'VERIFIED');
    if (verified.length > 0) {
      return { classification: 'FACTUAL', answer: 'Verified evidence confirms compliance.' };
    }

    return { classification: 'INSUFFICIENT_EVIDENCE', answer: 'Evidence exists but is not independently verified.' };
  }

  public static generateProvenance(context: EngineeringContext, evidence: any[], response: string): CopilotProvenance {
    const contextHash = crypto.createHash('sha256').update(JSON.stringify(context)).digest('hex');
    const responseHash = crypto.createHash('sha256').update(response).digest('hex');
    
    return {
      model: 'EngineeringCopilot-v2',
      modelVersion: '2.0.0',
      promptPolicyVersion: '1.0.0',
      toolVersions: { 'geometry-solver': '1.2.0' },
      contextHash,
      evidenceHashes: evidence.map(e => crypto.createHash('sha256').update(JSON.stringify(e)).digest('hex')),
      responseHash,
      timestamp: new Date().toISOString()
    };
  }
}
