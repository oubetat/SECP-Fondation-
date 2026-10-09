/**
 * SECP CAD Kernel — Modeling Operation
 * Phase 2 (PATCH-029)
 */

import { DirectEdit } from './DirectEdit';
import { ParametricEdit } from './ParametricEdit';

export type OperationType =
  | 'DIRECT'
  | 'PARAMETRIC'
  | 'PARAMETRIC_TO_DIRECT'
  | 'DIRECT_TO_PARAMETRIC';

export interface ModelingOperation {
  operationId: string;
  type: OperationType;
  directEdit?: DirectEdit;
  parametricEdit?: ParametricEdit;
  scope?: string[];
  metadata?: Record<string, any>;
  timestamp: string;
}
