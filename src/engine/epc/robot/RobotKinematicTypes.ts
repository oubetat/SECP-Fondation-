/**
 * SECP Industrial OS — EPC-043: Kinematic Chain Types
 * Domain model and validation interfaces for robotic kinematic chains,
 * parent/child hierarchies, links, joints, reference frames, transforms,
 * DOF bindings, transmission integration, assembly integration,
 * evidence generation, and traceability.
 */

import { Vector3D } from '../../cadKernel';
import { Matrix4x4 } from '../../assembly/graph/types';

export type KinematicStatus = 'VALID' | 'INVALID' | 'BROKEN' | 'DISCONNECTED' | 'CYCLE_DETECTED';

export interface KinematicLinkDefinition {
  linkId: string;
  partId: string;                 // References RobotPartDefinition.definitionId in Assembly
  assemblyInstanceId: string;     // References RobotPartInstance.instanceId in Assembly
  parentLinkId: string | null;    // null for Root Link
  childLinkIds: string[];
  referenceFrame: string;
  massProperties: {
    unitMassKg: number;
    centerOfMassMm: Vector3D;
  };
  geometryReference: string;
  revision: string;
}

export interface KinematicJointDefinition {
  jointId: string;
  jointType: 'REVOLUTE' | 'PRISMATIC' | 'FIXED' | string;
  parentLinkId: string;
  childLinkId: string;
  axis: Vector3D;
  referenceFrame: string;
  dofId: string;                  // References EPC-042 DOF ID
  limits: {
    minimumPosition: number;      // deg or mm
    maximumPosition: number;      // deg or mm
    maxVelocity?: number;
    maxAcceleration?: number;
  };
  originTransform: Matrix4x4;      // 4x4 homogenous matrix relative to parent link frame
  state: {
    position: number;             // deg (REVOLUTE) or mm (PRISMATIC)
    velocity: number;             // deg/s or mm/s
    acceleration: number;         // deg/s^2 or mm/s^2
  };
  revision: string;
}

export interface KinematicFrameDefinition {
  frameId: string;
  frameName: string;
  parentFrameId: string | null;
  associatedEntityId: string;    // linkId or jointId
  associatedType: 'LINK' | 'JOINT' | 'WORLD' | 'END_EFFECTOR';
  localTransform: Matrix4x4;     // Local transform relative to parent frame
  worldTransform: Matrix4x4;     // Absolute computed transform in world frame
}

export interface KinematicDOFBinding {
  jointId: string;
  dofId: string;
  dofType: string;
  axis: Vector3D;
  variableName: string;          // e.g. 'q1', 'q2', 'd1'
  state: {
    position: number;
    velocity: number;
    acceleration: number;
  };
}

export interface KinematicChainModel {
  chainId: string;
  robotId: string;
  assemblyId: string;
  revision: string;
  rootLinkId: string;
  endEffectorLinkId: string;
  endEffectorFrameId?: string;
  links: KinematicLinkDefinition[];
  joints: KinematicJointDefinition[];
  frames: KinematicFrameDefinition[];
  dofMapping: KinematicDOFBinding[];
  status: KinematicStatus;
}

export interface KinematicChainValidationIssue {
  readonly ruleId: string;        // e.g. CHAIN-001, CHAIN-002, etc.
  readonly field: string;
  readonly severity: 'ERROR' | 'WARNING';
  readonly message: string;
  readonly value?: any;
}

export interface KinematicChainValidationReport {
  readonly valid: boolean;
  readonly status: KinematicStatus;
  readonly issues: KinematicChainValidationIssue[];
  readonly checks: {
    rootValid: boolean;
    parentChildValid: boolean;
    jointRefsValid: boolean;
    linkRefsValid: boolean;
    dofMappingValid: boolean;
    axesValid: boolean;
    referenceFramesValid: boolean;
    cycleFree: boolean;
    connected: boolean;
    limitsValid: boolean;
    transformsValid: boolean;
    assemblyConsistent: boolean;
  };
  readonly timestamp: string;
}

export interface KinematicChainTraceability {
  robotRequirementId: string;
  robotArchitectureId: string;
  jointDesignId: string;
  assemblyId: string;
  dofDefinitionId: string;
  kinematicChainId: string;
  verificationId: string;
  evidenceHash: string;
}

export interface RobotKinematicProvenanceRecord {
  who: string;
  what: string;
  when: string;
  source: string;
  version: string;
  input: {
    robotId: string;
    assemblyId: string;
    linkCount: number;
    jointCount: number;
  };
  process: string;
  output: {
    chainId: string;
    chainDepth: number;
    activeDOF: number;
    endEffectorPose: {
      position: Vector3D;
      orientationEulerDeg?: Vector3D;
    };
  };
}

export interface RobotKinematicEvidencePackage {
  chainId: string;
  robotId: string;
  assemblyId: string;
  revision: string;
  rootLink: string;
  endEffector: string;
  linkList: string[];
  jointList: string[];
  parentChildRelations: { jointId: string; parentLinkId: string; childLinkId: string }[];
  jointTypes: { jointId: string; type: string }[];
  dofMapping: KinematicDOFBinding[];
  axes: { jointId: string; axis: Vector3D; valid: boolean }[];
  referenceFrames: { frameId: string; parentFrameId: string | null }[];
  transforms: { frameId: string; translation: Vector3D }[];
  jointStates: { jointId: string; position: number; velocity: number }[];
  jointLimits: { jointId: string; min: number; max: number }[];
  chainDepth: number;
  connectivityResult: 'CONNECTED' | 'DISCONNECTED';
  cycleDetectionResult: 'CYCLE_FREE' | 'CYCLE_DETECTED';
  assemblyConsistency: 'CONSISTENT' | 'INCONSISTENT';
  validationResults: KinematicChainValidationReport;
  testResults?: Record<string, boolean>;
  provenance: RobotKinematicProvenanceRecord;
  timestamp: string;
  evidenceHash: string;
  verdict: 'PASS' | 'FAIL';
}

export interface EPC043GateReport {
  readonly epc: 'EPC-043';
  readonly name: string;
  readonly verdict: 'PASS' | 'FAIL';
  readonly checks: Record<string, { passed: boolean; message: string }>;
  readonly summary: {
    totalChecks: number;
    passedChecks: number;
    failedChecks: number;
  };
  readonly evidenceHash: string;
  readonly timestamp: string;
}
