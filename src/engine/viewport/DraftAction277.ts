/**
 * PROMPT-028: Draft Canonical Action
 */

import { EngineeringDocument } from '../cad-kernel/document/CADDocument';
import { SketchUIIntegration } from '../cad-kernel/ui-integration/SketchUIIntegration';
import { DraftIntent, DispatchResult } from './EngineeringIntent277';
import { CanonicalAction } from './CanonicalAction277';
import { BRepMutationGate277 } from '../cad-kernel/brep/BRepMutationGate277';

export class DraftAction277 implements CanonicalAction<DraftIntent> {
  public readonly actionId = 'FeatureAction.draft';

  public async execute(intent: DraftIntent, document: EngineeringDocument): Promise<DispatchResult> {
    try {
      const before = BRepMutationGate277.captureSnapshot(document);

      const evalResult = SketchUIIntegration.applyDraftAction(
        document,
        {
          angle: intent.parameters.angle,
          draftAngle: intent.parameters.draftAngle,
          targetFaceId: intent.parameters.targetFaceId,
          neutralPlaneRef: intent.parameters.neutralPlaneRef,
          pullDirection: intent.parameters.pullDirection,
          propagation: intent.parameters.propagation
        },
        { targetSolidId: intent.parameters.targetSolidId }
      );

      const after = BRepMutationGate277.captureSnapshot(evalResult.document);

      const mutationVerdict = BRepMutationGate277.verify(before, after, 'MODIFICATION');

      if (evalResult.success && mutationVerdict.status === 'FAIL') {
        return {
          success: false,
          documentId: evalResult.document.documentId,
          revision: typeof evalResult.document.revision === 'string'
            ? parseInt(evalResult.document.revision, 10)
            : evalResult.document.revision,
          canonicalActionId: this.actionId,
          affectedEntities: [intent.parameters.targetFaceId || 'DRAFT_TARGET'],
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
        affectedEntities: [intent.parameters.targetFaceId || 'DRAFT_TARGET'],
        document: evalResult.document,
        evaluationResult: evalResult,
        error: evalResult.success ? undefined : `EVALUATION_FAILURE: ${evalResult.error || evalResult.diagnostics?.join('; ') || 'Unknown'}`
      };
    } catch (err: any) {
      throw err;
    }
  }
}
