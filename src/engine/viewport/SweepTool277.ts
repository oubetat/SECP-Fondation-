/**
 * PROMPT-024: Sweep Engineering Tool
 * Implements the canonical tool contract for profile sweeping along 3D curves.
 */

import { EngineeringTool } from './EngineeringTool277';
import { AnyEngineeringIntent, DispatchResult, SweepIntent } from './EngineeringIntent277';
import { EngineeringDocument } from '../cad-kernel/document/CADDocument';
import { CanonicalIntentDispatcher277 } from './CanonicalIntentDispatcher277';

export class SweepTool277 implements EngineeringTool {
  public readonly toolId = 'FEATURE_SWEEP';

  public async execute(intent: AnyEngineeringIntent, document: EngineeringDocument): Promise<DispatchResult> {
    if (intent.toolId !== this.toolId) {
      return {
        success: false,
        documentId: document.documentId,
        revision: typeof document.revision === 'string' ? parseInt(document.revision, 10) : document.revision,
        canonicalActionId: 'NONE',
        affectedEntities: [],
        error: `TOOL_MISMATCH: SweepTool cannot execute ${intent.toolId}`
      };
    }

    return CanonicalIntentDispatcher277.dispatch(intent, document);
  }

  public createIntent(
    docId: string, 
    sketchId: string, 
    pathPoints?: Array<{ x: number; y: number; z?: number }>,
    options: {
      orientation?: 'FOLLOW_PATH' | 'FIXED' | 'NORMAL_TO_PATH' | 'REFERENCE_BASED';
      twistAngleDeg?: number;
      guideCurves?: Array<Array<{ x: number; y: number; z?: number }>>;
      operation?: 'NEW' | 'JOIN' | 'CUT' | 'INTERSECT';
      scale?: number;
    } = {}
  ): SweepIntent {
    return {
      intentId: `INTENT_SWEEP_${Math.random().toString(36).substr(2, 9)}`,
      toolId: this.toolId,
      documentId: docId,
      parameters: {
        sketchId,
        pathPoints,
        orientation: options.orientation || 'FOLLOW_PATH',
        twistAngleDeg: options.twistAngleDeg ?? 0,
        guideCurves: options.guideCurves,
        operation: options.operation || 'NEW',
        scale: options.scale
      },
      timestamp: new Date().toISOString()
    };
  }
}
