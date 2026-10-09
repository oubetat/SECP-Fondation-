/**
 * PROMPT-028: Thin Tool 277
 */

import { ThinIntent } from './EngineeringIntent277';
import { SelectionReference } from './SelectionTypes277';

export interface ThinToolParams {
  thickness: number;
  targetRef?: SelectionReference;
  sketchId?: string;
  direction?: 'INSIDE' | 'OUTSIDE' | 'SYMMETRIC';
  side?: 'INSIDE' | 'OUTSIDE' | 'SYMMETRIC';
  termination?: 'THROUGH' | 'BLIND';
  depth?: number;
  targetSolidId?: string;
}

export class ThinTool277 {
  public createIntent(documentId: string, params: ThinToolParams): ThinIntent {
    return {
      intentId: `INTENT_THIN_${Date.now()}`,
      toolId: 'FEATURE_THIN',
      documentId,
      selection: params.targetRef ? [params.targetRef] : [],
      parameters: {
        thickness: params.thickness,
        targetRef: params.targetRef,
        sketchId: params.sketchId,
        direction: params.direction,
        side: params.side,
        termination: params.termination,
        depth: params.depth,
        targetSolidId: params.targetSolidId
      },
      timestamp: new Date().toISOString()
    };
  }
}
