/**
 * SECP Industrial OS — EPC-041: Industrial Robot Assembly Types
 * Domain model for physical robot assembly leveraging SECP core Assembly Infrastructure:
 * AssemblyCore, ProductionAssemblyGraphEngine, AssemblyConstraintSolver,
 * AssemblyInterferenceEngine, AssemblyBOMEngine, mass properties, and evidence.
 */

import { Vector3D } from '../../cadKernel';

export type SuppressionState = 'ACTIVE' | 'SUPPRESSED';
export type VisibilityState = 'VISIBLE' | 'HIDDEN';
export type AssemblyNodeType = 'ROOT' | 'SUBSYSTEM' | 'SUBASSEMBLY' | 'PART';

export interface ComponentTransform3D {
  position: Vector3D;      // { x, y, z } in mm
  orientation: Vector3D;   // { x, y, z } Euler angles in degrees
  matrix: number[][];      // 4x4 homogenous matrix
  referenceFrame?: string; // 'WORLD' or 'PARENT'
}

export interface RobotPartDefinition {
  definitionId: string;
  partNumber: string;
  name: string;
  revision: string;
  materialId: string;
  materialName: string;
  densityKgM3: number;
  unitMassKg: number;
  volumeMm3: number;
  surfaceAreaMm2: number;
  cadGeometryHash: string;
  cadKernelId: string;
  manufacturingProcess: string;
  createdAt: string;
}

export interface RobotPartInstance {
  instanceId: string;
  partId: string; // References RobotPartDefinition.definitionId
  name: string;
  parentAssemblyId: string;
  transform: ComponentTransform3D;
  position: Vector3D;
  orientation: Vector3D;
  suppressionState: SuppressionState;
  visibilityState: VisibilityState;
  isFixed: boolean;
  jointAssociationId?: string; // e.g. 'J1_BASE', 'J2_SHOULDER', etc.
}

export interface RobotAssemblyTreeNode {
  id: string;
  name: string;
  nodeType: AssemblyNodeType;
  parentAssemblyId: string | null;
  childInstanceIds: string[];
  subassemblyIds: string[];
  revision: string;
}

export interface RobotAssemblyConstraintDefinition {
  constraintId: string;
  assemblyId: string;
  name: string;
  constraintType: 'FIXED' | 'COINCIDENT' | 'CONCENTRIC' | 'DISTANCE' | 'ANGLE' | 'PARALLEL' | 'PERPENDICULAR';
  componentAInstanceId: string;
  componentBInstanceId: string;
  geometryRefA: {
    topologyType: 'FACE' | 'AXIS' | 'ORIGIN' | 'CYLINDER' | 'FLANGE';
    normal?: Vector3D;
    point?: Vector3D;
  };
  geometryRefB: {
    topologyType: 'FACE' | 'AXIS' | 'ORIGIN' | 'CYLINDER' | 'FLANGE';
    normal?: Vector3D;
    point?: Vector3D;
  };
  offsetMm?: number;
  angleDeg?: number;
  jointAssociationId?: string;
  suppressed: boolean;
}

export interface RobotAssemblyValidationReport {
  valid: boolean;
  partsExistence: boolean;
  instancesValid: boolean;
  referencesValid: boolean;
  noBrokenReferences: boolean;
  noOrphanComponents: boolean;
  hierarchyValid: boolean;
  transformsValid: boolean;
  constraintsSolvable: boolean;
  jointReferencesValid: boolean;
  brokenReferenceIds: string[];
  orphanInstanceIds: string[];
  issues: string[];
  timestamp: string;
}

export interface RobotAssemblySolverResult {
  status: 'CONVERGED' | 'DIVERGED' | 'INVALID' | 'FAILED';
  iterations: number;
  residual: number;
  activeConstraintsCount: number;
  totalDOF: number;
  netSystemDOF: number;
  isFullyConstrained: boolean;
  isOverConstrained: boolean;
  isUnderConstrained: boolean;
  solvedPoses: Record<string, { position: Vector3D; orientation: Vector3D }>;
}

export interface RobotInterferenceRecord {
  componentAInstanceId: string;
  componentAName: string;
  componentBInstanceId: string;
  componentBName: string;
  collisionStatus: 'INTERFERENCE_DETECTED' | 'NO_INTERFERENCE' | 'CLEARANCE_VIOLATION';
  interferenceVolumeMm3: number;
  clearanceDistanceMm: number;
  location?: Vector3D;
  severity: 'CRITICAL' | 'WARNING' | 'NONE';
}

export interface RobotBOMItem {
  itemNumber: number;
  partNumber: string;
  partName: string;
  revision: string;
  quantity: number;
  unitMassKg: number;
  totalMassKg: number;
  material: string;
  source: string;
  parentAssemblyId: string;
  instanceIds: string[];
}

export interface RobotAssemblyMassProperties {
  totalMassKg: number;
  centerOfGravityMm: Vector3D;
  inertiaTensorKgM2: {
    Ixx: number;
    Iyy: number;
    Izz: number;
    Ixy: number;
    Ixz: number;
    Iyz: number;
  };
  volumeMm3: number;
  readinessForEPC048: boolean;
}

export interface RobotCADDependencyImpact {
  changedPartId: string;
  oldRevision: string;
  newRevision: string;
  affectedInstanceIds: string[];
  affectedSubassemblies: string[];
  requiresReSolve: boolean;
  requiresReValidation: boolean;
}

export interface RobotAssemblyRevisionRecord {
  assemblyId: string;
  revision: string;
  configurationId: string;
  createdAt: string;
  updatedAt: string;
  sourceReferences: {
    cadModelCount: number;
    jointCount: number;
    transmissionCount: number;
  };
}

export interface RobotAssemblyEvidencePackage {
  assemblyId: string;
  revision: string;
  partListCount: number;
  instanceListCount: number;
  constraintListCount: number;
  solverResult: RobotAssemblySolverResult;
  hierarchyValidation: {
    valid: boolean;
    treeDepth: number;
    subassemblyCount: number;
  };
  referenceValidation: {
    valid: boolean;
    brokenReferenceCount: number;
  };
  interferenceResult: {
    hasInterference: boolean;
    recordsCount: number;
  };
  bomComparison: {
    isConsistent: boolean;
    bomItemCount: number;
    totalAssemblyInstances: number;
  };
  massPropertyReadiness: {
    totalMassKg: number;
    readiness: boolean;
  };
  cadDependencyStatus: {
    dependencyChainIntact: boolean;
    trackedPartDefinitionsCount: number;
  };
  timestamp: string;
  provenance: {
    who: string;
    what: string;
    when: string;
    source: string;
    version: string;
  };
  evidenceHash: string;
  verdict: 'PASS' | 'FAIL';
}

export interface EPC041GateReport {
  epc: 'EPC-041';
  name: string;
  verdict: 'PASS' | 'FAIL' | 'INCONCLUSIVE';
  checks: Record<string, { passed: boolean; message: string }>;
  summary: {
    totalChecks: number;
    passedChecks: number;
    failedChecks: number;
  };
  evidenceHash: string;
  timestamp: string;
}
