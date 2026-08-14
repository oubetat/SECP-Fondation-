/**
 * SECP-053 Industrial Constraint & Sketch Solver Types
 */

export type IndustrialConstraintType =
  | 'COINCIDENT'
  | 'HORIZONTAL'
  | 'VERTICAL'
  | 'PARALLEL'
  | 'PERPENDICULAR'
  | 'TANGENT'
  | 'CONCENTRIC'
  | 'EQUAL'
  | 'SYMMETRIC'
  | 'DISTANCE'
  | 'ANGLE'
  | 'RADIUS'
  | 'DIAMETER';

export type SolverSolutionState =
  | 'UNDER_CONSTRAINED'
  | 'FULLY_CONSTRAINED'
  | 'OVER_CONSTRAINED'
  | 'INCONSISTENT'
  | 'SOLVED';

export interface Vector2D {
  x: number;
  y: number;
}

export interface SketchPoint2D {
  id: string;
  type: 'POINT';
  x: number;
  y: number;
  isFixed?: boolean;
}

export interface SketchLine2D {
  id: string;
  type: 'LINE';
  startPointId: string;
  endPointId: string;
}

export interface SketchArc2D {
  id: string;
  type: 'ARC';
  centerPointId: string;
  startPointId: string;
  endPointId: string;
  radius: number;
}

export interface SketchCircle2D {
  id: string;
  type: 'CIRCLE';
  centerPointId: string;
  radius: number;
}

export type IndustrialSketchEntity = SketchPoint2D | SketchLine2D | SketchArc2D | SketchCircle2D;

export interface IndustrialSketchConstraint {
  id: string;
  type: IndustrialConstraintType;
  entityIds: string[];        // IDs of points or entities involved
  expression?: string;        // e.g., "W / 2" or "100"
  value?: number;             // Evaluated numerical value
  unit?: string;              // e.g., "mm" or "deg"
  isDriving?: boolean;        // Default true
  suppressionState?: 'ACTIVE' | 'SUPPRESSED';
  parameterBinding?: string;  // Bound global parameter name in ParameterGraph
}

export interface ConstraintCausalityNode {
  constraintId: string;
  type: IndustrialConstraintType;
  conflictingEntityIds: string[];
  reason: string;
  causedByConstraintIds: string[];
}

export interface ConstraintCausalityReport {
  isConflict: boolean;
  conflictSet: string[]; // List of constraint IDs involved in conflict
  causalChains: ConstraintCausalityNode[];
  explanation: string;
}

export interface SketchDOFReport {
  totalDegreesOfFreedom: number;
  constrainedDegreesOfFreedom: number;
  remainingDegreesOfFreedom: number;
  state: SolverSolutionState;
  redundantConstraintIds: string[];
  conflictingConstraintIds: string[];
}

export interface IncrementalSolveStats {
  totalConstraints: number;
  affectedSubGraphConstraintCount: number;
  solveTimeMs: number;
  isIncremental: boolean;
}

export interface SolverProvenanceRecord {
  systemVersion: string;
  timestamp: string;
  sketchRevision: number;
  constraintGraphHash: string;
  parameterRevision: number;
  solverVersion: string;
  tolerance: number;
  solutionState: SolverSolutionState;
  degreesOfFreedom: number;
  conflictSet: string[];
  resultHash: string;
  signature: string;
}

export interface IndustrialSketchDefinition {
  id: string;
  name: string;
  plane: 'XY' | 'YZ' | 'XZ';
  revision: number;
  entities: Record<string, IndustrialSketchEntity>;
  constraints: Record<string, IndustrialSketchConstraint>;
}
