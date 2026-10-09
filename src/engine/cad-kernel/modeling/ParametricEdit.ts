/**
 * SECP CAD Kernel — Parametric Edit Contract
 * Phase 2 (PATCH-029)
 */

export type ParametricOperationType =
  | 'CREATE_FEATURE'
  | 'MODIFY_PARAMETERS'
  | 'SUPPRESS_FEATURE'
  | 'UNSUPPRESS_FEATURE'
  | 'REORDER_FEATURE'
  | 'REGENERATE_CHAIN';

export interface ParametricEdit {
  id: string;
  operation: ParametricOperationType;
  featureId: string;
  featureType?: string;
  parameterChanges?: Record<string, any>;
  inputReferences?: any[];
  dependencies: string[];
  affectedEntities: string[];
  regenerationResult?: any;
  timestamp: string;
}
