/**
 * PROMPT-028: Draft Tool 277
 */

import { DraftIntent } from './EngineeringIntent277';
import { SelectionReference } from './SelectionTypes277';

export interface DraftToolParams {
  angle?: number;
  draftAngle?: number;
  targetFaceRef?: SelectionReference;
  targetFaceId?: string;
  neutralPlaneRef?: SelectionReference;
  pullDirection?: { x: number; y: number; z: number };
  propagation?: 'NONE' | 'TANGENT' | 'ALL_FACES';
  targetSolidId?: string;
}

export class DraftTool277 {
  public createIntent(documentId: string, params: DraftToolParams): DraftIntent {
    return {
      intentId: `INTENT_DRAFT_${Date.now()}`,
      toolId: 'FEATURE_DRAFT',
      documentId,
      selection: params.targetFaceRef ? [params.targetFaceRef] : [],
      parameters: {
        angle: params.angle ?? params.draftAngle ?? 3,
        draftAngle: params.draftAngle ?? params.angle ?? 3,
        targetFaceRef: params.targetFaceRef,
        targetFaceId: params.targetFaceId,
        neutralPlaneRef: params.neutralPlaneRef,
        pullDirection: params.pullDirection,
        propagation: params.propagation,
        targetSolidId: params.targetSolidId
      },
      timestamp: new Date().toISOString()
    };
  }
}
