/**
 * PROMPT-028: Shell Tool 277
 */

import { ShellIntent } from './EngineeringIntent277';
import { SelectionReference } from './SelectionTypes277';

export interface ShellToolParams {
  thickness: number;
  removedFaceRef?: SelectionReference;
  removedFaceId?: string;
  direction?: 'INSIDE' | 'OUTSIDE' | 'BOTH';
  targetSolidId?: string;
}

export class ShellTool277 {
  public createIntent(documentId: string, params: ShellToolParams): ShellIntent {
    return {
      intentId: `INTENT_SHELL_${Date.now()}`,
      toolId: 'FEATURE_SHELL',
      documentId,
      selection: params.removedFaceRef ? [params.removedFaceRef] : [],
      parameters: {
        thickness: params.thickness,
        removedFaceRef: params.removedFaceRef,
        removedFaceId: params.removedFaceId,
        direction: params.direction,
        targetSolidId: params.targetSolidId
      },
      timestamp: new Date().toISOString()
    };
  }
}
