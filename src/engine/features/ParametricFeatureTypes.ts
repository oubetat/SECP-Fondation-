/**
 * PATCH-194 & PATCH-195: Parametric Feature Architecture Types
 * Defines comprehensive data structures for the Parametric Feature Engine,
 * Feature Tree, Dependency Graph, B-Rep Solid operations, Reorder Validation,
 * Failure Diagnostics, and Cryptographic Evidence.
 */

import { CadSolidEntity, Vector3D } from '../cadKernel';
import { IndustrialSketchDefinition } from '../sketch/IndustrialConstraintTypes';

export type FeatureType =
  | 'SKETCH'
  | 'EXTRUDE'
  | 'REVOLVE'
  | 'SWEEP'
  | 'LOFT'
  | 'HOLE'
  | 'SHELL'
  | 'DRAFT'
  | 'RIB'
  | 'FILLET'
  | 'CHAMFER'
  | 'BOOLEAN';

export type FeatureSuppressionState = 'ACTIVE' | 'SUPPRESSED';
export type FeatureRecomputeState = 'VALID' | 'INVALIDATED' | 'RECOMPUTING' | 'ERROR';

/**
 * PATCH-195 Exact Feature Statuses
 */
export type FeatureStatus =
  | 'ACTIVE'
  | 'SUPPRESSED'
  | 'INVALID'
  | 'OUT_OF_DATE'
  | 'REBUILDING'
  | 'FAILED'
  | 'ROLLED_BACK';

export type ExtrudeEndCondition =
  | 'BLIND'
  | 'SYMMETRIC'
  | 'TWO_SIDED'
  | 'UP_TO_FACE'
  | 'UP_TO_VERTEX'
  | 'THROUGH_ALL';

export interface ExtrudeParameters {
  depth: number; // in mm
  depth2?: number; // for TWO_SIDED
  direction?: Vector3D; // default { x: 0, y: 0, z: 1 }
  symmetric?: boolean;
  draftAngle?: number; // in degrees
  endCondition?: ExtrudeEndCondition;
  reversed?: boolean;
  profileSketchId?: string;
}

export type RevolveAxisType = 'X' | 'Y' | 'Z' | 'CUSTOM' | 'SKETCH_LINE';

export interface RevolveParameters {
  angle: number; // in degrees, e.g. 360, 180, 90
  axis?: RevolveAxisType;
  axisPoint?: Vector3D;
  axisDirection?: Vector3D;
  symmetric?: boolean;
  reversed?: boolean;
  profileSketchId?: string;
}

export type SweepOrientation = 'NORMAL' | 'FIXED' | 'PARALLEL';

export interface SweepParameters {
  profileSketchId?: string;
  pathPoints?: Vector3D[];
  pathSketchId?: string;
  orientation?: SweepOrientation;
  twist?: number; // in degrees
  scale?: number; // taper scale factor
  isClosed?: boolean;
}

export interface LoftParameters {
  sectionSketchIds?: string[];
  sectionSketches?: IndustrialSketchDefinition[];
  guideCurveIds?: string[];
  startCondition?: 'NORMAL' | 'TANGENT' | 'SMOOTH';
  endCondition?: 'NORMAL' | 'TANGENT' | 'SMOOTH';
  isClosed?: boolean;
}

export type HoleType = 'SIMPLE' | 'THROUGH' | 'BLIND' | 'COUNTERBORE' | 'COUNTERSINK';

export interface HoleParameters {
  holeType: HoleType;
  diameter: number; // in mm
  depth?: number; // in mm, for blind / counterbore
  position?: Vector3D;
  direction?: Vector3D; // default { x: 0, y: 0, z: -1 }
  counterboreDiameter?: number;
  counterboreDepth?: number;
  countersinkDiameter?: number;
  countersinkAngle?: number; // in degrees, default 90
  targetSolidId?: string;
}

export type ShellDirection = 'INNER' | 'OUTER' | 'BOTH';

export interface ShellParameters {
  thickness: number; // in mm
  removedFaceIds?: string[];
  direction?: ShellDirection;
  targetSolidId?: string;
}

export type NeutralPlaneType = 'XY' | 'XZ' | 'YZ' | 'CUSTOM';

export interface DraftParameters {
  neutralPlane?: NeutralPlaneType;
  pullDirection?: Vector3D;
  draftAngle: number; // in degrees
  faceIds?: string[];
  positive?: boolean;
  targetSolidId?: string;
}

export interface RibParameters {
  sketchId?: string;
  ribSketch?: IndustrialSketchDefinition;
  thickness: number; // in mm
  direction?: Vector3D;
  symmetric?: boolean;
  draftAngle?: number;
  targetSolidId?: string;
}

export interface FilletParameters {
  radius: number; // in mm
  edgeIds?: string[];
  targetSolidId?: string;
}

export interface ChamferParameters {
  distance: number; // in mm
  angle?: number; // in degrees, default 45
  edgeIds?: string[];
  targetSolidId?: string;
}

export type AnyFeatureParameters =
  | ExtrudeParameters
  | RevolveParameters
  | SweepParameters
  | LoftParameters
  | HoleParameters
  | ShellParameters
  | DraftParameters
  | RibParameters
  | FilletParameters
  | ChamferParameters
  | Record<string, any>;

export interface TopologyReference {
  id: string;
  type: 'FACE' | 'EDGE' | 'VERTEX' | 'SKETCH_ENTITY';
  signature: string;
  name: string;
  persistentId: string;
}

export interface FeatureDiagnostic {
  code: string;
  severity: 'INFO' | 'WARNING' | 'ERROR';
  message: string;
  relatedEntityId?: string;
  failureType?:
    | 'SELF_INTERSECTION'
    | 'NON_MANIFOLD'
    | 'MISSING_REFERENCE'
    | 'INVALID_PARAMETER'
    | 'KERNEL_ERROR'
    | 'RECOMPUTE_FAILURE'
    | 'BOOLEAN_FAILURE'
    | 'DEPENDENCY_CYCLE'
    | 'INVALID_REORDER';
}

export interface FeatureModificationRecord {
  revision: number;
  timestamp: string;
  changedParams: Record<string, any>;
  reason?: string;
}

/**
 * PATCH-195: Full Parametric Feature Definition
 * Conforms to both PATCH-194 and PATCH-195 strict naming and data standards.
 */
export interface ParametricFeature {
  id: string;
  featureId?: string; // PATCH-195 alias to id
  type: FeatureType;
  featureType?: FeatureType; // PATCH-195 alias to type
  name: string;
  creationIndex: number;
  parentFeatureId?: string;
  parentFeatures: string[]; // Explicit parent array
  childFeatures: string[];  // Explicit children array
  inputReferences: string[]; // Explicit reference IDs
  inputGeometry: {
    sketch?: IndustrialSketchDefinition;
    sketchId?: string;
    targetSolidId?: string;
    profileSketchId?: string;
    pathPoints?: Vector3D[];
    sectionSketchIds?: string[];
    [key: string]: any;
  };
  parameters: AnyFeatureParameters;
  outputGeometry?: CadSolidEntity; // PATCH-195 alias to resultBody
  resultBody?: CadSolidEntity;
  dependencies: string[]; // Upstream feature IDs
  dependents: string[];   // Downstream feature IDs
  status: FeatureStatus;  // ACTIVE | SUPPRESSED | INVALID | OUT_OF_DATE | REBUILDING | FAILED | ROLLED_BACK
  suppressed: boolean;
  valid: boolean;
  createdAt: string;
  updatedAt: string;
  creationEvent: {
    eventId: string;
    timestamp: string;
    author: string;
  };
  modificationHistory: FeatureModificationRecord[];
  suppressionState: FeatureSuppressionState;
  recomputeState: FeatureRecomputeState;
  diagnostics: FeatureDiagnostic[];
  topologyReferences: TopologyReference[];
  deterministicHash: string;
  revision: number;
}

export interface RecomputeReport {
  success: boolean;
  recomputedFeatureIds: string[];
  invalidatedFeatureIds: string[];
  failedFeatureId?: string;
  errorDiagnostics: FeatureDiagnostic[];
  recomputeDurationMs: number;
  timestamp: string;
  finalSolid?: CadSolidEntity;
}

/**
 * PATCH-195: Events emitted by Feature Tree
 */
export type FeatureEventType =
  | 'FEATURE_CREATED'
  | 'FEATURE_EDITED'
  | 'FEATURE_REORDERED'
  | 'FEATURE_SUPPRESSED'
  | 'FEATURE_UNSUPPRESSED'
  | 'FEATURE_ROLLBACK'
  | 'FEATURE_INVALIDATED'
  | 'FEATURE_REBUILT'
  | 'FEATURE_REBUILD_FAILED'
  | 'FEATURE_DELETED';

export interface FeatureEventPayload {
  objectId: string;
  featureId: string;
  previousState?: FeatureStatus;
  newState: FeatureStatus;
  parametersHash: string;
  dependencyHash: string;
  timestamp: string;
  actor: string;
  evidenceReference?: string;
  details?: Record<string, any>;
}

export interface FeatureReorderValidationResult {
  valid: boolean;
  reason?: string;
  violatingDependencies?: string[];
  targetIndex?: number;
  proposedOrder?: string[];
}

export interface FeatureTreeEvidence {
  featureTreeHash: string;
  dependencyGraphHash: string;
  parameterHash: string;
  inputGeometryHash: string;
  outputGeometryHash: string;
  rebuildResult: 'SUCCESS' | 'FAILED' | 'PARTIAL';
  validationResult: 'VALID' | 'INVALID';
  activeFeatureCount: number;
  totalFeatureCount: number;
  timestamp: string;
}
