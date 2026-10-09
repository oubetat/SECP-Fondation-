/**
 * PROMPT-028: Shell Canonical Action
 */

import { EngineeringDocument } from '../cad-kernel/document/CADDocument';
import { SketchUIIntegration } from '../cad-kernel/ui-integration/SketchUIIntegration';
import { ShellIntent, DispatchResult } from './EngineeringIntent277';
import { CanonicalAction } from './CanonicalAction277';
import { BRepMutationGate277 } from '../cad-kernel/brep/BRepMutationGate277';

export class ShellAction277 implements CanonicalAction<ShellIntent> {
  public readonly actionId = 'FeatureAction.shell';

  public async execute(intent: ShellIntent, document: EngineeringDocument): Promise<DispatchResult> {
    const before = BRepMutationGate277.captureSnapshot(document);

    const evalResult = SketchUIIntegration.applyShellAction(
      document,
      {
        thickness: intent.parameters.thickness,
        removedFaceId: intent.parameters.removedFaceId,
        removedFaceRefs: intent.parameters.removedFaceRef ? [intent.parameters.removedFaceRef as any] : undefined,
        direction: intent.parameters.direction
      },
      { targetSolidId: intent.parameters.targetSolidId }
    );

    const after = BRepMutationGate277.captureSnapshot(evalResult.document);

    const mutationVerdict = BRepMutationGate277.verify(before, after, 'SUBTRACTIVE');

    if (evalResult.success && mutationVerdict.status === 'FAIL') {
      return {
        success: false,
        documentId: evalResult.document.documentId,
        revision: typeof evalResult.document.revision === 'string'
          ? parseInt(evalResult.document.revision, 10)
          : evalResult.document.revision,
        canonicalActionId: this.actionId,
        affectedEntities: [intent.parameters.removedFaceId || 'SHELL_TARGET'],
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
      affectedEntities: [intent.parameters.removedFaceId || 'SHELL_TARGET'],
      document: evalResult.document,
      evaluationResult: evalResult,
      error: evalResult.success ? undefined : `EVALUATION_FAILURE: ${evalResult.error || evalResult.diagnostics?.join('; ') || 'Unknown'}`
    };
  }
}
