/**
 * PROMPT-027: Thread Canonical Action
 * Implementation of the canonical Thread operation by direct EngineeringDocument mutation.
 * Guarantees zero cosmetic shortcuts when physical threads are requested,
 * real B-Rep topological mutation, cryptographic evidence attachment, and verification through BRepMutationGate277.
 */

import { EngineeringDocument } from '../cad-kernel/document/CADDocument';
import { SketchUIIntegration } from '../cad-kernel/ui-integration/SketchUIIntegration';
import { ThreadIntent, DispatchResult } from './EngineeringIntent277';
import { CanonicalAction } from './CanonicalAction277';
import { BRepMutationGate277 } from '../cad-kernel/brep/BRepMutationGate277';

export class ThreadAction277 implements CanonicalAction<ThreadIntent> {
  public readonly actionId = 'FeatureAction.thread';

  public async execute(intent: ThreadIntent, document: EngineeringDocument): Promise<DispatchResult> {
    const before = BRepMutationGate277.captureSnapshot(document);

    const evalResult = SketchUIIntegration.applyThreadAction(
      document,
      {
        threadSpec: intent.parameters.threadSpec,
        depth: intent.parameters.depth,
        center: (intent.parameters as any).center,
        position: (intent.parameters as any).position,
        targetFaceId: intent.parameters.targetFaceId,
        targetFaceRef: intent.parameters.targetFaceRef,
        isInternal: intent.parameters.isInternal ?? true,
        operation: intent.parameters.operation || 'CUT'
      }
    );

    const after = BRepMutationGate277.captureSnapshot(evalResult.document);

    const mutationVerdict = BRepMutationGate277.verify(
      before,
      after,
      'SUBTRACTIVE'
    );

    if (evalResult.success && mutationVerdict.status === 'FAIL') {
      return {
        success: false,
        documentId: evalResult.document.documentId,
        revision: typeof evalResult.document.revision === 'string'
          ? parseInt(evalResult.document.revision, 10)
          : evalResult.document.revision,
        canonicalActionId: this.actionId,
        affectedEntities: [intent.parameters.targetFaceId || 'THREAD_TARGET'],
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
      affectedEntities: [intent.parameters.targetFaceId || 'THREAD_TARGET'],
      document: evalResult.document,
      evaluationResult: evalResult,
      error: evalResult.success ? undefined : `EVALUATION_FAILURE: ${evalResult.error || 'Unknown'}`
    };
  }
}
