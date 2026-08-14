/**
 * PATCH-SECP-043 — Assembly Constraint & Kinematics Types
 * Formal mathematical and topological types for Multi-Body CAD Assemblies,
 * Geometric References with Signatures, Constraints, DOF Analysis,
 * Kinematic Joints, and Interference Analysis.
 */

import { Vector3D, CadSolidEntity } from '../cadKernel';
import { Parameter } from '../../types/domainModel';
import { ShapeHandle } from '../geometry/ShapeHandle';

/**
 * 3D Spatial Transformation
 */
export interface Transform3D {
  position: Vector3D;       // translation x, y, z
  rotation: Vector3D;       // Euler angles in degrees (X, Y, Z)
  scale?: Vector3D;         // scaling factors (default 1, 1, 1)
  matrix: number[];         // 4x4 transformation matrix (row-major 16 floats)
}

/**
 * Creates an Identity Transform
 */
export function createIdentityTransform(): Transform3D {
  return {
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    matrix: [
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1
    ]
  };
}

export function createTransform3D(position: Vector3D, rotation: Vector3D, scale?: Vector3D): Transform3D {
  return {
    position,
    rotation,
    scale: scale || { x: 1, y: 1, z: 1 },
    matrix: computeTransformMatrix(position, rotation, scale)
  };
}

/**
 * Computes 4x4 matrix from translation, Euler rotations (deg), and optional scale
 */
export function computeTransformMatrix(position: Vector3D, rotation: Vector3D, scale?: Vector3D): number[] {
  const radX = (rotation.x * Math.PI) / 180;
  const radY = (rotation.y * Math.PI) / 180;
  const radZ = (rotation.z * Math.PI) / 180;

  const cx = Math.cos(radX);
  const sx = Math.sin(radX);
  const cy = Math.cos(radY);
  const sy = Math.sin(radY);
  const cz = Math.cos(radZ);
  const sz = Math.sin(radZ);

  const sxF = scale?.x ?? 1;
  const syF = scale?.y ?? 1;
  const szF = scale?.z ?? 1;

  // Rotation matrix R = Rz * Ry * Rx scaled by (sx, sy, sz)
  const r00 = (cy * cz) * sxF;
  const r01 = (sx * sy * cz - cx * sz) * syF;
  const r02 = (cx * sy * cz + sx * sz) * szF;

  const r10 = (cy * sz) * sxF;
  const r11 = (sx * sy * sz + cx * cz) * syF;
  const r12 = (cx * sy * sz - sx * cz) * szF;

  const r20 = (-sy) * sxF;
  const r21 = (sx * cy) * syF;
  const r22 = (cx * cy) * szF;

  return [
    r00, r01, r02, position.x,
    r10, r11, r12, position.y,
    r20, r21, r22, position.z,
    0,   0,   0,   1
  ];
}

/**
 * Part Definition: The golden blueprint template of a 3D mechanical component
 * Shared across multiple instances without copying the underlying B-Rep.
 */
export interface PartDefinition {
  partId: string;                 // Stable unique part identifier
  name: string;                   // Part name (e.g. "Spur_Gear_M2_Z24")
  solid?: CadSolidEntity;         // Fallback legacy solid
  shapeHandle?: ShapeHandle;      // Real OCCT ShapeHandle
  parameters: Parameter[];        // Parametric dimensions driving this part
  materialId?: string;            // Material reference
  densityKgM3: number;            // Material density (e.g. Steel = 7850 kg/m3)
  volumeM3: number;               // Computed volume
  massKg: number;                 // Part mass
  revision: number;               // Revision counter for selective rebuild
  geometryHash?: string;          // Hash of the generated B-Rep geometry
}

/**
 * Component Instance: An instance of a Part Definition placed in an assembly
 * Represents: Part Definition -> Component Instance -> Placement Transform -> Assembly
 */
export interface AssemblyComponent {
  instanceId: string;             // Stable unique instance identifier (e.g. "Gear001", "Gear002")
  partId: string;                 // Reference to PartDefinition (golden blueprint)
  name: string;                   // Instance name (e.g. "Drive Pinion", "Idler Gear A")
  placementTransform: Transform3D;// Local placement transform relative to assembly
  worldTransform: Transform3D;    // Computed world coordinates after solving
  suppressed: boolean;            // If true, skipped by solver and calculations
  fixed: boolean;                 // If true, anchored/grounded (0 DOF)
  colorHex?: string;              // Rendering display color
  visible?: boolean;              // Viewport visibility toggle
  revision?: number;              // Current instance revision
}

/**
 * Geometric Reference with Topological Signature to prevent Topological Naming Failure
 */
export type TopologyType = 'FACE' | 'EDGE' | 'VERTEX' | 'AXIS' | 'ORIGIN_PLANE' | 'POINT';

export interface GeometryReference {
  componentId: string;            // Component instance identifier
  topologyType: TopologyType;     // Type of topology
  topologyIndex: number;          // Index in the topology explorer
  geometricSignature: string;     // Hash/signature: normal, surface type, radius, centroid
  subTopology?: string;           // Optional sub-feature key
  cachedNormal?: Vector3D;        // Direction vector for planes/axes
  cachedPoint?: Vector3D;         // Origin point in local space
}

/**
 * Constraint Types
 */
export type AssemblyConstraintType = 
  | 'MATE'             // Coincident planar / surface contact
  | 'ALIGN'            // Axis or direction alignment
  | 'CONCENTRIC'       // Cylindrical coaxial alignment
  | 'DISTANCE'         // Fixed distance offset between features
  | 'ANGLE'            // Angular orientation between planes/axes
  | 'PARALLEL'         // Parallel alignment of planes/lines
  | 'PERPENDICULAR'    // Right-angle orientation
  | 'LOCK';            // Rigid relative lock between components

export type ConstraintStatus = 'SATISFIED' | 'VIOLATED' | 'CONFLICTING' | 'UNRESOLVED' | 'SUPPRESSED';

/**
 * Suppression lifecycle state for constraints and joints
 */
export type SuppressionState = 'ACTIVE' | 'SUPPRESSED' | 'INVALID' | 'INACTIVE';

/**
 * Detailed diagnostic status for a constraint
 */
export type ConstraintDiagnosticStatus =
  | 'VALID'
  | 'UNDER_CONSTRAINED'
  | 'OVER_CONSTRAINED'
  | 'CONFLICTING'
  | 'SINGULAR'
  | 'DANGLING_REFERENCE';

export interface ConstraintDiagnosticResult {
  constraintId: string;
  status: ConstraintDiagnosticStatus;
  affectedComponents: string[];
  affectedDOF: number;
  conflictsWith?: string[];
  residual: number;
  message?: string;
}

/**
 * Assembly Configuration States
 */
export interface AssemblyConfiguration {
  id: string;
  name: string;
  suppressedConstraints: string[];
  suppressedJoints: string[];
  parameterOverrides: Record<string, number>;
  componentOverrides: Record<string, { placementTransform?: Transform3D, suppressed?: boolean }>;
  deterministicHash: string;
}

/**
 * Assembly Constraint Model
 */
export interface AssemblyConstraint {
  constraintId: string;           // Unique constraint ID
  assemblyId: string;             // Assembly ID
  name?: string;                  // Friendly name
  componentA: string;             // Instance ID of component A
  componentB: string;             // Instance ID of component B
  geometryRefA: GeometryReference;// Geometric reference on A
  geometryRefB: GeometryReference;// Geometric reference on B
  type: AssemblyConstraintType;   // Constraint kind
  parameters: {
    offsetMm?: number;            // Distance offset (for DISTANCE or MATE)
    angleDeg?: number;            // Angle offset in degrees (for ANGLE)
    tolerance?: number;           // Solving tolerance (e.g. 1e-4)
    minLimit?: number;            // Min kinematic limit
    maxLimit?: number;            // Max kinematic limit
    flipAlignment?: boolean;      // Invert normal direction
    axisDirection?: Vector3D;     // Constraint axis
  };
  status: ConstraintStatus;       // Current evaluation status
  suppressionState?: SuppressionState; // 046 lifecycle state
  solverError: number;            // Residual distance / angular error
  revision: number;               // Revision tracker
  provenance?: {
    createdInRevision: number;
    lastModifiedInRevision: number;
    suppressedInRevision?: number;
  };
}

/**
 * Degrees of Freedom (DOF) tracking per Component Instance
 */
export interface ComponentDOF {
  instanceId: string;
  isFixed: boolean;
  translation: {
    tx: boolean;                  // true if Tx is free
    ty: boolean;                  // true if Ty is free
    tz: boolean;                  // true if Tz is free
  };
  rotation: {
    rx: boolean;                  // true if Rx is free
    ry: boolean;                  // true if Ry is free
    rz: boolean;                  // true if Rz is free
  };
  remainingDofCount: number;      // 0 to 6
  activeConstraintIds: string[];  // Constraints affecting this component
  statusMessage: string;
}

export type SolverOutcomeStatus = 
  | 'SOLVED' 
  | 'UNDER_CONSTRAINED' 
  | 'OVER_CONSTRAINED' 
  | 'CONFLICTING' 
  | 'INVALID';

export interface AssemblySolverReport {
  status: SolverOutcomeStatus;
  satisfiedConstraintsCount: number;
  totalActiveConstraintsCount: number;
  iterationsTaken: number;
  convergenceResidual: number;
  totalAssemblyDof: number;
  componentDofs: Record<string, ComponentDOF>;
  diagnostics: string[];
  solvedTimestamp: string;
  isDeterministic: boolean;
}

/**
 * Kinematic Joint Model
 */
export type KinematicJointType = 'REVOLUTE' | 'PRISMATIC' | 'CYLINDRICAL' | 'FIXED';

export interface KinematicJoint {
  jointId: string;
  name: string;
  type: KinematicJointType;
  parentComponentId: string;
  childComponentId: string;
  axis: Vector3D;                 // Joint motion axis (unit vector)
  origin: Vector3D;               // Joint anchor point
  motionRange: {
    min: number;                  // Min range (deg or mm)
    max: number;                  // Max range (deg or mm)
  };
  currentPosition: number;        // Current displacement (deg or mm)
  velocity: number;               // Speed (deg/s or mm/s)
  limitsEnabled: boolean;
  suppressionState?: SuppressionState; // 046 lifecycle state
  dofRemaining: number;           // 1 for REVOLUTE/PRISMATIC, 2 for CYLINDRICAL, 0 for FIXED
}

/**
 * Interference & Collision Detection Model
 */
export type InterferenceStatus = 'NO_INTERFERENCE' | 'INTERFERENCE' | 'TOUCHING' | 'UNKNOWN';

export interface AssemblyClash {
  id: string;
  componentAId: string;
  componentAName: string;
  componentBId: string;
  componentBName: string;
  intersectionVolumeMm3: number;
  intersectionLocation: Vector3D;
  severity: 'CRITICAL_COLLISION' | 'CLEARANCE_WARNING' | 'SURFACE_CONTACT';
  clashDetails: string;
  clearanceMm?: number;
}

export interface AssemblyInterferenceReport {
  status: InterferenceStatus;
  clashes: AssemblyClash[];
  totalClashVolumeMm3: number;
  evaluatedPairsCount: number;
  timestamp: string;
  kernelUsed: string;
}
