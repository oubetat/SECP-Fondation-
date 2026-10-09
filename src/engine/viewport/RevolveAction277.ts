/**
 * PATCH-SECP-PROMPT-013 / PROMPT-023: Revolve Canonical Action
 * Implementation of the revolve operation by direct EngineeringDocument mutation.
 */

import { EngineeringDocument } from '../cad-kernel/document/CADDocument';
import { SketchUIIntegration } from '../cad-kernel/ui-integration/SketchUIIntegration';
import { RevolveIntent, DispatchResult } from './EngineeringIntent277';
import { CanonicalAction } from './CanonicalAction277';
import { BRepMutationGate277 } from '../cad-kernel/brep/BRepMutationGate277';

export class RevolveAction277 implements CanonicalAction<RevolveIntent> {
  public readonly actionId = 'FeatureAction.revolve';

  public async execute(intent: RevolveIntent, document: EngineeringDocument): Promise<DispatchResult> {
    // 1. Capture BEFORE snapshot
    const before = BRepMutationGate277.captureSnapshot(document);

    // 2. Perform Mutation + Evaluation via Canonical Bridge
    const evalResult = SketchUIIntegration.applyRevolveAction(
      document,
      (intent.parameters as any).sketchEntities || [],
      intent.parameters.angle,
      {
        sketchId: intent.parameters.sketchId,
        axis: intent.parameters.axis,
        operation: intent.parameters.operation,
        updateActive: true
      }
    );

    // 3. Capture AFTER snapshot
    const after = BRepMutationGate277.captureSnapshot(evalResult.document);

    // 4. Verify Mutation via Gate
    const mutationVerdict = BRepMutationGate277.verify(
      before, 
      after, 
      intent.parameters.operation === 'CUT' ? 'SUBTRACTIVE' : 'ADDITIVE'
    );

    if (evalResult.success && mutationVerdict.status === 'FAIL') {
      return {
        success: false,
        documentId: evalResult.document.documentId,
        revision: typeof evalResult.document.revision === 'string' 
          ? parseInt(evalResult.document.revision, 10) 
          : evalResult.document.revision,
        canonicalActionId: this.actionId,
        affectedEntities: [intent.parameters.sketchId],
        evaluationResult: evalResult,
        error: `MUTATION_GATE_FAILURE: ${mutationVerdict.reason}`
      };
    }

    // 5. Result
    return {
      success: evalResult.success,
      documentId: evalResult.document.documentId,
      revision: typeof evalResult.document.revision === 'string' 
        ? parseInt(evalResult.document.revision, 10) 
        : evalResult.document.revision,
      canonicalActionId: this.actionId,
      affectedEntities: [intent.parameters.sketchId, 'NEW_REVOLVE'],
      document: evalResult.document,
      evaluationResult: evalResult,
      error: evalResult.success ? undefined : `EVALUATION_FAILURE: ${evalResult.error || 'Unknown'}`
    };
  }
}
