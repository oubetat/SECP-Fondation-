/**
 * SECP CAD Kernel — Modeling Result & Revision Contract
 * Phase 2 (PATCH-029)
 */

import { ModelingMode } from './ModelingMode';

export type ModelingStatus =
  | 'SUCCESS'
  | 'FAILED'
  | 'ROLLBACK'
  | 'UNSUPPORTED'
  | 'CONFLICT'
  | 'PARAMETRIC_INVALIDATED'
  | 'REGENERATION_REQUIRED'
  | 'UNPROVEN';

export type DirectEditClassification =
  | 'DIRECT_COMPATIBLE'
  | 'PARAMETRIC_PRESERVED'
  | 'PARAMETRIC_INVALIDATED'
  | 'REGENERATION_REQUIRED'
  | 'CONFLICT'
  | 'UNSUPPORTED';

export interface ModelRevision {
  revisionId: string;
  parentRevisionId: string | null;
  modelingMode: ModelingMode;
  operationId: string;
  geometryHashBefore: string;
  geometryHashAfter: string;
  topologyHashBefore: string;
  topologyHashAfter: string;
  dependencyImpact: string[];
  regenerationStatus: string;
  validationStatus: string;
  timestamp: string;
  evidenceHash?: string;
  evidenceId?: string;
}

export interface ModelingResult {
  operationId: string;
  status: ModelingStatus;
  mode: ModelingMode;
  classification?: DirectEditClassification;
  revision?: ModelRevision;
  diagnostics: string[];
  invalidatedFeatureIds?: string[];
  convertedFeatureId?: string;
  activeShape?: any;
  evidenceId?: string;
  timestamp: string;
}
