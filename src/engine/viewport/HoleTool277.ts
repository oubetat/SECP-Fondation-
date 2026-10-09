/**
 * PROMPT-027: Hole Engineering Tool
 * Implements the canonical tool contract for Holes.
 */

import { EngineeringTool } from './EngineeringTool277';
import { AnyEngineeringIntent, DispatchResult, HoleIntent } from './EngineeringIntent277';
import { EngineeringDocument } from '../cad-kernel/document/CADDocument';
import { CanonicalIntentDispatcher277 } from './CanonicalIntentDispatcher277';
import { SelectionReference } from './SelectionTypes277';
import { 
  HoleType, 
  HoleTermination, 
  ThreadSpecification, 
  CounterboreParameters, 
  CountersinkParameters 
} from '../cad-kernel/history/FeatureDefinition';

export class HoleTool277 implements EngineeringTool {
  public readonly toolId = 'FEATURE_HOLE';

  public async execute(intent: AnyEngineeringIntent, document: EngineeringDocument): Promise<DispatchResult> {
    if (intent.toolId !== this.toolId) {
      return {
        success: false,
        documentId: document.documentId,
        revision: typeof document.revision === 'string' ? parseInt(document.revision, 10) : document.revision,
        canonicalActionId: 'NONE',
        affectedEntities: [],
        error: `TOOL_MISMATCH: HoleTool cannot execute ${intent.toolId}`
      };
    }

    return CanonicalIntentDispatcher277.dispatch(intent, document);
  }

  public createIntent(
    docId: string,
    params: {
      diameter: number;
      depth?: number;
      targetFaceRef?: SelectionReference;
      targetFaceId?: string;
      position?: { x: number; y: number; z?: number };
      center?: { x: number; y: number; z?: number };
      termination?: HoleTermination;
      throughAll?: boolean;
      holeType?: HoleType;
      counterbore?: CounterboreParameters;
      countersink?: CountersinkParameters;
      taperAngleDeg?: number;
      tipAngleDeg?: number;
      threadSpec?: ThreadSpecification;
      direction?: { x: number; y: number; z: number };
      operation?: 'CUT' | 'NEW';
    }
  ): HoleIntent {
    return {
      intentId: `INTENT_HOLE_${Math.random().toString(36).substr(2, 9)}`,
      toolId: this.toolId,
      documentId: docId,
      timestamp: new Date().toISOString(),
      parameters: {
        diameter: params.diameter,
        depth: params.depth ?? 15,
        targetFaceRef: params.targetFaceRef,
        targetFaceId: params.targetFaceId,
        position: params.position,
        center: params.center,
        termination: params.termination || (params.throughAll ? 'THROUGH_ALL' : 'BLIND'),
        throughAll: params.throughAll,
        holeType: params.holeType || 'SIMPLE',
        counterbore: params.counterbore,
        countersink: params.countersink,
        taperAngleDeg: params.taperAngleDeg,
        tipAngleDeg: params.tipAngleDeg ?? 118,
        threadSpec: params.threadSpec,
        direction: params.direction,
        operation: params.operation || 'CUT'
      }
    };
  }
}
