/**
 * PROMPT-028: Rib Tool 277
 */

import { RibIntent } from './EngineeringIntent277';
import { SelectionReference } from './SelectionTypes277';

export interface RibToolParams {
  thickness: number;
  profileRef?: SelectionReference;
  profileId?: string;
  sketchId?: string;
  supportFaceRef?: SelectionReference;
  direction?: 'MIDPLANE' | 'SIDE1' | 'SIDE2' | { x: number; y: number; z: number };
  termination?: 'UP_TO_NEXT' | 'UP_TO_FACE' | 'THROUGH';
  targetSolidId?: string;
}

export class RibTool277 {
  public createIntent(documentId: string, params: RibToolParams): RibIntent {
    return {
      intentId: `INTENT_RIB_${Date.now()}`,
      toolId: 'FEATURE_RIB',
      documentId,
      selection: params.profileRef ? [params.profileRef] : [],
      parameters: {
        thickness: params.thickness,
        profileRef: params.profileRef,
        profileId: params.profileId,
        sketchId: params.sketchId,
        supportFaceRef: params.supportFaceRef,
        direction: params.direction,
        termination: params.termination,
        targetSolidId: params.targetSolidId
      },
      timestamp: new Date().toISOString()
    };
  }
}
