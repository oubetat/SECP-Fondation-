/**
 * SECP CAD Kernel — Feature Definitions & Types
 * Phase 2 (PATCH-022)
 *
 * ARCHITECTURAL CONTRACT:
 * - Separates Feature Definition (engineering design intent) from Feature Result (generated geometry).
 * - Explicit capability status for all supported, partial, and unsupported feature operations.
 * - Strict parameter validation types.
 */

export type FeatureType =
  | 'SKETCH'
  | 'EXTRUDE'
  | 'POCKET'
  | 'HOLE'
  | 'THREAD'
  | 'CUT'
  | 'REVOLVE'
  | 'SWEEP'
  | 'LOFT'
  | 'FILLET'
  | 'CHAMFER'
  | 'BOOLEAN'
  | 'PATTERN'
  | 'MIRROR'
  | 'DRAFT'
  | 'SHELL'
  | 'RIB'
  | 'THIN'
  | 'THICKEN'
  | 'PLANAR_SURFACE'
  | 'REVOLVED_SURFACE'
  | 'SWEPT_SURFACE'
  | 'LOFT_SURFACE'
  | 'BOUNDARY_SURFACE'
  | 'FILL_SURFACE'
  | 'BLEND_SURFACE'
  | 'OFFSET_SURFACE'
  | 'TRIM_SURFACE'
  | 'KNIT_SURFACE'
  | 'SEW_SURFACE'
  | 'SPRING'
  | 'IMPORT'
  | 'REFERENCE'
  | 'ROOT';

export type FeatureCapabilityStatus =
  | 'IMPLEMENTED'
  | 'PARTIAL'
  | 'UNPROVEN'
  | 'UNSUPPORTED';

/**
 * Explicit registry of kernel feature capability statuses.
 */
export const FEATURE_CAPABILITIES: Readonly<Record<FeatureType, FeatureCapabilityStatus>> = Object.freeze({
  SKETCH: 'IMPLEMENTED',
  EXTRUDE: 'IMPLEMENTED',
  POCKET: 'IMPLEMENTED',
  HOLE: 'IMPLEMENTED',
  THREAD: 'IMPLEMENTED',
  CUT: 'IMPLEMENTED',
  BOOLEAN: 'IMPLEMENTED',
  PATTERN: 'IMPLEMENTED',
  ROOT: 'IMPLEMENTED',
  REVOLVE: 'IMPLEMENTED',
  FILLET: 'PARTIAL',
  CHAMFER: 'PARTIAL',
  MIRROR: 'IMPLEMENTED',
  IMPORT: 'PARTIAL',
  REFERENCE: 'PARTIAL',
  SWEEP: 'IMPLEMENTED',
  LOFT: 'IMPLEMENTED',
  DRAFT: 'IMPLEMENTED',
  SHELL: 'IMPLEMENTED',
  RIB: 'IMPLEMENTED',
  THIN: 'IMPLEMENTED',
  THICKEN: 'UNSUPPORTED',
  PLANAR_SURFACE: 'IMPLEMENTED',
  REVOLVED_SURFACE: 'IMPLEMENTED',
  SWEPT_SURFACE: 'IMPLEMENTED',
  LOFT_SURFACE: 'IMPLEMENTED',
  BOUNDARY_SURFACE: 'IMPLEMENTED',
  FILL_SURFACE: 'PARTIAL',
  BLEND_SURFACE: 'PARTIAL',
  OFFSET_SURFACE: 'PARTIAL',
  TRIM_SURFACE: 'PARTIAL',
  KNIT_SURFACE: 'IMPLEMENTED',
  SEW_SURFACE: 'IMPLEMENTED',
  SPRING: 'IMPLEMENTED'
});

export type TopologicalEntityType =
  | 'VERTEX'
  | 'EDGE'
  | 'FACE'
  | 'SOLID'
  | 'SHELL'
  | 'SKETCH'
  | 'PROFILE'
  | 'FEATURE';

export interface TopologyLineage {
  createdByFeature: string; // FeatureId
  sourceEntities: string[];
  geometricSignature: string;
  persistentTag?: string;
}

export type GeometryReferenceType = TopologicalEntityType | 'BODY' | 'DATUM' | string;

export interface GeometryReference {
  type?: GeometryReferenceType;
  targetFeatureId?: string;
  entityId?: string;
  signature?: string;
  index?: number;
  persistentTag?: string;
  name?: string;
  entityType?: TopologicalEntityType;
  persistentId?: string;
  lineage?: TopologyLineage;
}

export interface TopologyReference {
  entityType?: TopologicalEntityType;
  persistentId?: string;

  lineage?: TopologyLineage;

  // Compatibility / optional fields
  type?: GeometryReferenceType;
  targetFeatureId?: string;
  entityId?: string;
  signature?: string;
  index?: number;
  persistentTag?: string;
  name?: string;
  [key: string]: any;
}

export interface ExtrudeParameters {
  profileId?: string;
  sketchId?: string;
  width?: number;
  height?: number;
  depth?: number;
  distance?: number;
  length?: number;
  direction?: string | { x: number; y: number; z: number };
  operation?: 'NEW' | 'JOIN' | 'CUT' | 'INTERSECT';
  draftAngle?: number;
  symmetric?: boolean;
  minX?: number;
  minY?: number;
  minZ?: number;
  maxX?: number;
  maxY?: number;
  maxZ?: number;
  profileReference?: GeometryReference;
}

export interface PocketParameters {
  profileId?: string;
  sketchId?: string;
  depth: number;
  direction?: string | { x: number; y: number; z: number };
  targetSolidId?: string;
  throughAll?: boolean;
  draftAngle?: number;
  profileReference?: GeometryReference;
}

export type HoleType = 'SIMPLE' | 'COUNTERBORE' | 'COUNTERSINK' | 'TAPERED' | 'THREADED';
export type HoleTermination = 'BLIND' | 'THROUGH_ALL' | 'UP_TO_NEXT';

export interface ThreadSpecification {
  standard: 'ISO_METRIC' | 'UNC' | 'UNF' | 'CUSTOM';
  designation: string; // e.g. "M8x1.25", "M6x1.0", "1/4-20 UNC"
  pitch: number; // in mm
  majorDiameter: number; // in mm
  minorDiameter: number; // in mm
  depth?: number; // in mm (threaded length)
  handedness?: 'RIGHT' | 'LEFT';
  threadClass?: string; // e.g. "6H", "6g", "2B"
  isRealGeometry?: boolean; // true: real 3D helical/ribbed B-Rep geometry; false: cosmetic
}

export interface CounterboreParameters {
  diameter: number; // in mm
  depth: number; // in mm
}

export interface CountersinkParameters {
  diameter: number; // in mm
  angleDeg: number; // in degrees (e.g. 90 or 82)
}

export interface HoleParameters {
  diameter: number;
  depth?: number;
  termination?: HoleTermination;
  throughAll?: boolean;
  holeType?: HoleType;
  center?: { x: number; y: number; z?: number };
  position?: { x: number; y: number; z?: number };
  direction?: string | { x: number; y: number; z: number };
  targetFaceId?: string;
  targetFaceRef?: GeometryReference;
  counterbore?: CounterboreParameters;
  countersink?: CountersinkParameters;
  taperAngleDeg?: number;
  tipAngleDeg?: number; // Drill point angle (e.g. 118 degrees)
  threadSpec?: ThreadSpecification;
  operation?: 'CUT' | 'NEW';
}

export interface ThreadParameters {
  targetFaceId?: string;
  targetFaceRef?: GeometryReference;
  threadSpec: ThreadSpecification;
  depth?: number;
  isInternal?: boolean; // true = internal hole thread, false = external bolt thread
  operation?: 'CUT' | 'NEW' | 'JOIN';
}

export interface RevolveParameters {
  angle: number;
  profileId?: string;
  axisPoint?: { x: number; y: number; z: number };
  axisDir?: { x: number; y: number; z: number };
  profileReference?: GeometryReference;
}

export type SweepOrientation = 'FOLLOW_PATH' | 'FIXED' | 'NORMAL_TO_PATH' | 'REFERENCE_BASED';

export interface SweepParameters {
  profileId?: string;
  pathId?: string;
  profileReference?: GeometryReference;
  pathReference?: GeometryReference;
  guideReferences?: GeometryReference[];
  guideCurves?: Array<Array<{ x: number; y: number; z?: number }>>;
  pathPoints?: Array<{ x: number; y: number; z?: number }>;
  orientation?: SweepOrientation;
  twistAngleDeg?: number;
  operation?: 'NEW' | 'JOIN' | 'CUT' | 'INTERSECT' | 'UNION';
  scale?: number;
}

export interface LoftParameters {
  sectionIds?: string[];
  sectionReferences?: GeometryReference[];
  sections?: Array<Array<{ x: number; y: number; z?: number }>>;
  guideReferences?: GeometryReference[];
  guideCurves?: Array<Array<{ x: number; y: number; z?: number }>>;
  centerlineReference?: GeometryReference;
  centerline?: Array<{ x: number; y: number; z?: number }>;
  closed?: boolean;
  solidMode?: boolean;
  continuity?: 'G0' | 'G1' | 'G2';
  startCondition?: 'NONE' | 'NORMAL_TO_PROFILE' | 'DIRECTION';
  endCondition?: 'NONE' | 'NORMAL_TO_PROFILE' | 'DIRECTION';
  sectionAlignment?: 'PROPORTIONAL' | 'DIRECT' | 'AUTO';
  operation?: 'NEW' | 'JOIN' | 'CUT' | 'INTERSECT' | 'UNION';
}

export interface FilletParameters {
  radius: number;
  edgeReferences?: GeometryReference[];
  targetSolidId?: string;
}

export interface ChamferParameters {
  distance: number;
  edgeReferences?: GeometryReference[];
  targetSolidId?: string;
}

export interface BooleanParameters {
  operation: 'UNION' | 'SUBTRACT' | 'INTERSECT' | 'CUT' | 'COMMON';
  toolShape?: any;
  toolFeatureId?: string;
  targetFeatureId?: string;
}

export interface SketchParameters {
  plane: 'XY' | 'XZ' | 'YZ' | 'CUSTOM';
  entities: Array<{
    type: 'LINE' | 'ARC' | 'CIRCLE' | 'POINT';
    id: string;
    data: Record<string, any>;
  }>;
  closedProfile: boolean;
}

export interface PatternParameters {
  sourceFeatureId: string;
  count: number;
  spacing: number;
  axis?: { x: number; y: number; z: number };
  patternType?: string;
  angle?: number;
  suppressionList?: number[];
  [key: string]: any;
}

export interface PocketParameters {
  [key: string]: any;
}

export interface MirrorParameters {
  sourceFeatureId: string;
  mirrorPlane: 'X' | 'Y' | 'Z' | 'XY' | 'XZ' | 'YZ' | string;
}

export interface DraftParameters {
  targetFaceRefs?: GeometryReference[];
  targetFaceIds?: string[];
  targetFaceId?: string;
  neutralPlaneRef?: GeometryReference;
  neutralPlane?: string | { point: { x: number; y: number; z: number }; normal: { x: number; y: number; z: number } };
  pullDirection?: { x: number; y: number; z: number };
  angle?: number;
  draftAngle?: number;
  propagation?: 'NONE' | 'TANGENT' | 'ALL_FACES';
  options?: Record<string, any>;
}

export interface ShellParameters {
  removedFaceRefs?: GeometryReference[];
  removedFaceIds?: string[];
  removedFaceId?: string;
  thickness: number;
  direction?: 'INSIDE' | 'OUTSIDE' | 'BOTH';
  propagation?: 'TANGENT' | 'NONE';
  targetSolidId?: string;
  options?: Record<string, any>;
}

export interface RibParameters {
  profileRef?: GeometryReference;
  profileId?: string;
  sketchId?: string;
  supportFaceRef?: GeometryReference;
  thickness: number;
  direction?: 'MIDPLANE' | 'SIDE1' | 'SIDE2' | { x: number; y: number; z: number };
  termination?: 'UP_TO_NEXT' | 'UP_TO_FACE' | 'THROUGH';
  draftAngle?: number;
  targetSolidId?: string;
  options?: Record<string, any>;
}

export interface ThinParameters {
  targetRefs?: GeometryReference[];
  targetIds?: string[];
  targetId?: string;
  sketchId?: string;
  profileRef?: GeometryReference;
  thickness: number;
  direction?: 'INSIDE' | 'OUTSIDE' | 'SYMMETRIC';
  side?: 'INSIDE' | 'OUTSIDE' | 'SYMMETRIC';
  termination?: 'THROUGH' | 'BLIND';
  depth?: number;
  options?: Record<string, any>;
}

export interface PlanarSurfaceParameters {
  boundaryReferences: GeometryReference[];
  tolerance?: number;
}

export interface RevolvedSurfaceParameters {
  profileReference: GeometryReference;
  axisReference: GeometryReference;
  angleDeg: number;
}

export interface SweptSurfaceParameters {
  profileReference: GeometryReference;
  pathReference: GeometryReference;
  guideReferences?: GeometryReference[];
  orientation?: SweepOrientation;
  twistAngleDeg?: number;
  scale?: number;
}

export interface LoftSurfaceParameters {
  sectionReferences: GeometryReference[];
  guideReferences?: GeometryReference[];
  centerlineReference?: GeometryReference;
  closed?: boolean;
  continuity?: 'G0' | 'G1' | 'G2';
}

export interface BoundarySurfaceParameters {
  boundaryReferences: GeometryReference[];
  tolerance?: number;
  reorient?: boolean;
}

export interface FillSurfaceParameters {
  boundaryReferences: GeometryReference[];
  continuity?: 'G0' | 'G1' | 'G2';
}

export interface BlendSurfaceParameters {
  faceReferences: GeometryReference[];
  radius: number;
  continuity?: 'G1' | 'G2';
}

export interface OffsetSurfaceParameters {
  faceReferences: GeometryReference[];
  distance: number;
  flipDirection?: boolean;
}

export interface TrimSurfaceParameters {
  targetFaceReferences: GeometryReference[];
  trimToolReference: GeometryReference;
  keepSide?: 'LEFT' | 'RIGHT' | 'BOTH';
}

export interface KnitSurfaceParameters {
  surfaceReferences: GeometryReference[];
  tolerance?: number;
}

export interface SewSurfaceParameters {
  surfaceReferences: GeometryReference[];
  tolerance?: number;
  createSolid?: boolean;
}

export interface SpringParameters {
  springType: 'COMPRESSION' | 'EXTENSION' | 'TORSION' | 'BELLEVILLE';
  wireDiameterMm: number;
  meanDiameterMm: number;
  activeCoilsCount: number;
  totalCoilsCount?: number;
  freeLengthMm: number;
  helixDirection?: 'RIGHT_HAND' | 'LEFT_HAND';
  startEndType?: string;
  endEndType?: string;
  materialGrade?: string;
  // Sweep/Geometry specific
  center?: { x: number; y: number; z: number };
  axisDirection?: { x: number; y: number; z: number };
}

export type CanonicalParameterSet = (
  | ExtrudeParameters
  | PocketParameters
  | HoleParameters
  | RevolveParameters
  | SweepParameters
  | LoftParameters
  | FilletParameters
  | ChamferParameters
  | BooleanParameters
  | SketchParameters
  | PatternParameters
  | MirrorParameters
  | DraftParameters
  | ShellParameters
  | RibParameters
  | ThinParameters
  | PlanarSurfaceParameters
  | RevolvedSurfaceParameters
  | SweptSurfaceParameters
  | LoftSurfaceParameters
  | BoundarySurfaceParameters
  | FillSurfaceParameters
  | BlendSurfaceParameters
  | OffsetSurfaceParameters
  | TrimSurfaceParameters
  | KnitSurfaceParameters
  | SewSurfaceParameters
  | SpringParameters
  | Record<string, any>
) & { [key: string]: any };

export interface CanonicalFeatureDefinition {
  type: FeatureType;
  name: string;
  parameters: CanonicalParameterSet;
  inputReferences?: GeometryReference[];
  references?: GeometryReference[];
  dependencyIds?: string[];
  [key: string]: any;
}
