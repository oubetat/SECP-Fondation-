/**
 * SECP CAD Kernel — GCS Constraint Model
 * Phase 2 (PATCH-025)
 */

import { EngineeringIdentity } from '../../identity/CanonicalEngineeringIdentity';
import { ProvenanceNode } from '../../provenance/ProvenanceGraphTypes';
import { 
  SketchConstraintType, 
  ConstraintReference, 
  ConstraintParameters 
} from './ConstraintTypes';

/**
 * Sketch Constraint Domain Model
 */
export interface SketchConstraint {
  readonly id: EngineeringIdentity;
  readonly type: SketchConstraintType;
  readonly sketchId: EngineeringIdentity;
  readonly references: readonly ConstraintReference[];
  readonly parameters: ConstraintParameters;
  readonly driving: boolean;
  readonly provenance: ProvenanceNode;
}
