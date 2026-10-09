/**
 * SECP CAD Kernel — Direct Edit Contract
 * Phase 2 (PATCH-029)
 */

export type DirectOperationType =
  | 'MOVE_FACE'
  | 'OFFSET_FACE'
  | 'DELETE_FACE'
  | 'REPLACE_FACE'
  | 'MOVE_VERTEX'
  | 'MOVE_EDGE'
  | 'TRANSFORM_BODY'
  | 'TRANSFORM_FACE_SET';

export interface DirectEdit {
  id: string;
  operation: DirectOperationType;
  targetEntityIds: string[];
  parameters: Record<string, any>;
  beforeGeometryHash: string;
  afterGeometryHash: string;
  affectedTopologyIds: string[];
  tolerance: number;
  timestamp: string;
  parentRevision: string;
}
