/**
 * SECP Industrial OS — EPC-021: Industrial Drone Assembly Types
 * Defines type structures for Part Registry, Part Definitions vs Instances,
 * Assembly Tree, Constraints, Transforms, BOM, Mass Roll-Up, and Evidence.
 */

import { Transform3D } from '../../assembly/AssemblyCore';
import { SolverOutcomeStatus } from '../../assembly/AssemblyConstraintTypes';
import { InterferenceResultType } from '../../assembly/ProductionAssemblyTypes';

export interface DronePartReference {
  partId: string;
  partNumber: string;
  name: string;
  revision: string;
  quantity: number;
  geometryReference: {
    geometryHash: string;
    kernelId: string;
    volumeMm3: number;
    surfaceAreaMm2: number;
    boundingExtentMm: [number, number, number];
  };
  materialReference: {
    materialId: string;
    materialName: string;
    densityKgM3: number;
  };
  configurationReference: {
    variantId: string;
    configId: string;
  };
  parentAssemblyId: string;
  status: 'RELEASED' | 'DRAFT' | 'REVISED' | 'OBSOLETE';
}

export interface DronePartDefinition {
  definitionId: string;
  partNumber: string;
  name: string;
  revision: string;
  materialId: string;
  materialName: string;
  densityKgM3: number;
  unitMassKg: number;
  manufacturingProcess: string;
  cadGeometryHash: string;
  createdAt: string;
}

export interface DronePartInstance {
  instanceId: string;
  partDefinitionId: string;
  partNumber: string;
  name: string;
  revision: string;
  parentSubassemblyId: string;
  localTransform: Transform3D;
  globalTransform: Transform3D;
  isFixed: boolean;
  suppressionState: 'ACTIVE' | 'SUPPRESSED';
  visibility: boolean;
}

export interface DroneAssemblyTreeNode {
  nodeId: string;
  parentId: string | null;
  name: string;
  nodeType: 'ROOT' | 'SUBASSEMBLY' | 'PART_INSTANCE';
  partId?: string;
  instanceId?: string;
  quantity: number;
  localTransform: Transform3D;
  globalTransform: Transform3D;
  visibility: boolean;
  suppressionState: 'ACTIVE' | 'SUPPRESSED';
  children: DroneAssemblyTreeNode[];
}

export interface DroneAssemblyConstraintDefinition {
  constraintId: string;
  name: string;
  type: 'COINCIDENT' | 'CONCENTRIC' | 'DISTANCE' | 'ANGLE' | 'PARALLEL' | 'FIXED';
  componentA: string; // instanceId
  entityA: string;
  componentB: string; // instanceId
  entityB: string;
  offsetMm?: number;
  angleDeg?: number;
  status: 'SOLVED' | 'UNSOLVED' | 'CONFLICTING' | 'SUPPRESSED';
}

export interface DroneConstraintSolverResult {
  solverStatus: 'SOLVED' | 'UNDER_CONSTRAINED' | 'OVER_CONSTRAINED' | 'CONFLICTING';
  constraintCount: number;
  solvedConstraints: number;
  unsolvedConstraints: number;
  conflictingConstraints: number;
  degreesOfFreedom: {
    rigidBodyDOF: number;
    constrainedDOF: number;
    netSystemDOF: number;
    expectedDOF: number;
    actualDOF: number;
    isFullyConstrained: boolean;
    isOverConstrained: boolean;
  };
  residualTolerance: number;
  solvedTimestamp: string;
}

export interface DroneCollisionRecord {
  collisionPair: [string, string];
  location: { x: number; y: number; z: number };
  penetrationMm: number;
  minClearanceMm: number;
  requiredClearanceMm: number;
  severity: 'CRITICAL' | 'WARNING' | 'PASS';
  status: InterferenceResultType;
}

export interface DroneBOMItem {
  partNumber: string;
  partName: string;
  revision: string;
  quantity: number;
  material: string;
  unitMassKg: number;
  totalMassKg: number;
  manufacturingProcess: string;
  parentAssembly: string;
  status: string;
}

export interface DroneMassRollupResult {
  subassemblyMasses: Record<string, number>;
  totalAssemblyMassKg: number;
  componentCount: number;
  nonSuppressedComponentCount: number;
}

export interface DroneCenterOfGravityResult {
  centerOfGravity: { x: number; y: number; z: number };
  totalMassKg: number;
  referenceOrigin: string;
}

export interface DroneRevisionChangeEvent {
  eventId: string;
  timestamp: string;
  nodeId: string;
  instanceId: string;
  previousRevision: string;
  newRevision: string;
  affectedCAEInvalidated: boolean;
  affectedCAMInvalidated: boolean;
  affectedEvidenceInvalidated: boolean;
  author: string;
}

export interface DroneConfigurationChainLink {
  productId: string;
  productName: string;
  revisionId: string;
  revisionCode: string;
  variantId: string;
  variantName: string;
  configurationId: string;
  assemblyId: string;
  bomId: string;
  chainValid: boolean;
}

export interface EPC021ValidationResult {
  verdict: 'PASS' | 'FAIL' | 'INCONCLUSIVE';
  overallStatusMessage: string;
  executionTimeMs: number;
  timestamp: string;
  totalChecks: number;
  passedChecks: number;
  failedChecks: number;
  checks: Record<string, { passed: boolean; message: string; details?: unknown }>;
  evidencePackageId?: string;
  canonicalHash?: string;
}
