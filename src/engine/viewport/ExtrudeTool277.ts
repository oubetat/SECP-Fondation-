/**
 * PATCH-SECP-PROMPT-012: Extrude Engineering Tool
 * Implements the canonical tool contract for solid extrusion.
 */

import { EngineeringTool } from './EngineeringTool277';
import { AnyEngineeringIntent, DispatchResult, ExtrudeIntent } from './EngineeringIntent277';
import { EngineeringDocument } from '../cad-kernel/document/CADDocument';
import { CanonicalIntentDispatcher277 } from './CanonicalIntentDispatcher277';
import { SelectionReference } from './SelectionTypes277';

export class ExtrudeTool277 implements EngineeringTool {
  public readonly toolId = 'FEATURE_EXTRUDE';

  public async execute(intent: AnyEngineeringIntent, document: EngineeringDocument): Promise<DispatchResult> {
    if (intent.toolId !== this.toolId) {
       return {
         success: false,
         documentId: document.documentId,
         revision: typeof document.revision === 'string' ? parseInt(document.revision, 10) : document.revision,
         canonicalActionId: 'NONE',
         affectedEntities: [],
         error: `TOOL_MISMATCH: ExtrudeTool cannot execute ${intent.toolId}`
       };
    }

    return CanonicalIntentDispatcher277.dispatch(intent, document);
  }

  /**
   * Creates a formal Extrude Intent.
   * Ensures that UI parameters are encapsulated before dispatching.
   */
  public createIntent(
    docId: string, 
    sketchId: string, 
    depth: number, 
    selection?: SelectionReference[],
    operation: 'NEW' | 'JOIN' | 'CUT' | 'INTERSECT' = 'NEW'
  ): ExtrudeIntent {
    return {
      intentId: `INTENT_EXTRUDE_${Math.random().toString(36).substr(2, 9)}`,
      toolId: this.toolId,
      documentId: docId,
      selection: selection,
      parameters: {
        sketchId,
        depth,
        operation
      },
      timestamp: new Date().toISOString()
    };
  }
}
