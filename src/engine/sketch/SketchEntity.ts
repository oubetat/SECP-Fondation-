/**
 * SECP CAD Kernel — Sketch Entity
 * Phase 2 (PATCH-024)
 */

import { EngineeringIdentity } from '../identity/CanonicalEngineeringIdentity';
import { ProvenanceNode } from '../provenance/ProvenanceGraphTypes';
import { SketchGeometry } from './SketchGeometry';

export type SketchEntityType =
  | 'POINT'
  | 'LINE'
  | 'ARC'
  | 'CIRCLE'
  | 'ELLIPSE'
  | 'POLYLINE'
  | 'SPLINE';

export interface SketchEntityMetadata {
  readonly [key: string]: string | number | boolean | null | undefined;
}

/**
 * Sketch Entity Domain Model
 */
export interface SketchEntity {
  readonly id: EngineeringIdentity;
  readonly type: SketchEntityType;
  readonly sketchId: EngineeringIdentity;
  readonly construction: boolean;
  readonly geometry: SketchGeometry;
  readonly metadata: SketchEntityMetadata;
  readonly provenance: ProvenanceNode;
}
