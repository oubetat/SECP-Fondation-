/**
 * SECP CAD Kernel — Production 3D GCS Spatial Constraint Types
 * Phase 15 (PATCH-173)
 *
 * Industrial 3D Geometric Constraint Solver (GCS) type definitions,
 * supporting 3D entity representations, multi-body kinematics, assembly mates,
 * datum references, Jacobian contributions, and conflict diagnostics.
 */

import { Point, Direction, Vector } from '../cad-kernel/geometry/GeometryContracts';
import { EngineeringIdentity } from '../identity/CanonicalEngineeringIdentity';
import { ProvenanceNode } from '../provenance/ProvenanceGraphTypes';

export type Spatial3DEntityType =
  | 'POINT_3D'
  | 'LINE_3D'
  | 'CIRCLE_3D'
  | 'ARC_3D'
  | 'PLANE'
  | 'CYLINDER'
  | 'SPHERE'
  | 'AXIS_3D'
  | 'COORDINATE_SYSTEM'
  | 'RIGID_BODY'
  | 'ASSEMBLY_COMPONENT'
  | 'DATUM_POINT'
  | 'DATUM_AXIS'
  | 'DATUM_PLANE';

export interface SpatialPoint3D {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly isFixed?: boolean;
}

export interface SpatialLine3D {
  readonly origin: Point;
  readonly direction: Direction; // Unit direction vector
  readonly length?: number;
  readonly startPointId?: string;
  readonly endPointId?: string;
}

export interface SpatialCircle3D {
  readonly center: Point;
  readonly normal: Direction;
  readonly radius: number;
}

export interface SpatialArc3D {
  readonly center: Point;
  readonly normal: Direction;
  readonly radius: number;
  readonly startAngleRad: number;
  readonly sweepAngleRad: number;
}

export interface SpatialPlane3D {
  readonly origin: Point;
  readonly normal: Direction;
  readonly xDir?: Direction;
  readonly distanceToOrigin?: number;
}

export interface SpatialCylinder3D {
  readonly origin: Point;
  readonly axisDirection: Direction;
  readonly radius: number;
  readonly height?: number;
}

export interface SpatialSphere3D {
  readonly center: Point;
  readonly radius: number;
}

export interface SpatialAxis3D {
  readonly origin: Point;
  readonly direction: Direction;
}

export interface SpatialCoordinateSystem3D {
  readonly origin: Point;
  readonly xAxis: Direction;
  readonly yAxis: Direction;
  readonly zAxis: Direction;
}

export interface SpatialRigidBody3D {
  readonly position: Point;
  readonly orientation: [number, number, number, number]; // Quaternion [w, x, y, z] or Euler [rx, ry, rz]
  readonly massKg?: number;
}

export interface SpatialAssemblyComponent3D {
  readonly componentId: string;
  readonly instanceId: string;
  readonly position: Point;
  readonly rotationEulerRad: { x: number; y: number; z: number };
  readonly isGrounded?: boolean;
}

export type SpatialEntityGeometry =
  | { readonly type: 'POINT_3D'; readonly data: SpatialPoint3D }
  | { readonly type: 'LINE_3D'; readonly data: SpatialLine3D }
  | { readonly type: 'CIRCLE_3D'; readonly data: SpatialCircle3D }
  | { readonly type: 'ARC_3D'; readonly data: SpatialArc3D }
  | { readonly type: 'PLANE'; readonly data: SpatialPlane3D }
  | { readonly type: 'CYLINDER'; readonly data: SpatialCylinder3D }
  | { readonly type: 'SPHERE'; readonly data: SpatialSphere3D }
  | { readonly type: 'AXIS_3D'; readonly data: SpatialAxis3D }
  | { readonly type: 'COORDINATE_SYSTEM'; readonly data: SpatialCoordinateSystem3D }
  | { readonly type: 'RIGID_BODY'; readonly data: SpatialRigidBody3D }
  | { readonly type: 'ASSEMBLY_COMPONENT'; readonly data: SpatialAssemblyComponent3D }
  | { readonly type: 'DATUM_POINT'; readonly data: SpatialPoint3D }
  | { readonly type: 'DATUM_AXIS'; readonly data: SpatialAxis3D }
  | { readonly type: 'DATUM_PLANE'; readonly data: SpatialPlane3D };

export interface Spatial3DEntity {
  readonly id: string;
  readonly name: string;
  readonly type: Spatial3DEntityType;
  readonly geometry: SpatialEntityGeometry;
  readonly isDatum?: boolean;
  readonly isFixed?: boolean;
  readonly parameters?: Record<string, number>;
}

export type Production3DConstraintType =
  | 'DISTANCE'
  | 'ANGLE'
  | 'COINCIDENT'
  | 'CONCENTRIC'
  | 'PARALLEL'
  | 'PERPENDICULAR'
  | 'TANGENT'
  | 'COLLINEAR'
  | 'COPLANAR'
  | 'COAXIAL'
  | 'FIX'
  | 'LOCK'
  | 'SYMMETRY'
  | 'MIDPOINT'
  | 'POINT_ON_LINE'
  | 'POINT_ON_PLANE'
  | 'LINE_ON_PLANE'
  | 'PLANE_PLANE'
  | 'AXIS_AXIS'
  | 'AXIS_PLANE'
  | 'DATUM_REFERENCE'
  | 'ASSEMBLY_MATE'
  | 'ASSEMBLY_ALIGN'
  | 'ASSEMBLY_RIGID';

export interface ProductionConstraintTarget {
  readonly entityId: string;
  readonly subTarget?: 'ORIGIN' | 'DIRECTION' | 'NORMAL' | 'CENTER' | 'RADIUS' | 'START' | 'END' | 'FACE' | 'AXIS';
}

export interface Production3DConstraint {
  readonly constraintId: string;
  readonly name?: string;
  readonly type: Production3DConstraintType;
  readonly entities: readonly ProductionConstraintTarget[];
  readonly parameters: {
    readonly value?: number;
    readonly targetDistance?: number;
    readonly targetAngleRad?: number;
    readonly targetRadius?: number;
    readonly offset?: number;
    readonly expression?: string;
    readonly unit?: string;
  };
  readonly equation?: string;
  readonly tolerance: number;
  readonly priority: number;
  readonly driving: boolean;
  readonly diagnosticMetadata?: {
    readonly description: string;
    readonly reason?: string;
    readonly group?: string;
  };
}

export type ConstraintStatus =
  | 'SATISFIED'
  | 'VIOLATED'
  | 'REDUNDANT'
  | 'CONFLICTING'
  | 'UNDER_CONSTRAINED'
  | 'INACTIVE';

export type SystemConstraintState =
  | 'UNDER_CONSTRAINED'
  | 'FULLY_CONSTRAINED'
  | 'OVER_CONSTRAINED'
  | 'CONFLICT'
  | 'SOLVING'
  | 'CONVERGED'
  | 'NON_CONVERGED';

export interface MinimalConflictSet {
  readonly conflictId: string;
  readonly conflictingConstraintIds: string[];
  readonly affectedEntityIds: string[];
  readonly explanation: string;
  readonly closureResidual?: number;
}

export interface Production3DDOFReport {
  readonly initialDOF: number;
  readonly totalEquations: number;
  readonly independentConstraintRank: number;
  readonly redundantConstraintCount: number;
  readonly remainingDOF: number;
  readonly status: SystemConstraintState;
  readonly entityBreakdown: {
    readonly entityId: string;
    readonly entityType: Spatial3DEntityType;
    readonly initialDOF: number;
    readonly constrainedDOF: number;
    readonly remainingDOF: number;
  }[];
}

export interface Production3DSolverOptions {
  readonly maxIterations?: number;
  readonly tolerance?: number;
  readonly dampingFactor?: number;
  readonly lineSearchEnabled?: boolean;
  readonly regularizeSingularJacobian?: boolean;
  readonly timeoutMs?: number;
}

export interface Production3DSolverResult {
  readonly success: boolean;
  readonly converged: boolean;
  readonly state: SystemConstraintState;
  readonly entities: Record<string, Spatial3DEntity>;
  readonly iterations: number;
  readonly residualNorm: number;
  readonly maxResidualComponent: number;
  readonly dofReport: Production3DDOFReport;
  readonly jacobianConditionNumber: number;
  readonly jacobianRank: number;
  readonly independentConstraints: string[];
  readonly redundantConstraints: {
    readonly constraintId: string;
    readonly reason: string;
  }[];
  readonly conflictingConstraints: MinimalConflictSet[];
  readonly closureError?: number;
  readonly solveTimeMs: number;
  readonly diagnostics: string[];
  readonly evidenceSignature: string;
}
