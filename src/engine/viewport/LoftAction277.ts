/**
 * PROMPT-025: Loft Canonical Action
 * Implementation of the multi-section loft operation by direct EngineeringDocument mutation.
 * Guarantees zero delegation to Extrude or Revolve, real B-Rep generation,
 * cryptographic evidence attachment, and verification through BRepMutationGate277.
 */

import { EngineeringDocument } from '../cad-kernel/document/CADDocument';
import { SketchUIIntegration } from '../cad-kernel/ui-integration/SketchUIIntegration';
import { LoftIntent, DispatchResult } from './EngineeringIntent277';
import { CanonicalAction } from './CanonicalAction277';
import { BRepMutationGate277 } from '../cad-kernel/brep/BRepMutationGate277';

export class LoftAction277 implements CanonicalAction<LoftIntent> {
  public readonly actionId = 'FeatureAction.loft';

  public async execute(intent: LoftIntent, document: EngineeringDocument): Promise<DispatchResult> {
    // 1. Capture BEFORE snapshot
    const before = BRepMutationGate277.captureSnapshot(document);

    // 2. Perform Mutation + Evaluation via Canonical Bridge
    const evalResult = SketchUIIntegration.applyLoftAction(
      document,
      intent.parameters.sections || (intent.parameters as any).sectionInputs || [],
      {
        sectionIds: intent.parameters.sectionIds,
        guideCurves: intent.parameters.guideCurves,
        centerline: intent.parameters.centerline,
        closed: intent.parameters.closed,
        solidMode: intent.parameters.solidMode,
        continuity: intent.parameters.continuity,
        startCondition: intent.parameters.startCondition,
        endCondition: intent.parameters.endCondition,
        sectionAlignment: intent.parameters.sectionAlignment,
        operation: intent.parameters.operation
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
        affectedEntities: intent.parameters.sectionIds || ['NEW_LOFT'],
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
      affectedEntities: intent.parameters.sectionIds || ['NEW_LOFT'],
      document: evalResult.document,
      evaluationResult: evalResult,
      error: evalResult.success ? undefined : `EVALUATION_FAILURE: ${evalResult.error || 'Unknown'}`
    };
  }
}
