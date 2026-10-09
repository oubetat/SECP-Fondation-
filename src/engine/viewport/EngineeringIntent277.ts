/**
 * PATCH-SECP-PROMPT-012: Unified Engineering Intent Contract
 * Defines the canonical structure for all design tool execution intents.
 * 
 * ARCHITECTURAL RULE:
 * - Intent is a DESCRIBER of user objective, NOT the geometric truth.
 * - Intent must be validated by the Canonical Dispatcher before execution.
 */

import { SelectionReference } from './SelectionTypes277';
import { 
  HoleType, 
  HoleTermination, 
  ThreadSpecification, 
  CounterboreParameters, 
  CountersinkParameters 
} from '../cad-kernel/history/FeatureDefinition';

export type EngineeringIntentType = 
  | 'SKETCH_LINE' 
  | 'SKETCH_CONSTRUCTION_LINE'
  | 'SKETCH_CENTERLINE'
  | 'SKETCH_CIRCLE' 
  | 'SKETCH_RECTANGLE'
  | 'SKETCH_CORNER_RECTANGLE'
  | 'SKETCH_CENTER_RECTANGLE'
  | 'SKETCH_3POINT_RECTANGLE'
  | 'SKETCH_3POINT_CENTER_RECTANGLE'
  | 'SKETCH_PARALLELOGRAM'
  | 'SKETCH_ARC'
  | 'SKETCH_3POINT_ARC'
  | 'SKETCH_CENTERPOINT_ARC'
  | 'SKETCH_TANGENT_ARC'
  | 'SKETCH_POLYLINE'
  | 'SKETCH_POINT'
  | 'SKETCH_POLYGON'
  | 'SKETCH_SLOT'
  | 'SKETCH_ELLIPSE'
  | 'SKETCH_MIDPOINT_LINE'
  | 'SKETCH_MOVE'
  | 'SKETCH_ROTATE'
  | 'SKETCH_SCALE'
  | 'SKETCH_DELETE_ENTITY'
  | 'SKETCH_TRIM'
  | 'SKETCH_EXTEND'
  | 'SKETCH_SPLIT'
  | 'SKETCH_OFFSET'
  | 'SKETCH_MIRROR'
  | 'SKETCH_PATTERN_LINEAR'
  | 'SKETCH_PATTERN_CIRCULAR'
  | 'SKETCH_ADD_CONSTRAINT'
  | 'FEATURE_EXTRUDE' 
  | 'FEATURE_REVOLVE'
  | 'FEATURE_SWEEP'
  | 'FEATURE_LOFT'
  | 'FEATURE_HOLE'
  | 'FEATURE_THREAD'
  | 'FEATURE_FILLET'
  | 'FEATURE_DRAFT'
  | 'FEATURE_SHELL'
  | 'FEATURE_RIB'
  | 'FEATURE_THIN'
  | 'FEATURE_SUPPRESS'
  | 'FEATURE_DELETE'
  | 'FEATURE_UPDATE_PARAM'
  | 'ASSEMBLY_MATE_COINCIDENT'
  | 'CFD_SIMULATION_RESULT';

export interface EngineeringIntent {
  intentId: string;
  toolId: EngineeringIntentType | string;
  documentId: string;
  selection?: SelectionReference[];
  parameters: Readonly<Record<string, any>>;
  timestamp: string;
}

export interface SketchLineIntent extends EngineeringIntent {
  toolId: 'SKETCH_LINE';
  parameters: {
    sketchId: string;
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    isConstruction?: boolean;
    isCenterline?: boolean;
  };
}

export interface SketchCircleIntent extends EngineeringIntent {
  toolId: 'SKETCH_CIRCLE';
  parameters: {
    sketchId: string;
    centerX: number;
    centerY: number;
    radius: number;
    isConstruction?: boolean;
  };
}

export interface SketchRectangleIntent extends EngineeringIntent {
  toolId: 'SKETCH_RECTANGLE';
  parameters: {
    sketchId: string;
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    isConstruction?: boolean;
  };
}

export interface SketchArcIntent extends EngineeringIntent {
  toolId: 'SKETCH_ARC';
  parameters: {
    sketchId: string;
    centerX: number;
    centerY: number;
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    isConstruction?: boolean;
  };
}

export interface SketchPolylineIntent extends EngineeringIntent {
  toolId: 'SKETCH_POLYLINE';
  parameters: {
    sketchId: string;
    points: { x: number, y: number }[];
    isClosed?: boolean;
    isConstruction?: boolean;
  };
}

export interface SketchPointIntent extends EngineeringIntent {
  toolId: 'SKETCH_POINT';
  parameters: {
    sketchId: string;
    x: number;
    y: number;
    isConstruction?: boolean;
  };
}

export interface SketchConstructionLineIntent extends EngineeringIntent {
  toolId: 'SKETCH_CONSTRUCTION_LINE';
  parameters: {
    sketchId: string;
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    isConstruction?: boolean;
    isCenterline?: boolean;
  };
}

export interface SketchCenterlineIntent extends EngineeringIntent {
  toolId: 'SKETCH_CENTERLINE';
  parameters: {
    sketchId: string;
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    isConstruction?: boolean;
    isCenterline?: boolean;
  };
}

export interface Sketch3PointArcIntent extends EngineeringIntent {
  toolId: 'SKETCH_3POINT_ARC';
  parameters: {
    sketchId: string;
    p1: { x: number; y: number };
    p2: { x: number; y: number };
    p3: { x: number; y: number };
    isConstruction?: boolean;
  };
}

export interface SketchPolygonIntent extends EngineeringIntent {
  toolId: 'SKETCH_POLYGON';
  parameters: {
    sketchId: string;
    centerX: number;
    centerY: number;
    radius: number;
    sides?: number;
    mode?: 'INSCRIBED' | 'CIRCUMSCRIBED';
    isConstruction?: boolean;
  };
}

export interface SketchSlotIntent extends EngineeringIntent {
  toolId: 'SKETCH_SLOT';
  parameters: {
    sketchId: string;
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    width: number;
    type?: 'STRAIGHT' | 'CENTER_POINT';
    isConstruction?: boolean;
  };
}

export interface SketchCornerRectangleIntent extends EngineeringIntent {
  toolId: 'SKETCH_CORNER_RECTANGLE';
  parameters: {
    sketchId: string;
    p1: { x: number; y: number };
    p2: { x: number; y: number };
    isConstruction?: boolean;
  };
}

export interface SketchCenterRectangleIntent extends EngineeringIntent {
  toolId: 'SKETCH_CENTER_RECTANGLE';
  parameters: {
    sketchId: string;
    center: { x: number; y: number };
    corner: { x: number; y: number };
    isConstruction?: boolean;
  };
}

export interface Sketch3PointRectangleIntent extends EngineeringIntent {
  toolId: 'SKETCH_3POINT_RECTANGLE';
  parameters: {
    sketchId: string;
    p1: { x: number; y: number };
    p2: { x: number; y: number };
    p3: { x: number; y: number };
    isConstruction?: boolean;
  };
}

export interface Sketch3PointCenterRectangleIntent extends EngineeringIntent {
  toolId: 'SKETCH_3POINT_CENTER_RECTANGLE';
  parameters: {
    sketchId: string;
    center: { x: number; y: number };
    midEdge: { x: number; y: number };
    corner: { x: number; y: number };
    isConstruction?: boolean;
  };
}

export interface SketchParallelogramIntent extends EngineeringIntent {
  toolId: 'SKETCH_PARALLELOGRAM';
  parameters: {
    sketchId: string;
    p1: { x: number; y: number };
    p2: { x: number; y: number };
    p3: { x: number; y: number };
    isConstruction?: boolean;
  };
}

export interface Sketch3PointCircleIntent extends EngineeringIntent {
  toolId: 'SKETCH_CIRCLE' | 'SKETCH_3POINT_CIRCLE';
  parameters: {
    sketchId: string;
    p1: { x: number; y: number };
    p2: { x: number; y: number };
    p3: { x: number; y: number };
    isConstruction?: boolean;
  };
}

export interface SketchTangentArcIntent extends EngineeringIntent {
  toolId: 'SKETCH_TANGENT_ARC';
  parameters: {
    sketchId: string;
    tangentEntityId: string;
    end: { x: number; y: number };
    isConstruction?: boolean;
  };
}

export interface SketchMidpointLineIntent extends EngineeringIntent {
  toolId: 'SKETCH_MIDPOINT_LINE';
  parameters: {
    sketchId: string;
    midpoint: { x: number; y: number };
    end: { x: number; y: number };
    isConstruction?: boolean;
    isCenterline?: boolean;
  };
}

export interface SketchCenterpointArcIntent extends EngineeringIntent {
  toolId: 'SKETCH_CENTERPOINT_ARC';
  parameters: {
    sketchId: string;
    center: { x: number; y: number };
    start: { x: number; y: number };
    end: { x: number; y: number };
    isConstruction?: boolean;
  };
}

export interface SketchMoveIntent extends EngineeringIntent {
  toolId: 'SKETCH_MOVE';
  parameters: {
    sketchId: string;
    selectedEntityIds: string[];
    delta: { x: number; y: number };
  };
}

export interface SketchRotateIntent extends EngineeringIntent {
  toolId: 'SKETCH_ROTATE';
  parameters: {
    sketchId: string;
    selectedEntityIds: string[];
    center: { x: number; y: number };
    angleRad: number;
  };
}

export interface SketchScaleIntent extends EngineeringIntent {
  toolId: 'SKETCH_SCALE';
  parameters: {
    sketchId: string;
    selectedEntityIds: string[];
    center: { x: number; y: number };
    scale: number;
  };
}

export interface SketchEllipseIntent extends EngineeringIntent {
  toolId: 'SKETCH_ELLIPSE';
  parameters: {
    sketchId: string;
    centerX: number;
    centerY: number;
    majorX: number;
    majorY: number;
    minorRadius: number;
    isConstruction?: boolean;
  };
}

export interface SketchDeleteEntityIntent extends EngineeringIntent {
  toolId: 'SKETCH_DELETE_ENTITY';
  parameters: {
    sketchId: string;
    entityIds: string[];
  };
}

export interface ExtrudeIntent extends EngineeringIntent {
  toolId: 'FEATURE_EXTRUDE';
  parameters: {
    sketchId: string;
    depth: number;
    operation?: 'NEW' | 'JOIN' | 'CUT' | 'INTERSECT';
  };
}

export interface RevolveIntent extends EngineeringIntent {
  toolId: 'FEATURE_REVOLVE';
  parameters: {
    sketchId: string;
    angle: number;
    axis?: { x: number; y: number; z: number };
    operation?: 'NEW' | 'JOIN' | 'CUT' | 'INTERSECT';
  };
}

export interface SweepIntent extends EngineeringIntent {
  toolId: 'FEATURE_SWEEP';
  parameters: {
    sketchId?: string;
    profileId?: string;
    pathId?: string;
    pathPoints?: Array<{ x: number; y: number; z?: number }>;
    guideCurves?: Array<Array<{ x: number; y: number; z?: number }>>;
    orientation?: 'FOLLOW_PATH' | 'FIXED' | 'NORMAL_TO_PATH' | 'REFERENCE_BASED';
    twistAngleDeg?: number;
    operation?: 'NEW' | 'JOIN' | 'CUT' | 'INTERSECT';
    scale?: number;
    profileReference?: SelectionReference;
    pathReference?: SelectionReference;
    guideReferences?: SelectionReference[];
  };
}

export interface LoftIntent extends EngineeringIntent {
  toolId: 'FEATURE_LOFT';
  parameters: {
    sectionIds?: string[];
    sectionReferences?: SelectionReference[];
    sections?: Array<Array<{ x: number; y: number; z?: number }>>;
    guideReferences?: SelectionReference[];
    guideCurves?: Array<Array<{ x: number; y: number; z?: number }>>;
    centerlineReference?: SelectionReference;
    centerline?: Array<{ x: number; y: number; z?: number }>;
    closed?: boolean;
    solidMode?: boolean;
    continuity?: 'G0' | 'G1' | 'G2';
    startCondition?: 'NONE' | 'NORMAL_TO_PROFILE' | 'DIRECTION';
    endCondition?: 'NONE' | 'NORMAL_TO_PROFILE' | 'DIRECTION';
    sectionAlignment?: 'PROPORTIONAL' | 'DIRECT' | 'AUTO';
    operation?: 'NEW' | 'JOIN' | 'CUT' | 'INTERSECT';
  };
}

export interface HoleIntent extends EngineeringIntent {
  toolId: 'FEATURE_HOLE';
  parameters: {
    targetFaceRef?: SelectionReference;
    targetFaceId?: string;
    position?: { x: number; y: number; z?: number };
    center?: { x: number; y: number; z?: number };
    diameter: number; // in mm
    depth?: number; // in mm
    termination?: HoleTermination;
    throughAll?: boolean;
    holeType?: HoleType;
    counterbore?: CounterboreParameters;
    countersink?: CountersinkParameters;
    taperAngleDeg?: number;
    tipAngleDeg?: number;
    threadSpec?: ThreadSpecification;
    direction?: { x: number; y: number; z: number };
    operation?: 'CUT' | 'NEW';
  };
}

export interface ThreadIntent extends EngineeringIntent {
  toolId: 'FEATURE_THREAD';
  parameters: {
    targetFaceRef?: SelectionReference;
    targetFaceId?: string;
    center?: { x: number; y: number; z?: number };
    position?: { x: number; y: number; z?: number };
    threadSpec: ThreadSpecification;
    depth?: number;
    isInternal?: boolean;
    operation?: 'CUT' | 'NEW' | 'JOIN';
  };
}

export interface FilletIntent extends EngineeringIntent {
  toolId: 'FEATURE_FILLET';
  parameters: {
    radius: number;
    edgeReferences: SelectionReference[];
  };
}

export interface SuppressFeatureIntent extends EngineeringIntent {
  toolId: 'FEATURE_SUPPRESS';
  parameters: {
    featureId: string;
    suppressed?: boolean; // toggle if undefined
  };
}

export interface DeleteFeatureIntent extends EngineeringIntent {
  toolId: 'FEATURE_DELETE';
  parameters: {
    featureId: string;
  };
}

export interface UpdateParamIntent extends EngineeringIntent {
  toolId: 'FEATURE_UPDATE_PARAM';
  parameters: {
    featureId: string;
    paramId: string;
    value: any;
  };
}

export interface AssemblyMateIntent extends EngineeringIntent {
  toolId: 'ASSEMBLY_MATE_COINCIDENT';
  parameters: {
    instanceAId: string;
    instanceBId: string;
    entityA: SelectionReference;
    entityB: SelectionReference;
  };
}

export interface SketchTrimIntent extends EngineeringIntent {
  toolId: 'SKETCH_TRIM';
  parameters: {
    sketchId: string;
    targetEntityId: string;
    clickPoint: { x: number; y: number };
  };
}

export interface SketchExtendIntent extends EngineeringIntent {
  toolId: 'SKETCH_EXTEND';
  parameters: {
    sketchId: string;
    targetEntityId: string;
  };
}

export interface SketchSplitIntent extends EngineeringIntent {
  toolId: 'SKETCH_SPLIT';
  parameters: {
    sketchId: string;
    targetEntityId: string;
    splitPoint: { x: number; y: number };
  };
}

export interface SketchOffsetIntent extends EngineeringIntent {
  toolId: 'SKETCH_OFFSET';
  parameters: {
    sketchId: string;
    targetEntityId: string;
    offsetValue: number;
  };
}

export interface SketchMirrorIntent extends EngineeringIntent {
  toolId: 'SKETCH_MIRROR';
  parameters: {
    sketchId: string;
    selectedEntityIds: string[];
    mirrorLineId: string;
  };
}

export interface SketchPatternLinearIntent extends EngineeringIntent {
  toolId: 'SKETCH_PATTERN_LINEAR';
  parameters: {
    sketchId: string;
    selectedEntityIds: string[];
    count: number;
    distance: number;
    directionRad: number;
  };
}

export interface SketchPatternCircularIntent extends EngineeringIntent {
  toolId: 'SKETCH_PATTERN_CIRCULAR';
  parameters: {
    sketchId: string;
    selectedEntityIds: string[];
    count: number;
    center: { x: number; y: number };
    totalAngleRad: number;
  };
}

export interface SketchAddConstraintIntent extends EngineeringIntent {
  toolId: 'SKETCH_ADD_CONSTRAINT';
  parameters: {
    sketchId: string;
    constraintType: any; // IndustrialConstraintType
    references: SelectionReference[];
    value?: number;
    expression?: string;
  };
}

export interface DraftIntent extends EngineeringIntent {
  toolId: 'FEATURE_DRAFT';
  parameters: {
    targetFaceRef?: SelectionReference;
    targetFaceRefs?: SelectionReference[];
    targetFaceId?: string;
    neutralPlaneRef?: SelectionReference;
    pullDirection?: { x: number; y: number; z: number };
    angle?: number;
    draftAngle?: number;
    propagation?: 'NONE' | 'TANGENT' | 'ALL_FACES';
    targetSolidId?: string;
  };
}

export interface ShellIntent extends EngineeringIntent {
  toolId: 'FEATURE_SHELL';
  parameters: {
    removedFaceRef?: SelectionReference;
    removedFaceRefs?: SelectionReference[];
    removedFaceId?: string;
    thickness: number;
    direction?: 'INSIDE' | 'OUTSIDE' | 'BOTH';
    targetSolidId?: string;
  };
}

export interface RibIntent extends EngineeringIntent {
  toolId: 'FEATURE_RIB';
  parameters: {
    profileRef?: SelectionReference;
    profileId?: string;
    sketchId?: string;
    supportFaceRef?: SelectionReference;
    thickness: number;
    direction?: 'MIDPLANE' | 'SIDE1' | 'SIDE2' | { x: number; y: number; z: number };
    termination?: 'UP_TO_NEXT' | 'UP_TO_FACE' | 'THROUGH';
    targetSolidId?: string;
  };
}

export interface ThinIntent extends EngineeringIntent {
  toolId: 'FEATURE_THIN';
  parameters: {
    targetRef?: SelectionReference;
    targetRefs?: SelectionReference[];
    sketchId?: string;
    thickness: number;
    direction?: 'INSIDE' | 'OUTSIDE' | 'SYMMETRIC';
    side?: 'INSIDE' | 'OUTSIDE' | 'SYMMETRIC';
    termination?: 'THROUGH' | 'BLIND';
    depth?: number;
    targetSolidId?: string;
  };
}

export interface DispatchResult {
  success: boolean;
  documentId: string;
  revision: number;
  canonicalActionId: string;
  affectedEntities: readonly string[];
  document?: any; // The updated EngineeringDocument
  error?: string;
  evaluationResult?: any; // DocumentEvaluationResult
  evidence?: any[];
}

export interface CfdSimulationIntent extends EngineeringIntent {
  toolId: 'CFD_SIMULATION_RESULT';
  parameters: {
    modelId?: string;
    inletVelocity: number;
    fluidDensity: number;
    viscosity: number;
    convergenceIterations: number;
    results: {
      reynoldsNumber: number;
      pressureDropPa: number;
      flowRegime: string;
      maxVelocity: number;
    };
    cellCount?: number;
  };
}

export type AnyEngineeringIntent = 
  | SketchLineIntent 
  | SketchConstructionLineIntent
  | SketchCenterlineIntent
  | SketchCircleIntent 
  | Sketch3PointCircleIntent
  | SketchRectangleIntent
  | SketchCornerRectangleIntent
  | SketchCenterRectangleIntent
  | Sketch3PointRectangleIntent
  | Sketch3PointCenterRectangleIntent
  | SketchParallelogramIntent
  | SketchArcIntent
  | Sketch3PointArcIntent
  | SketchCenterpointArcIntent
  | SketchTangentArcIntent
  | SketchPolylineIntent
  | SketchPointIntent
  | SketchPolygonIntent
  | SketchSlotIntent
  | SketchEllipseIntent
  | SketchMidpointLineIntent
  | SketchMoveIntent
  | SketchRotateIntent
  | SketchScaleIntent
  | SketchDeleteEntityIntent
  | SketchTrimIntent
  | SketchExtendIntent
  | SketchSplitIntent
  | SketchOffsetIntent
  | SketchMirrorIntent
  | SketchPatternLinearIntent
  | SketchPatternCircularIntent
  | SketchAddConstraintIntent
  | ExtrudeIntent 
  | RevolveIntent
  | SweepIntent
  | LoftIntent
  | HoleIntent
  | ThreadIntent
  | FilletIntent 
  | DraftIntent
  | ShellIntent
  | RibIntent
  | ThinIntent
  | SuppressFeatureIntent
  | DeleteFeatureIntent
  | UpdateParamIntent
  | AssemblyMateIntent
  | CfdSimulationIntent;
