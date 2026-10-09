/**
 * SECP CAD Kernel — Sketch Model
 * Phase 2 (PATCH-024)
 */

import { EngineeringIdentity } from '../identity/CanonicalEngineeringIdentity';
import { ProvenanceNode } from '../provenance/ProvenanceGraphTypes';
import { SketchEntity } from './SketchEntity';
import { SketchCoordinateSystem } from './SketchCoordinateSystem';
import { ToleranceModel } from '../cad-kernel/tolerance/ToleranceModel';
import { IndustrialConstraintType } from './IndustrialConstraintTypes';

/**
 * Lightweight reference to a constraint for future solving.
 */
export interface SketchConstraintReference {
  readonly id: EngineeringIdentity;
  readonly type: IndustrialConstraintType;
  readonly entityIds: readonly EngineeringIdentity[];
  readonly value?: number;
  readonly expression?: string;
  readonly unit?: string;
}

/**
 * Full Sketch Domain Model
 */
export interface SketchModel {
  readonly id: EngineeringIdentity;
  readonly name: string;
  readonly coordinateSystem: SketchCoordinateSystem;
  readonly entities: readonly SketchEntity[];
  readonly constraints: readonly SketchConstraintReference[];
  readonly version: number;
  readonly units: string;
  readonly tolerance: ToleranceModel;
  readonly provenance: ProvenanceNode;
  readonly metadata: Readonly<Record<string, unknown>>;
}
