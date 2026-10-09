/**
 * SECP-053 Industrial Constraint & Sketch Solver Types
 */

import { SelectionReference } from '../viewport/SelectionTypes277';

export type IndustrialConstraintType =
  | 'FIX'
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
  | 'DIAMETER'
  | 'MIDPOINT';

export type SolverSolutionState =
  | 'UNDER_CONSTRAINED'
  | 'FULLY_CONSTRAINED'
  | 'OVER_CONSTRAINED'
  | 'INCONSISTENT'
  | 'CONFLICTING'
  | 'REDUNDANT'
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
  isConstruction?: boolean;
  groupId?: string;
  tag?: string;
}

export interface SketchLine2D {
  id: string;
  type: 'LINE';
  startPointId: string;
  endPointId: string;
  isConstruction?: boolean;
  isCenterline?: boolean;
  groupId?: string;
  tag?: string;
}

export interface SketchArc2D {
  id: string;
  type: 'ARC';
  centerPointId: string;
  startPointId: string;
  endPointId: string;
  radius: number;
  direction?: 'CW' | 'CCW';
  startAngle?: number;
  endAngle?: number;
  isConstruction?: boolean;
  groupId?: string;
  tag?: string;
}

export interface SketchCircle2D {
  id: string;
  type: 'CIRCLE';
  centerPointId: string;
  radius: number;
  isConstruction?: boolean;
  groupId?: string;
  tag?: string;
}

export interface SketchEllipse2D {
  id: string;
  type: 'ELLIPSE';
  centerPointId: string;
  majorRadius: number;
  minorRadius: number;
  rotation?: number; // in radians
  isConstruction?: boolean;
  groupId?: string;
  tag?: string;
}

export interface SketchSpline2D {
  id: string;
  type: 'SPLINE';
  controlPointIds: string[];
  degree: number;
  isConstruction?: boolean;
  groupId?: string;
  tag?: string;
}

export type IndustrialSketchEntity = (SketchPoint2D | SketchLine2D | SketchArc2D | SketchCircle2D | SketchEllipse2D | SketchSpline2D) & {
  points?: { x: number; y: number; z?: number }[];
};

export interface IndustrialSketchConstraint {
  id: string;
  type: IndustrialConstraintType;
  entityIds: string[];        // IDs of points or entities involved
  references?: SelectionReference[]; // Canonical references
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

import { SketchDimension } from './dimensions/SketchDimensionTypes';

export interface IndustrialSketchDefinition {
  id: string;
  name: string;
  plane: 'XY' | 'YZ' | 'XZ';
  revision: number;
  entities: Record<string, IndustrialSketchEntity>;
  constraints: Record<string, IndustrialSketchConstraint>;
  dimensions?: Record<string, SketchDimension>;
  mirrors?: any[];
  patterns?: any[];
}
