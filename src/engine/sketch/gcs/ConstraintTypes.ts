/**
 * SECP CAD Kernel — GCS Constraint Types
 * Phase 2 (PATCH-025)
 */

import { EngineeringIdentity } from '../../identity/CanonicalEngineeringIdentity';

export type SketchConstraintType =
  | 'POINT_ON_POINT'
  | 'COINCIDENT'
  | 'HORIZONTAL'
  | 'VERTICAL'
  | 'DISTANCE'
  | 'DISTANCE_X'
  | 'DISTANCE_Y'
  | 'ANGLE'
  | 'PARALLEL'
  | 'PERPENDICULAR'
  | 'TANGENT'
  | 'EQUAL'
  | 'RADIUS'
  | 'DIAMETER'
  | 'FIX'
  | 'CONCENTRIC'
  | 'SYMMETRIC';

export type ConstraintTargetType =
  | 'ENTITY'
  | 'START_POINT'
  | 'END_POINT'
  | 'CENTER'
  | 'RADIUS'
  | 'MAJOR_AXIS'
  | 'MINOR_AXIS';

export interface ConstraintReference {
  readonly entityId: EngineeringIdentity;
  readonly target: ConstraintTargetType;
}

export interface ConstraintParameters {
  readonly value?: number;
  readonly expression?: string;
  readonly unit?: string;
}
