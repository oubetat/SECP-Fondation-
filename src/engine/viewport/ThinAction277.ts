/**
 * PROMPT-028: Thin Canonical Action
 */

import { EngineeringDocument } from '../cad-kernel/document/CADDocument';
import { SketchUIIntegration } from '../cad-kernel/ui-integration/SketchUIIntegration';
import { ThinIntent, DispatchResult } from './EngineeringIntent277';
import { CanonicalAction } from './CanonicalAction277';
import { BRepMutationGate277 } from '../cad-kernel/brep/BRepMutationGate277';

export class ThinAction277 implements CanonicalAction<ThinIntent> {
  public readonly actionId = 'FeatureAction.thin';

  public async execute(intent: ThinIntent, document: EngineeringDocument): Promise<DispatchResult> {
    const before = BRepMutationGate277.captureSnapshot(document);

    const evalResult = SketchUIIntegration.applyThinAction(
      document,
      {
        thickness: intent.parameters.thickness,
        sketchId: intent.parameters.sketchId,
        direction: intent.parameters.direction,
        side: intent.parameters.side,
        termination: intent.parameters.termination,
        depth: intent.parameters.depth
      },
      { targetSolidId: intent.parameters.targetSolidId }
    );

    const after = BRepMutationGate277.captureSnapshot(evalResult.document);

    const mutationVerdict = BRepMutationGate277.verify(before, after, 'ADDITIVE');

    if (evalResult.success && mutationVerdict.status === 'FAIL') {
      return {
        success: false,
        documentId: evalResult.document.documentId,
        revision: typeof evalResult.document.revision === 'string'
          ? parseInt(evalResult.document.revision, 10)
          : evalResult.document.revision,
        canonicalActionId: this.actionId,
        affectedEntities: [intent.parameters.sketchId || 'THIN_TARGET'],
        evaluationResult: evalResult,
        error: `MUTATION_GATE_FAILURE: ${mutationVerdict.reason}`
      };
    }

    return {
      success: evalResult.success,
      documentId: evalResult.document.documentId,
      revision: typeof evalResult.document.revision === 'string'
        ? parseInt(evalResult.document.revision, 10)
        : evalResult.document.revision,
      canonicalActionId: this.actionId,
      affectedEntities: [intent.parameters.sketchId || 'THIN_TARGET'],
      document: evalResult.document,
      evaluationResult: evalResult,
      error: evalResult.success ? undefined : `EVALUATION_FAILURE: ${evalResult.error || 'Unknown'}`
    };
  }
}
