/**
 * PATCH-SECP-PROMPT-012: Engineering Tool Contract
 * Every design tool in SECP must implement this contract to participate 
 * in the canonical intent dispatch pipeline.
 */

import { AnyEngineeringIntent, DispatchResult } from './EngineeringIntent277';
import { EngineeringDocument } from '../cad-kernel/document/CADDocument';

export interface EngineeringTool {
  readonly toolId: string;
  
  /**
   * Orchestrates the execution of a user intent.
   * Tool is responsible for creating the Intent object and passing it to the Dispatcher.
   */
  execute(intent: AnyEngineeringIntent, document: EngineeringDocument): Promise<DispatchResult>;
}
