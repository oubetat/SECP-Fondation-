/**
 * PATCH-SECP-072: Advanced Assembly, Kinematics & Mechanical System Intelligence Types
 * Defines the core models for parts instantiation, 3D transformations, kinematic joints, mates,
 * gear relationships, motion graphs, collisions, and assembly packages.
 */

import { CADPart } from '../parametric-cad/ParametricCADTypes';

export type JointType = 'REVOLUTE' | 'PRISMATIC' | 'FIXED' | 'CYLINDRICAL' | 'SPHERICAL';

export type AssemblyMateType = 'COINCIDENT' | 'CONCENTRIC' | 'PARALLEL' | 'DISTANCE' | 'ANGLE' | 'TANGENT' | 'GEAR';

export interface Transform3D {
  translation: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number; w: number }; // Quaternion
}

export interface ComponentInstance {
  instanceId: string;
  partId: string;
  partReference: CADPart;
  displayName: string;
  transform: Transform3D;
  parentInstanceId?: string;
  childInstanceIds: string[];
  configurationName: string;
}

export interface AssemblyStructure {
  assemblyId: string;
  displayName: string;
  instances: Record<string, ComponentInstance>;
  mates: MechanicalMate[];
  joints: MechanicalJoint[];
  degreesOfFreedom: number;
}

export interface MechanicalMate {
  mateId: string;
  type: AssemblyMateType;
  primaryInstanceId: string;
  primaryEntityId: string;
  secondaryInstanceId: string;
  secondaryEntityId: string;
  value?: number; // Distance/Angle/Gear ratio
  direction?: number; // 1 or -1 for gear direction
}

export interface MechanicalJoint {
  jointId: string;
  type: JointType;
  parentInstanceId: string;
  childInstanceId: string;
  origin: { x: number; y: number; z: number };
  axis: { x: number; y: number; z: number };
  limits?: { min: number; max: number };
  currentValue: number; // Angular position or linear displacement
}

export interface MotionGraphNode {
  instanceId: string;
  type: 'SOURCE' | 'LINK' | 'ACTUATOR';
  speed: number;
  position: number;
}

export interface MotionGraphEdge {
  sourceInstanceId: string;
  targetInstanceId: string;
  transferType: 'GEAR' | 'LINKAGE' | 'SLIDER_CRANK';
  ratio?: number;
}

export interface MotionGraph {
  nodes: Record<string, MotionGraphNode>;
  edges: MotionGraphEdge[];
}

export interface KinematicSimulationState {
  timestamp: number;
  instancePositions: Record<string, Transform3D>;
  instanceVelocities: Record<string, { linear: number; angular: number }>;
  instanceAccelerations: Record<string, { linear: number; angular: number }>;
}

export interface CollisionRecord {
  hasCollision: boolean;
  collidingInstances: [string, string];
  overlapVolume: number;
  minimumClearance: number;
}

export interface AssemblyProvenanceRecord {
  recordId: string;
  assemblyId: string;
  structureHash: string;
  kinematicHash: string;
  signedBy: string;
  timestamp: string;
}

export interface AssemblyPackage {
  packageId: string;
  assembly: AssemblyStructure;
  provenance: AssemblyProvenanceRecord;
  isValid: boolean;
}
