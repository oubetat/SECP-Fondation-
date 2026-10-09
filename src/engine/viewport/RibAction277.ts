/**
 * PROMPT-028: Rib Canonical Action
 */

import { EngineeringDocument } from '../cad-kernel/document/CADDocument';
import { SketchUIIntegration } from '../cad-kernel/ui-integration/SketchUIIntegration';
import { RibIntent, DispatchResult } from './EngineeringIntent277';
import { CanonicalAction } from './CanonicalAction277';
import { BRepMutationGate277 } from '../cad-kernel/brep/BRepMutationGate277';

export class RibAction277 implements CanonicalAction<RibIntent> {
  public readonly actionId = 'FeatureAction.rib';

  public async execute(intent: RibIntent, document: EngineeringDocument): Promise<DispatchResult> {
    const before = BRepMutationGate277.captureSnapshot(document);

    const evalResult = SketchUIIntegration.applyRibAction(
      document,
      {
        thickness: intent.parameters.thickness,
        profileId: intent.parameters.profileId,
        sketchId: intent.parameters.sketchId,
        supportFaceRef: intent.parameters.supportFaceRef as any,
        direction: intent.parameters.direction,
        termination: intent.parameters.termination
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
        affectedEntities: [intent.parameters.profileId || 'RIB_TARGET'],
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
      affectedEntities: [intent.parameters.profileId || 'RIB_TARGET'],
      document: evalResult.document,
      evaluationResult: evalResult,
      error: evalResult.success ? undefined : `EVALUATION_FAILURE: ${evalResult.error || 'Unknown'}`
    };
  }
}
