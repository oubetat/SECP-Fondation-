/**
 * SECP CAD Kernel — GCS 3D Constraint Model
 * Phase 2 (PATCH-026)
 */

import { EngineeringIdentity } from '../identity/CanonicalEngineeringIdentity';
import { ProvenanceNode } from '../provenance/ProvenanceGraphTypes';
import { Constraint3DType, Constraint3DParameters } from './Constraint3DTypes';
import { Constraint3DReference } from './Constraint3DReference';

/**
 * 3D Geometric Constraint representation.
 */
export interface Constraint3D {
  readonly id: EngineeringIdentity;
  readonly type: Constraint3DType;
  readonly modelId: EngineeringIdentity;
  readonly references: readonly Constraint3DReference[];
  readonly parameters: Constraint3DParameters;
  readonly driving: boolean;
  readonly provenance: ProvenanceNode;
}
