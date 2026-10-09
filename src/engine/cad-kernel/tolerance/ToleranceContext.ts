/**
 * SECP CAD Kernel — Tolerance Context
 * Phase 2 (PATCH-021)
 */

import { UnitCategory } from '../../units';

export enum ToleranceOperation {
  POINT_COMPARISON = 'POINT_COMPARISON',
  DISTANCE = 'DISTANCE',
  ANGLE = 'ANGLE',
  COINCIDENCE = 'COINCIDENCE',
  EDGE_VERTEX = 'EDGE_VERTEX',
  EDGE_EDGE = 'EDGE_EDGE',
  FACE_EDGE = 'FACE_EDGE',
  FACE_FACE = 'FACE_FACE',
  SEWING = 'SEWING',
  BOOLEAN = 'BOOLEAN',
  INTERSECTION = 'INTERSECTION',
  PROJECTION = 'PROJECTION',
  NURBS_EVALUATION = 'NURBS_EVALUATION',
  NURBS_APPROXIMATION = 'NURBS_APPROXIMATION',
  TOPOLOGY_HEALING = 'TOPOLOGY_HEALING',
  UNKNOWN = 'UNKNOWN'
}

export interface ToleranceContext {
  operation: ToleranceOperation;
  geometryScale: number;
  unitSystem: string;
  modelIdentifier?: string;
  operationIdentifier?: string;
  requestedTolerance: number;
  effectiveTolerance?: number;
  policy?: string;
  source?: string;
  auditMetadata?: Record<string, any>;
}
