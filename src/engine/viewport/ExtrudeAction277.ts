/**
 * PATCH-SECP-PROMPT-013: Extrude Canonical Action
 * Implementation of the formal extrude operation on EngineeringDocument.
 */

import { EngineeringDocument } from '../cad-kernel/document/CADDocument';
import { SketchUIIntegration } from '../cad-kernel/ui-integration/SketchUIIntegration';
import { ExtrudeIntent, DispatchResult } from './EngineeringIntent277';
import { CanonicalAction } from './CanonicalAction277';
import { BRepMutationGate277 } from '../cad-kernel/brep/BRepMutationGate277';

export class ExtrudeAction277 implements CanonicalAction<ExtrudeIntent> {
  public readonly actionId = 'SketchUIIntegration.applyExtrudeAction';

  public async execute(intent: ExtrudeIntent, document: EngineeringDocument): Promise<DispatchResult> {
    // 1. Capture BEFORE snapshot
    const before = BRepMutationGate277.captureSnapshot(document);

    // 2. Perform Mutation + Evaluation via Canonical Bridge
    const evalResult = SketchUIIntegration.applyExtrudeAction(
      document,
      (intent.parameters as any).sketchEntities || [], 
      intent.parameters.depth,
      {
        sketchId: intent.parameters.sketchId,
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

    // 5. Map Evaluation Result to Dispatch Result
    return {
      success: evalResult.success,
      documentId: evalResult.document.documentId,
      revision: typeof evalResult.document.revision === 'string' 
        ? parseInt(evalResult.document.revision, 10) 
        : evalResult.document.revision,
      canonicalActionId: this.actionId,
      affectedEntities: [intent.parameters.sketchId, 'NEW_EXTRUDE'],
      document: evalResult.document,
      evaluationResult: evalResult,
      error: evalResult.success ? undefined : `EVALUATION_FAILURE: ${evalResult.error || 'Unknown'}`
    };
  }
}
