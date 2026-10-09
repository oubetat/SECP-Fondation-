/**
 * SECP Industrial OS - PATCH-307 Natural Language CAD Types
 * Native Parametric CAD Specifications, Intent Models, Feature Dependency Graphs,
 * Sketch Constraints, B-Rep Validation, Audit Trails & Digital Thread
 */

export type DimensionSource =
  | 'USER_SPECIFIED'
  | 'AI_PROPOSED'
  | 'DATABASE_DERIVED'
  | 'COMPUTED';

export type UnitSystem = 'mm' | 'cm' | 'm' | 'in' | 'ft';

export type AmbiguityStatus =
  | 'CLEAR'
  | 'AMBIGUOUS_TARGET'
  | 'NEEDS_CLARIFICATION'
  | 'CONTRADICTORY';

export type ConstraintType =
  | 'HORIZONTAL'
  | 'VERTICAL'
  | 'COINCIDENT'
  | 'PARALLEL'
  | 'PERPENDICULAR'
  | 'TANGENT'
  | 'EQUAL'
  | 'CONCENTRIC'
  | 'DISTANCE'
  | 'ANGLE'
  | 'RADIUS'
  | 'DIAMETER';

export type ConstraintStatus =
  | 'SATISFIED'
  | 'CONFLICTING'
  | 'UNDER_CONSTRAINED'
  | 'OVER_CONSTRAINED';

export type FeatureType307 =
  | 'SKETCH'
  | 'EXTRUDE_PAD'
  | 'REVOLVE'
  | 'HOLE'
  | 'PATTERN_CIRCULAR'
  | 'PATTERN_RECTANGULAR'
  | 'CUT_BOOLEAN'
  | 'FILLET'
  | 'CHAMFER'
  | 'MATERIAL_ASSIGNMENT';

export type SuppressionState = 'ACTIVE' | 'SUPPRESSED';

export type SolidValidationStatus =
  | 'VALID_SOLID'
  | 'OPEN_SHELL'
  | 'NON_MANIFOLD'
  | 'SELF_INTERSECTING'
  | 'INVALID_GEOMETRY';

export interface CADDimension {
  dimensionId: string;
  name: string;
  value: number;
  unit: UnitSystem;
  reference: string;
  toleranceMm?: number;
  source: DimensionSource;
}

export interface CADConstraint {
  constraintId: string;
  type: ConstraintType;
  entityIds: string[];
  targetValue?: number;
  unit?: UnitSystem;
  status: ConstraintStatus;
  source: DimensionSource;
}

export interface SketchPrimitive {
  primitiveId: string;
  type: 'LINE' | 'ARC' | 'CIRCLE' | 'RECTANGLE' | 'POLYLINE' | 'SPLINE';
  points: { x: number; y: number; z?: number }[];
  radius?: number;
  dimensions: CADDimension[];
}

export interface CADSketch {
  sketchId: string;
  name: string;
  planeReference: string; // e.g., 'XY_PLANE', 'FACE_TOP_01'
  primitives: SketchPrimitive[];
  constraints: CADConstraint[];
  status: 'FULLY_CONSTRAINED' | 'UNDER_CONSTRAINED' | 'OVER_CONSTRAINED';
}

export interface CADFeatureNode {
  featureId: string;
  canonicalId: string;
  featureName: string;
  featureType: FeatureType307;
  parentFeatureId?: string;
  childFeatureIds: string[];
  parameters: Record<string, number | string>;
  sketches: CADSketch[];
  constraints: CADConstraint[];
  references: string[];
  suppressionState: SuppressionState;
  recomputeStatus: 'SUCCESS' | 'REGENERATION_FAILED' | 'PENDING';
}

export interface ParametricFeatureTree {
  treeId: string;
  rootFeatureId: string;
  nodes: Map<string, CADFeatureNode>;
  dependencyGraph: Map<string, string[]>; // featureId -> dependent featureIds
  version: number;
}

export interface BRepGeometry {
  solidId: string;
  verticesCount: number;
  edgesCount: number;
  facesCount: number;
  loopsCount: number;
  shellsCount: number;
  volumeMm3: number;
  surfaceAreaMm2: number;
  massKg: number;
  centerOfMassMm: [number, number, number];
  validationStatus: SolidValidationStatus;
  isManifold: boolean;
  hasSelfIntersection: boolean;
  generatedFaceIds?: string[];
}

export interface CADIntent {
  intentId: string;
  projectId: string;
  revisionId: string;
  userId: string;
  prompt: string;
  units: UnitSystem;
  entities: {
    partType: string;
    thicknessMm?: number;
    holeCount?: number;
    holeDiameterMm?: number;
    overallDimensionsMm?: [number, number, number];
    pcdMm?: number;
  };
  features: string[];
  dimensions: CADDimension[];
  constraints: CADConstraint[];
  relationships: string[];
  manufacturingIntent: '3_AXIS_CNC' | 'INJECTION_MOLDING' | 'SHEET_METAL' | 'ADDITIVE_MANUFACTURING' | 'GENERAL';
  assumptions: {
    assumptionId: string;
    parameterName: string;
    proposedValue: number | string;
    unit: string;
    reason: string;
    confidence: 'EXPLICIT' | 'INFERRED' | 'ASSUMED';
  }[];
  ambiguityStatus: AmbiguityStatus;
  clarificationMessage?: string;
}

export interface CADConstructionPlan {
  planId: string;
  intentId: string;
  orderedSteps: {
    stepNumber: number;
    action: string;
    targetFeatureType: FeatureType307;
    parameters: Record<string, any>;
    dependencies: string[];
    suppressionState?: SuppressionState;
  }[];
}

export interface NLCADPreview {
  previewId: string;
  plan: CADConstructionPlan;
  featureTreePreview: string[]; // human readable tree string
  parameterDiffs: {
    featureName: string;
    parameter: string;
    oldValue: any;
    newValue: any;
  }[];
  bRepPreviewSummary: {
    estimatedVolumeMm3: number;
    estimatedMassKg: number;
    faceCount: number;
  };
}

export interface NLCADAuditRecord {
  operationId: string;
  timestamp: number;
  userId: string;
  sessionId: string;
  prompt: string;
  featureId: string;
  operationType: 'CREATE' | 'MODIFY' | 'DELETE' | 'RECOMPUTE' | 'ROLLBACK';
  oldStateHash: string;
  newStateHash: string;
  digitalThreadToken: string;
}
