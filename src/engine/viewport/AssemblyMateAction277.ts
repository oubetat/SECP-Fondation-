/**
 * PATCH-SECP-PROMPT-013: Assembly Mate Canonical Action
 * Implementation of formal assembly constraint mutation.
 */

import { EngineeringDocument } from '../cad-kernel/document/CADDocument';
import { AssemblyIntentMutator, AssemblyIntentAction } from '../cad-kernel/document/AssemblyIntentMutator';
import { DocumentEvaluator } from '../cad-kernel/document/DocumentEvaluator';
import { AssemblyMateIntent, DispatchResult } from './EngineeringIntent277';
import { CanonicalAction } from './CanonicalAction277';

export class AssemblyMateAction277 implements CanonicalAction<AssemblyMateIntent> {
  public readonly actionId = 'AssemblyIntentMutator.apply';

  public async execute(intent: AssemblyMateIntent, document: EngineeringDocument): Promise<DispatchResult> {
    const action: AssemblyIntentAction = {
      type: 'ADD_MATE',
      mate: {
        mateId: (intent.parameters as any).mateId || 'MATE-1',
        type: 'COINCIDENT',
        instanceAId: intent.parameters.instanceAId,
        instanceBId: intent.parameters.instanceBId,
        entityA: {
          occurrencePath: intent.parameters.instanceAId,
          entityType: (intent.parameters.entityA.referenceType as string) as any,
          entityId: intent.parameters.entityA.persistentId
        },
        entityB: {
          occurrencePath: intent.parameters.instanceBId,
          entityType: (intent.parameters.entityB.referenceType as string) as any,
          entityId: intent.parameters.entityB.persistentId
        }
      }
    };

    // 1. Mutate
    const updatedDoc = AssemblyIntentMutator.apply(document, action);
    
    // 2. Evaluate
    const evalResult = DocumentEvaluator.evaluate(updatedDoc);

    // 3. Result
    return {
      success: evalResult.success,
      documentId: evalResult.document.documentId,
      revision: typeof evalResult.document.revision === 'string' 
        ? parseInt(evalResult.document.revision, 10) 
        : evalResult.document.revision,
      canonicalActionId: this.actionId,
      affectedEntities: [intent.parameters.instanceAId, intent.parameters.instanceBId],
      document: evalResult.document,
      evaluationResult: evalResult,
      error: evalResult.success ? undefined : `EVALUATION_FAILURE: ${evalResult.error || evalResult.diagnostics.join('; ') || 'Unknown'}`
    };
  }
}
