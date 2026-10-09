/**
 * PATCH-SECP-PROMPT-012: Assembly Mate Engineering Tool
 * Implements the canonical tool contract for assembly constraints.
 */

import { EngineeringTool } from './EngineeringTool277';
import { AnyEngineeringIntent, DispatchResult, AssemblyMateIntent } from './EngineeringIntent277';
import { EngineeringDocument } from '../cad-kernel/document/CADDocument';
import { CanonicalIntentDispatcher277 } from './CanonicalIntentDispatcher277';
import { SelectionReference } from './SelectionTypes277';

export class AssemblyMateTool277 implements EngineeringTool {
  public readonly toolId = 'ASSEMBLY_MATE_COINCIDENT';

  public async execute(intent: AnyEngineeringIntent, document: EngineeringDocument): Promise<DispatchResult> {
    if (intent.toolId !== this.toolId) {
       return {
         success: false,
         documentId: document.documentId,
         revision: typeof document.revision === 'string' ? parseInt(document.revision, 10) : document.revision,
         canonicalActionId: 'NONE',
         affectedEntities: [],
         error: `TOOL_MISMATCH: AssemblyMateTool cannot execute ${intent.toolId}`
       };
    }

    return CanonicalIntentDispatcher277.dispatch(intent, document);
  }

  /**
   * Creates a formal Assembly Mate Intent using PROMPT-010 SelectionReferences.
   */
  public createIntent(
    docId: string,
    instanceAId: string,
    instanceBId: string,
    entityA: SelectionReference,
    entityB: SelectionReference
  ): AssemblyMateIntent {
    return {
      intentId: `INTENT_MATE_${Math.random().toString(36).substr(2, 9)}`,
      toolId: this.toolId,
      documentId: docId,
      selection: [entityA, entityB],
      parameters: {
        instanceAId,
        instanceBId,
        entityA,
        entityB
      },
      timestamp: new Date().toISOString()
    };
  }
}
