/**
 * SECP CAD/CAE Platform - Boundary Condition System Types
 * PATCH-235 — Boundary Condition Engine
 *
 * Defines the schemas, types, units, provenance, load cases, diagnostics,
 * and coordinate system interfaces for industrial FEM boundary conditions.
 */

export type BCType =
  | 'ESSENTIAL_DIRICHLET'
  | 'FIXED_SUPPORT'
  | 'PRESCRIBED_DISPLACEMENT'
  | 'NODAL_FORCE'
  | 'DISTRIBUTED_LOAD'
  | 'PRESSURE'
  | 'GRAVITY_BODY_FORCE'
  | 'THERMAL_STUB';

export type TargetSelectionType =
  | 'VERTEX'
  | 'EDGE'
  | 'FACE'
  | 'SURFACE_REGION'
  | 'VOLUME_REGION'
  | 'NODE_SET'
  | 'ELEMENT_SET';

export type DOFType = 'UX' | 'UY' | 'UZ' | 'ROTX' | 'ROTY' | 'ROTZ' | 'TEMPERATURE' | 'PRESSURE';

export type CoordinateSystemType = 'GLOBAL' | 'LOCAL' | 'USER_DEFINED';

export type BCStatus =
  | 'VALID'
  | 'CONFLICT'
  | 'OVER_CONSTRAINED'
  | 'UNDER_CONSTRAINED'
  | 'INACTIVE'
  | 'UNIMPLEMENTED'
  | 'INVALID_TARGET';

export type EnforcementMethod = 'DIRECT_ELIMINATION' | 'ROW_COLUMN_MODIFICATION' | 'PENALTY_METHOD';

export type ThermalCapabilityStatus = 'UNIMPLEMENTED';

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export interface CoordinateSystem {
  id: string;
  name: string;
  type: CoordinateSystemType;
  origin: Vector3D;
  xAxis: Vector3D;
  yAxis: Vector3D;
  zAxis: Vector3D;
}

export interface GeometryTargetSelection {
  type: TargetSelectionType;
  entityIds: string[]; // CAD Face/Edge/Vertex IDs or Region IDs
  cadFaceIds?: string[];
  cadEdgeIds?: string[];
  cadVertexIds?: string[];
  nodeIds?: string[];
  elementIds?: string[];
  faceKeys?: string[]; // "elementId_faceIndex"
  boundingCenter?: Vector3D;
  areaOrVolume?: number;
}

export interface PrescribedDOFValue {
  dof: DOFType;
  isPrescribed: boolean;
  value: number; // m for displacement, rad for rotation, K for temp, Pa for pressure
}

export interface ForceValue {
  fx: number; // N
  fy: number; // N
  fz: number; // N
  magnitude: number; // N
  direction: Vector3D; // Normalized vector
  units: 'N' | 'kN' | 'lbf';
}

export interface PressureValue {
  magnitude: number; // Pa
  units: 'Pa' | 'kPa' | 'MPa' | 'psi';
  isNormal: boolean;
  direction?: Vector3D;
}

export interface GravityValue {
  gx: number; // m/s^2
  gy: number; // m/s^2
  gz: number; // m/s^2
  magnitude: number; // m/s^2
  direction: Vector3D;
  useMaterialDensity: boolean; // Fetch rho from PATCH-233
  defaultDensity?: number; // kg/m^3 fallback if unspecified
}

export interface BoundaryConditionDefinition {
  id: string;
  name: string;
  type: BCType;
  target: GeometryTargetSelection;
  dofValues?: PrescribedDOFValue[];
  forceValue?: ForceValue;
  pressureValue?: PressureValue;
  gravityValue?: GravityValue;
  coordinateSystem: CoordinateSystem;
  loadCaseId: string;
  enabled: boolean;
  createdBy: string;
  revision: number;
  timestamp: number;
  sourceGeometryHash: string;
  meshHash: string;
  status: BCStatus;
  statusDetails?: string;
  thermalStatus?: ThermalCapabilityStatus;
}

export interface LoadCase {
  id: string;
  name: string;
  type: 'STATIC' | 'GRAVITY' | 'PRESSURE' | 'THERMAL' | 'COMBINED';
  description?: string;
  boundaryConditionIds: string[];
  analysisSettings: {
    enforcementMethod: EnforcementMethod;
    penaltyParameter?: number;
    checkUnderConstrained: boolean;
    checkConflicts: boolean;
  };
  linearCombinations?: {
    loadCaseId: string;
    factor: number;
  }[];
  revision: number;
}

export interface BCDiagnosticIssue {
  code:
    | 'CONFLICT_DETECTED'
    | 'OVER_CONSTRAINED'
    | 'BOUNDARY_CONDITION_INSUFFICIENT'
    | 'INVALID_NODE'
    | 'INVALID_DOF'
    | 'UNSUPPORTED_ROTATIONAL_DOF'
    | 'UNIMPLEMENTED_CAPABILITY'
    | 'EXCEEDED_LOAD_BOUNDS'
    | 'STALE_MESH_PROJECTION';
  severity: 'ERROR' | 'WARNING' | 'INFO';
  bcId?: string;
  nodeId?: string;
  dof?: DOFType;
  unconstrainedModes?: string[];
  message: string;
}

export interface ReactionForceResult {
  nodeId: string;
  globalNodeIndex: number;
  Rx: number;
  Ry: number;
  Rz: number;
  R_magnitude: number;
  Mx?: number;
  My?: number;
  Mz?: number;
}

export interface SystemEquilibriumAudit {
  totalExternalForce: Vector3D;
  totalReactionForce: Vector3D;
  residualForce: Vector3D;
  residualNorm: number;
  relativeError: number;
  isEquilibriumSatisfied: boolean; // relativeError < 1e-4
  tolerance: number;
}

export interface BoundaryConditionEvidence {
  evidenceId: string;
  timestamp: number;
  modelHash: string;
  meshHash: string;
  materialHash: string;
  bcConfigurationHash: string;
  loadCaseHash: string;
  solverInputHash: string;
  totalDOFs: number;
  constrainedDOFCount: number;
  freeDOFCount: number;
  rigidBodyModes: string[];
  constraintConflicts: string[];
  reactionSummary: {
    totalRx: number;
    totalRy: number;
    totalRz: number;
    equilibriumError: number;
  };
  gateStatus: 'PASS' | 'FAIL' | 'UNPROVEN';
  gateScore: number;
  signature: string;
}
