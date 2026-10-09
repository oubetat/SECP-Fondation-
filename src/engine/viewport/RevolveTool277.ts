/**
 * PATCH-SECP-PROMPT-013: Revolve Engineering Tool
 * Implements the canonical tool contract for rotational geometry.
 */

import { EngineeringTool } from './EngineeringTool277';
import { AnyEngineeringIntent, DispatchResult, RevolveIntent } from './EngineeringIntent277';
import { EngineeringDocument } from '../cad-kernel/document/CADDocument';
import { CanonicalIntentDispatcher277 } from './CanonicalIntentDispatcher277';

export class RevolveTool277 implements EngineeringTool {
  public readonly toolId = 'FEATURE_REVOLVE';

  public async execute(intent: AnyEngineeringIntent, document: EngineeringDocument): Promise<DispatchResult> {
    if (intent.toolId !== this.toolId) {
       return {
         success: false,
         documentId: document.documentId,
         revision: typeof document.revision === 'string' ? parseInt(document.revision, 10) : document.revision,
         canonicalActionId: 'NONE',
         affectedEntities: [],
         error: `TOOL_MISMATCH: RevolveTool cannot execute ${intent.toolId}`
       };
    }

    return CanonicalIntentDispatcher277.dispatch(intent, document);
  }

  public createIntent(
    docId: string, 
    sketchId: string, 
    angle: number, 
    axis: { x: number; y: number; z: number } = { x: 1, y: 0, z: 0 },
    operation: 'NEW' | 'JOIN' | 'CUT' | 'INTERSECT' = 'NEW'
  ): RevolveIntent {
    return {
      intentId: `INTENT_REVOLVE_${Math.random().toString(36).substr(2, 9)}`,
      toolId: this.toolId,
      documentId: docId,
      parameters: {
        sketchId,
        angle,
        axis,
        operation
      },
      timestamp: new Date().toISOString()
    };
  }
}
