/**
 * SECP Industrial OS v3 — Collision Authority Core
 * Production Collision Contracts & Interlock Types (Mission P6)
 */

import {
  CanonicalCollisionGeometry,
  CanonicalCollisionResult,
  CollisionExactness,
  CollisionStatus,
  Vector3DImmutable
} from '../types';

export type CollisionAnalysisType =
  | 'ASSEMBLY_CLEARANCE'
  | 'CAM_MULTI_AXIS'
  | 'MACHINE_SIMULATION'
  | 'KINEMATIC_MECHANISM'
  | 'STATIC_INTERFERENCE'
  | 'CONTINUOUS_SWEPT';

export interface CallerIdentity {
  readonly componentId: string;
  readonly componentName: string;
  readonly userId?: string;
  readonly sessionId: string;
  readonly role?: 'ENGINEER' | 'OPERATOR' | 'SYSTEM' | 'VIEWER';
}

export interface ProductionCollisionCommand {
  readonly commandId: string;
  readonly executionId: string;
  readonly documentId: string;
  readonly revisionId: string;
  readonly geometryIds: ReadonlyArray<string>;
  readonly snapshotIds: ReadonlyArray<string>;
  readonly transformRevision: string;
  readonly motionId: string | null;
  readonly coordinateFrame: 'WCS' | 'MCS' | 'TCS';
  readonly units: 'MILLIMETERS' | 'INCHES';
  readonly requestedAnalysis: CollisionAnalysisType;
  readonly canonicalGeometry?: any;
  readonly caller: CallerIdentity;
  readonly requestedAt: string;
  readonly authorityVersion: string;
}

export type VerificationStateVocabulary =
  | 'VERIFIED'
  | 'PROVEN_SAFE'
  | 'UNVERIFIED'
  | 'SAMPLED'
  | 'STALE'
  | 'INVALIDATED'
  | 'FAILED'
  | 'UNKNOWN';

export interface ProductionCollisionResult {
  readonly resultId: string;
  readonly commandId: string;
  readonly executionId: string;
  readonly authorityId: string;
  readonly providerId: string;
  readonly algorithmVersion: string;

  readonly documentId: string;
  readonly revisionId: string;
  readonly geometryId: string;
  readonly geometryHash: string;
  readonly snapshotId: string;
  readonly transformRevision: string;
  readonly motionId: string | null;

  readonly classification: CollisionStatus;
  readonly exactnessLevel: CollisionExactness;
  readonly verificationState: VerificationStateVocabulary;
  readonly provenSafe: boolean;

  readonly minimumClearanceMm: number;
  readonly maxPenetrationMm: number;
  readonly timeOfImpact: number | null;

  readonly failureCode: string | null;
  readonly failureReason: string | null;

  readonly timestampIso: string;
  readonly isCurrent: boolean;
}

export interface ActionInterlockRequirement {
  readonly actionId: string;
  readonly actionName: string;
  readonly requiresCollisionQualification: boolean;
  readonly requiredState: VerificationStateVocabulary;
  readonly blockOnStates: ReadonlyArray<VerificationStateVocabulary>;
  readonly description: string;
}

export interface ActionInterlockVerdict {
  readonly actionId: string;
  readonly isAllowed: boolean;
  readonly currentVerificationState: VerificationStateVocabulary;
  readonly isCurrent: boolean;
  readonly blockReason: string | null;
}
