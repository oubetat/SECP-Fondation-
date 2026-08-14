export type SketchEntityType = 'POINT' | 'LINE' | 'ARC' | 'CIRCLE';
export type ConstraintType = 'COINCIDENT' | 'DISTANCE' | 'HORIZONTAL' | 'VERTICAL' | 'PARALLEL' | 'PERPENDICULAR' | 'TANGENT';

export interface Vector2 {
  x: number;
  y: number;
}

export interface SketchPoint {
  id: string;
  type: 'POINT';
  position: Vector2;
  isFixed?: boolean;
}

export interface SketchLine {
  id: string;
  type: 'LINE';
  startPointId: string;
  endPointId: string;
}

export interface SketchArc {
  id: string;
  type: 'ARC';
  centerPointId: string;
  startPointId: string;
  endPointId: string;
  radius: number;
}

export interface SketchCircle {
  id: string;
  type: 'CIRCLE';
  centerPointId: string;
  radius: number;
}

export type SketchEntity = SketchPoint | SketchLine | SketchArc | SketchCircle;

export interface SketchConstraint {
  id: string;
  type: ConstraintType;
  entityIds: string[]; // IDs of the points or entities involved
  value?: number; // Used for DISTANCE, ANGLE, etc. (Dimensions)
}

export interface SketchSolverState {
  dof: number;
  isFullyConstrained: boolean;
  isOverConstrained: boolean;
  errors: string[];
}

export interface SketchDefinition {
  id: string;
  name: string;
  plane: 'XY' | 'YZ' | 'XZ';
  entities: Record<string, SketchEntity>;
  constraints: Record<string, SketchConstraint>;
  solverState?: SketchSolverState;
}
