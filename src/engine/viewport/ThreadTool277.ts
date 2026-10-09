/**
 * PROMPT-027: Thread Engineering Tool
 * Implements the canonical tool contract for Threads.
 */

import { EngineeringTool } from './EngineeringTool277';
import { AnyEngineeringIntent, DispatchResult, ThreadIntent } from './EngineeringIntent277';
import { EngineeringDocument } from '../cad-kernel/document/CADDocument';
import { CanonicalIntentDispatcher277 } from './CanonicalIntentDispatcher277';
import { SelectionReference } from './SelectionTypes277';
import { ThreadSpecification } from '../cad-kernel/history/FeatureDefinition';

export class ThreadTool277 implements EngineeringTool {
  public readonly toolId = 'FEATURE_THREAD';

  public async execute(intent: AnyEngineeringIntent, document: EngineeringDocument): Promise<DispatchResult> {
    if (intent.toolId !== this.toolId) {
      return {
        success: false,
        documentId: document.documentId,
        revision: typeof document.revision === 'string' ? parseInt(document.revision, 10) : document.revision,
        canonicalActionId: 'NONE',
        affectedEntities: [],
        error: `TOOL_MISMATCH: ThreadTool cannot execute ${intent.toolId}`
      };
    }

    return CanonicalIntentDispatcher277.dispatch(intent, document);
  }

  public createIntent(
    docId: string,
    params: {
      threadSpec: ThreadSpecification;
      depth?: number;
      center?: { x: number; y: number; z?: number };
      position?: { x: number; y: number; z?: number };
      targetFaceRef?: SelectionReference;
      targetFaceId?: string;
      isInternal?: boolean;
      operation?: 'CUT' | 'NEW' | 'JOIN';
    }
  ): ThreadIntent {
    return {
      intentId: `INTENT_THREAD_${Math.random().toString(36).substr(2, 9)}`,
      toolId: this.toolId,
      documentId: docId,
      timestamp: new Date().toISOString(),
      parameters: {
        threadSpec: params.threadSpec,
        depth: params.depth ?? 15,
        center: params.center,
        position: params.position,
        targetFaceRef: params.targetFaceRef,
        targetFaceId: params.targetFaceId,
        isInternal: params.isInternal ?? true,
        operation: params.operation || 'CUT'
      }
    };
  }
}
