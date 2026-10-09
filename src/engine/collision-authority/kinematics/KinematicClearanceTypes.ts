/**
 * SECP Industrial OS v3 — Collision Authority Core
 * P5 — Kinematic Clearance & Multi-Body Collision Types
 */

import { Vector3DImmutable } from '../types';

export type ClearanceClassification = 
  | 'SEPARATED'
  | 'CLEARANCE_VIOLATION'
  | 'CONTACT'
  | 'PENETRATION'
  | 'UNKNOWN'
  | 'ANALYSIS_FAILED';

export interface Matrix4x4Immutable {
  readonly m: ReadonlyArray<number>; // 16 elements in row-major order
}

export interface CanonicalKinematicTransform {
  readonly componentId: string;
  readonly geometryId: string;
  readonly revisionId: string;
  readonly snapshotId: string;
  readonly transformRevision: number;
  readonly coordinateFrame: 'WCS' | 'MCS' | 'TCS';
  readonly matrix: Matrix4x4Immutable;
  readonly originWCS: Vector3DImmutable;
  readonly zAxisWCS: Vector3DImmutable;
}

export interface KinematicJointDefinition {
  readonly id: string;
  readonly name: string;
  readonly type: 'PRISMATIC' | 'REVOLUTE';
  readonly axisDirection: Vector3DImmutable;
  readonly parentJointId?: string;
  readonly minLimit: number;
  readonly maxLimit: number;
  readonly homeValue: number;
}

export interface KinematicChainState {
  readonly jointValues: Record<string, number>;
  readonly isSingular: boolean;
  readonly conditionNumber: number;
  readonly transforms: ReadonlyArray<CanonicalKinematicTransform>;
  readonly timestampIso: string;
}

export interface GeometricClearanceDetail {
  readonly entityIdA: string;
  readonly entityIdB: string;
  readonly componentTypeA: 'TOOL_CUTTER' | 'TOOL_SHANK' | 'TOOL_HOLDER' | 'SPINDLE_HEAD' | 'MACHINE_COMPONENT' | 'ASSEMBLY_COMPONENT';
  readonly componentTypeB: 'WORKPIECE' | 'FIXTURE' | 'STOCK' | 'MACHINE_TABLE' | 'MACHINE_COMPONENT' | 'ASSEMBLY_COMPONENT';
  readonly minimumClearanceMm: number;
  readonly penetrationDepthMm: number;
  readonly locationA: Vector3DImmutable;
  readonly locationB: Vector3DImmutable;
  readonly timeOfMinimumClearance: number; // in [0, 1]
  readonly classification: ClearanceClassification;
  readonly isColliding: boolean;
  readonly broadPhasePassed: boolean;
  readonly narrowPhaseEvaluated: boolean;
}

export interface KinematicClearanceReport {
  readonly executionId: string;
  readonly timestampIso: string;
  readonly overallStatus: ClearanceClassification;
  readonly isColliding: boolean;
  readonly minimumClearanceMm: number;
  readonly criticalPair?: GeometricClearanceDetail;
  readonly details: ReadonlyArray<GeometricClearanceDetail>;
  readonly kinematicChainState: KinematicChainState;
  readonly provenSafe: boolean;
  readonly diagnostics: ReadonlyArray<string>;
}
