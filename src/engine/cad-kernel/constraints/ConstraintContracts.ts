/**
 * SECP CAD Kernel — Constraints
 */

export type ConstraintType = 
  | 'COINCIDENT' | 'DISTANCE' | 'HORIZONTAL' | 'VERTICAL'
  | 'PARALLEL' | 'PERPENDICULAR' | 'TANGENT' | 'CONCENTRIC'
  | 'EQUAL' | 'ANGLE' | 'RADIUS' | 'DIAMETER';

export interface ConstraintEntityRef {
  topologyId: string;
}

export interface Constraint {
  id: string;
  type: ConstraintType;
  entities: ConstraintEntityRef[];
  value?: number;
}

export interface ConstraintSystem {
  constraints: Constraint[];
  isFullyConstrained(): boolean;
}
