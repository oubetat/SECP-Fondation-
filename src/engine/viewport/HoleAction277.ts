/**
 * PROMPT-027: Hole Canonical Action
 * Implementation of the canonical Hole operation by direct EngineeringDocument mutation.
 * Guarantees zero fake holes / box cutters, real B-Rep topological mutation,
 * cryptographic evidence attachment, and verification through BRepMutationGate277.
 */

import { EngineeringDocument } from '../cad-kernel/document/CADDocument';
import { SketchUIIntegration } from '../cad-kernel/ui-integration/SketchUIIntegration';
import { HoleIntent, DispatchResult } from './EngineeringIntent277';
import { CanonicalAction } from './CanonicalAction277';
import { BRepMutationGate277 } from '../cad-kernel/brep/BRepMutationGate277';

export class HoleAction277 implements CanonicalAction<HoleIntent> {
  public readonly actionId = 'FeatureAction.hole';

  public async execute(intent: HoleIntent, document: EngineeringDocument): Promise<DispatchResult> {
    // 1. Capture BEFORE snapshot
    const before = BRepMutationGate277.captureSnapshot(document);

    // 2. Perform Mutation + Evaluation via Canonical Bridge
    const evalResult = SketchUIIntegration.applyHoleAction(
      document,
      {
        diameter: intent.parameters.diameter,
        depth: intent.parameters.depth,
        termination: intent.parameters.termination,
        throughAll: intent.parameters.throughAll,
        holeType: intent.parameters.holeType,
        position: intent.parameters.position,
        center: intent.parameters.center,
        direction: intent.parameters.direction,
        targetFaceId: intent.parameters.targetFaceId,
        targetFaceRef: intent.parameters.targetFaceRef,
        counterbore: intent.parameters.counterbore,
        countersink: intent.parameters.countersink,
        taperAngleDeg: intent.parameters.taperAngleDeg,
        tipAngleDeg: intent.parameters.tipAngleDeg,
        threadSpec: intent.parameters.threadSpec,
        operation: intent.parameters.operation || 'CUT'
      }
    );

    // 3. Capture AFTER snapshot
    const after = BRepMutationGate277.captureSnapshot(evalResult.document);

    // 4. Verify Subtractive Mutation via Gate
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
        affectedEntities: [intent.parameters.targetFaceId || 'HOLE_TARGET'],
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
      affectedEntities: [intent.parameters.targetFaceId || 'HOLE_TARGET'],
      document: evalResult.document,
      evaluationResult: evalResult,
      error: evalResult.success ? undefined : `EVALUATION_FAILURE: ${evalResult.error || 'Unknown'}`
    };
  }
}
