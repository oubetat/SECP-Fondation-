import { Vector3D } from '../../cadKernel';

/**
 * Represent each assembly component using a rigid-body transform
 */
export interface AssemblyComponentPose {
  instanceId: string;
  position: Vector3D;       // translation x, y, z (t vector)
  orientation: Vector3D;    // Euler angles in degrees (X, Y, Z) (defines R matrix)
  transform: number[][];    // 4x4 Row-major transformation matrix [ R  t ] [ 0  1 ]
  degreesOfFreedom: {
    initialDOF: number;
    remainingDOF: number;
    constrainedDOF: number;
    redundantDOF: number;
    conflictingDOF: number;
    unconstrainedDirections: string[]; // tx, ty, tz, rx, ry, rz
  };
}

/**
 * Geometric reference on a specific component entity
 */
export interface AssemblyGeometryReference {
  componentId: string;
  topologyType: 'FACE' | 'EDGE' | 'VERTEX' | 'AXIS' | 'ORIGIN_PLANE' | 'POINT';
  topologyIndex: number;
  geometricSignature: string; // Hash/signature: normal, surface type, radius, centroid
  cachedNormal?: Vector3D;     // direction vector for planes/axes (local space)
  cachedPoint?: Vector3D;      // origin point/centroid (local space)
}

export type AssemblyConstraintType =
  | 'FIXED'
  | 'COINCIDENT'
  | 'CONCENTRIC'
  | 'DISTANCE'
  | 'ANGLE'
  | 'PARALLEL'
  | 'PERPENDICULAR'
  | 'TANGENT'
  | 'AXIS_ALIGNMENT'
  | 'PLANAR_ALIGNMENT';

export interface AssemblyConstraint {
  constraintId: string;
  assemblyId: string;
  parentRevisionId: string;
  componentA: string;
  componentB: string;
  geometryReferenceA: AssemblyGeometryReference;
  geometryReferenceB: AssemblyGeometryReference;
  constraintType: AssemblyConstraintType;
  parameters: {
    offsetMm?: number;         // target distance offset
    angleDeg?: number;         // target angle offset in degrees
    flipAlignment?: boolean;   // align normal direction or invert
  };
  tolerance: number;
  suppressed: boolean;
  enabled: boolean;
  priority: number;
  createdBy: string;
  createdAt: string;
}

export interface AssemblyRevision {
  revisionId: string;
  parentRevisionId: string;
  assemblyId: string;
  constraintSetHash: string;
  componentPoseHash: string;
  solverVersion: string;
  solverStatus: string;
  residualSummary: number;
  timestamp: string;
  evidenceId: string;
}
