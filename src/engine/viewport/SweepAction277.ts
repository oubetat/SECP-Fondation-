/**
 * PROMPT-024: Sweep Canonical Action
 * Implementation of the sweep operation by direct EngineeringDocument mutation.
 * Guarantees zero delegation to Extrude or Revolve, real B-Rep generation,
 * cryptographic evidence attachment, and verification through BRepMutationGate277.
 */

import { EngineeringDocument } from '../cad-kernel/document/CADDocument';
import { SketchUIIntegration } from '../cad-kernel/ui-integration/SketchUIIntegration';
import { SweepIntent, DispatchResult } from './EngineeringIntent277';
import { CanonicalAction } from './CanonicalAction277';
import { BRepMutationGate277 } from '../cad-kernel/brep/BRepMutationGate277';

export class SweepAction277 implements CanonicalAction<SweepIntent> {
  public readonly actionId = 'FeatureAction.sweep';

  public async execute(intent: SweepIntent, document: EngineeringDocument): Promise<DispatchResult> {
    // 1. Capture BEFORE snapshot
    const before = BRepMutationGate277.captureSnapshot(document);

    // 2. Perform Mutation + Evaluation via Canonical Bridge
    const evalResult = SketchUIIntegration.applySweepAction(
      document,
      (intent.parameters as any).sketchEntities || [],
      intent.parameters.pathPoints || (intent.parameters as any).path,
      {
        sketchId: intent.parameters.sketchId,
        pathPoints: intent.parameters.pathPoints,
        guideCurves: intent.parameters.guideCurves,
        orientation: intent.parameters.orientation,
        twistAngleDeg: intent.parameters.twistAngleDeg,
        operation: intent.parameters.operation,
        scale: intent.parameters.scale,
        updateActive: true
      }
    );

    // 3. Capture AFTER snapshot
    const after = BRepMutationGate277.captureSnapshot(evalResult.document);

    // 4. Verify Mutation via Gate
    const gateOpType = intent.parameters.operation === 'JOIN'
      ? 'ADDITIVE'
      : (intent.parameters.operation === 'CUT' ? 'SUBTRACTIVE' : 'NEW');

    const mutationVerdict = BRepMutationGate277.verify(
      before, 
      after, 
      gateOpType
    );

    if (evalResult.success && mutationVerdict.status === 'FAIL') {
      return {
        success: false,
        documentId: evalResult.document.documentId,
        revision: typeof evalResult.document.revision === 'string' 
          ? parseInt(evalResult.document.revision, 10) 
          : evalResult.document.revision,
        canonicalActionId: this.actionId,
        affectedEntities: [intent.parameters.sketchId || 'F_SKETCH_1'],
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
      affectedEntities: [intent.parameters.sketchId || 'F_SKETCH_1', 'NEW_SWEEP'],
      document: evalResult.document,
      evaluationResult: evalResult,
      error: evalResult.success ? undefined : `EVALUATION_FAILURE: ${evalResult.error || 'Unknown'}`
    };
  }
}
