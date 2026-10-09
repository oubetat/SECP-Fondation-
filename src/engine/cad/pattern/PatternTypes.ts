export type PatternType = 'LINEAR' | 'CIRCULAR' | 'VARIABLE' | 'FEATURE';

export type PatternStatus = 'VALID' | 'INVALIDATED' | 'REBUILD_FAILED' | 'BREP_ERROR';

export type PatternDiagnosticCode = 
  | 'PATTERN_INVALID_DIRECTION'
  | 'PATTERN_ZERO_SPACING'
  | 'PATTERN_INVALID_AXIS'
  | 'PATTERN_SELF_INTERSECTION'
  | 'PATTERN_BREP_FAILURE'
  | 'PATTERN_TOPOLOGY_FAILURE'
  | 'PATTERN_DEPENDENCY_FAILURE'
  | 'PATTERN_REBUILD_FAILURE';

export type PatternEvidenceEventType = 
  | 'PATTERN_CREATED'
  | 'PATTERN_RECOMPUTED'
  | 'PATTERN_VALIDATED'
  | 'PATTERN_INVALIDATED'
  | 'PATTERN_INSTANCE_SUPPRESSED'
  | 'PATTERN_PARAMETERS_CHANGED';

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export interface TransformMatrix4x4 {
  elements: number[]; // 16 float elements column-major or row-major
}

export interface PatternInstance {
  instanceIndex: number;
  gridCoordinate?: { i: number; j: number };
  position: Vector3D;
  rotation?: Vector3D; // Euler angles in degrees or radians
  scale?: Vector3D;
  transform: TransformMatrix4x4;
  isSuppressed: boolean;
  bRepInstanceHash: string;
}

export interface LinearPatternDefinition {
  direction1: Vector3D;
  count1: number;
  spacing1: number;
  isTotalSpacing1?: boolean;
  reverse1?: boolean;
  isSymmetric1?: boolean;

  direction2?: Vector3D;
  count2?: number;
  spacing2?: number;
  isTotalSpacing2?: boolean;
  reverse2?: boolean;
  isSymmetric2?: boolean;
}

export interface CircularPatternDefinition {
  axisOrigin: Vector3D;
  axisDirection: Vector3D;
  count: number;
  angleDegrees: number; // e.g. 360 or 180
  isTotalAngle?: boolean;
  isSymmetric?: boolean;
  reverse?: boolean;
}

export interface VariablePatternRule {
  instanceIndex: number;
  customOffset?: Vector3D;
  customRotationDegrees?: number;
  scaleFactor?: number;
  customParameters?: Record<string, number>;
}

export interface VariablePatternDefinition {
  baseType: 'LINEAR' | 'CIRCULAR';
  linearDef?: LinearPatternDefinition;
  circularDef?: CircularPatternDefinition;
  overrides: VariablePatternRule[];
}

export interface PatternFeature {
  id: string;
  name: string;
  type: PatternType;
  sourceFeatureIds: string[];
  linearDef?: LinearPatternDefinition;
  circularDef?: CircularPatternDefinition;
  variableDef?: VariablePatternDefinition;
  instances: PatternInstance[];
  suppressionList: number[];
  dependencies: string[];
  status: PatternStatus;
  diagnostics: {
    code?: PatternDiagnosticCode;
    message?: string;
    failingInstanceIndex?: number;
  }[];
  inputBRepHash: string;
  outputBRepHash: string;
  evidenceId: string;
  timestamp: string;
}

export interface PatternEvidenceEvent {
  eventId: string;
  eventType: PatternEvidenceEventType;
  patternId: string;
  patternType: PatternType;
  inputGeometryHash: string;
  outputGeometryHash: string;
  instanceCount: number;
  suppressedCount: number;
  timestamp: string;
  hash: string;
}
