/**
 * SECP CAD Kernel — GCS 3D Constraint References
 * Phase 2 (PATCH-026)
 */

import { EngineeringIdentity } from '../identity/CanonicalEngineeringIdentity';

export type Constraint3DTargetType =
  | 'ENTITY'
  | 'ORIGIN'
  | 'DIRECTION'
  | 'CENTER'
  | 'NORMAL'
  | 'RADIUS';

export interface Constraint3DReference {
  readonly entityId: EngineeringIdentity;
  readonly target: Constraint3DTargetType;
}
