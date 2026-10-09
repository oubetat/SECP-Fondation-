/**
 * PATCH-SECP-PROMPT-013: Canonical Action Contract
 * Defines the standard execution interface for engineering mutations.
 */

import { EngineeringDocument } from '../cad-kernel/document/CADDocument';
import { AnyEngineeringIntent, DispatchResult } from './EngineeringIntent277';

export interface CanonicalAction<T extends AnyEngineeringIntent = AnyEngineeringIntent> {
  readonly actionId: string;
  
  /**
   * Executes a canonical mutation on the EngineeringDocument.
   * MUST produce a new revision and trigger evaluation.
   */
  execute(intent: T, document: EngineeringDocument): Promise<DispatchResult>;
}

/**
 * Success Matrix Verification Logic
 * Validates that an action execution truly meets canonical success criteria.
 */
export function verifyCanonicalSuccess(result: DispatchResult): boolean {
  return (
    result.success === true &&
    result.revision > 0 &&
    result.documentId !== '' &&
    result.evaluationResult !== undefined &&
    result.evaluationResult.success === true
  );
}
