/**
 * SECP-055 Production Assembly Engineering Types
 */

import { Vector3D } from '../surface/IndustrialSurfaceTypes';
import { Transform3D } from './AssemblyConstraintTypes';

export type ComponentType = 'PART' | 'SUBASSEMBLY';

export interface ComponentConfiguration {
  id: string;
  name: string;
  parameters: Record<string, number>;
  suppressedFeatures: string[];
}

export interface ComponentInstance {
  id: string;
  name: string;
  type: ComponentType;
  partDefinitionId: string;
  parentAssemblyId: string;
  activeConfigurationId: string;
  transform: Transform3D;
  isFixed: boolean;
  suppressionState: 'ACTIVE' | 'SUPPRESSED';
  persistentTopologyPath?: string; // e.g. Part_A/Hole_01/FACE:p-face-102
}

export interface AssemblyNode {
  id: string;
  name: string;
  isRoot: boolean;
  childInstanceIds: string[];
  subassemblyIds: string[];
  revision: number;
}

export type MateType =
  | 'COINCIDENT'
  | 'CONCENTRIC'
  | 'PARALLEL'
  | 'PERPENDICULAR'
  | 'DISTANCE'
  | 'ANGLE'
  | 'TANGENT'
  | 'LOCK'
  | 'GEAR_RELATION'
  | 'RACK_PINION';

export interface AssemblyMateReference {
  componentInstanceId: string;
  partId: string;
  featureId?: string;
  topologyType: 'FACE' | 'EDGE' | 'VERTEX' | 'AXIS' | 'PLANE';
  persistentTopologyId: string; // From SECP-052 Persistent ID
  canonicalPath: string;        // e.g., Part_A/Hole_01/FACE:p-face-102
}

export interface AssemblyMate {
  id: string;
  name: string;
  type: MateType;
  primaryRef: AssemblyMateReference;
  secondaryRef: AssemblyMateReference;
  offsetMm?: number;
  angleDeg?: number;
  ratio?: number;                // For Gear / Rack & Pinion
  minLimitMmOrDeg?: number;
  maxLimitMmOrDeg?: number;
  suppressionState: 'ACTIVE' | 'SUPPRESSED';
  isFlipped?: boolean;
}

export interface AssemblyKinematicJoint {
  id: string;
  mateId: string;
  jointType: 'REVOLUTE' | 'PRISMATIC' | 'CYLINDRICAL' | 'SPHERICAL' | 'GEAR_PAIR' | 'FIXED';
  drivenComponentId: string;
  dofCount: number;
  currentValue: number;         // mm or deg
  minRange: number;
  maxRange: number;
}

export type InterferenceResultType = 'NO_INTERFERENCE' | 'INTERFERENCE_DETECTED' | 'CLEARANCE_VIOLATION';

export interface AssemblyInterferenceReport {
  instanceAId: string;
  instanceBId: string;
  resultType: InterferenceResultType;
  interferenceVolumeMm3: number;
  minClearanceDistanceMm: number;
  requiredClearanceMm: number;
  contactPoint?: Vector3D;
}

export interface AssemblyGraphValidationResult {
  isValid: boolean;
  danglingComponentCount: number;
  hasCircularDependency: boolean;
  duplicateInstanceIdsCount: number;
  invalidReferenceCount: number;
  errors: string[];
}

export interface AssemblyDOFAnalysis {
  totalComponents: number;
  totalMates: number;
  rigidBodyDOF: number;        // 6 * ungrounded components
  constrainedDOF: number;
  netSystemDOF: number;
  isFullyConstrained: boolean;
  isOverConstrained: boolean;
  jointDOFs: Record<string, number>;
}

export interface AssemblyProvenanceRecord {
  systemVersion: string;
  timestamp: string;
  assemblyRevision: number;
  assemblyGraphHash: string;
  mateSystemHash: string;
  kinematicHash: string;
  interferenceHash: string;
  resultHash: string;
  signature: string;
}
