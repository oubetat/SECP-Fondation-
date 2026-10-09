// SECP Industrial OS v2 — PATCH-123: Geometry Twin Types

export type GeometryType =
  | 'SOLID'
  | 'SHELL'
  | 'SURFACE'
  | 'WIRE'
  | 'CURVE'
  | 'POINT'
  | 'MESH'
  | 'ASSEMBLY_OCCURRENCE'
  | 'COMPOSITE';

export type LengthUnit = 'mm' | 'cm' | 'm' | 'inch' | 'micron';

export type Handedness = 'RIGHT_HANDED' | 'LEFT_HANDED';

export type GeometricValidityVerdict =
  | 'VALID'
  | 'INVALID'
  | 'DEGENERATE'
  | 'NON_MANIFOLD'
  | 'SELF_INTERSECTING'
  | 'OPEN'
  | 'UNKNOWN';

export type RoundTripVerdict =
  | 'ROUND_TRIP_EXACT'
  | 'ROUND_TRIP_EQUIVALENT'
  | 'ROUND_TRIP_DEGRADED'
  | 'ROUND_TRIP_FAILED'
  | 'INVALID';

export type MeasurementComparisonVerdict =
  | 'WITHIN_TOLERANCE'
  | 'OUT_OF_TOLERANCE'
  | 'INCOMPLETE'
  | 'INVALID';

export type GeometryFreshness = 'FRESH' | 'STALE' | 'UNKNOWN';

export type GeometryClosureStatus = 'OPEN' | 'PARTIAL' | 'COMPLETE' | 'BLOCKED' | 'INVALID';

export type DifferentialVerdict = 'MATCH' | 'MISMATCH' | 'INCOMPLETE' | 'INVALID';

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export interface GeometryCoordinateSystem {
  origin: Vector3D;
  basisX: Vector3D;
  basisY: Vector3D;
  basisZ: Vector3D;
  units: LengthUnit;
  handedness: Handedness;
  canonicalUnit?: LengthUnit;
  conversionFactorToCanonical?: number;
}

export interface GeometryToleranceModel {
  vertexTolerance: number;
  edgeTolerance: number;
  faceTolerance: number;
  modelTolerance: number;
  angularTolerance: number; // in radians
  version: number;
}

export interface VertexEntity {
  vertexId: string;
  point: Vector3D;
  tolerance: number;
  canonicalHash?: string;
}

export interface EdgeEntity {
  edgeId: string;
  curveType: 'LINE' | 'CIRCLE' | 'ARC' | 'ELLIPSE' | 'NURBS_CURVE' | 'BEZIER' | 'OTHER';
  curveDefinitionHash: string;
  startVertexId: string;
  endVertexId: string;
  orientation: 'FORWARD' | 'REVERSED';
  length?: number;
}

export interface LoopEntity {
  loopId: string;
  edgeIds: string[]; // Ordered list of edge IDs forming loop
  isOuter: boolean;
  isClosed: boolean;
}

export interface FaceEntity {
  faceId: string;
  surfaceType: 'PLANE' | 'CYLINDER' | 'CONE' | 'SPHERE' | 'TORUS' | 'NURBS_SURFACE' | 'BSPLINE' | 'OTHER';
  surfaceDefinitionHash: string;
  outerLoopId: string;
  innerLoopIds: string[];
  orientation: 'FORWARD' | 'REVERSED';
  boundaryHash: string;
  area?: number;
}

export interface ShellEntity {
  shellId: string;
  faceIds: string[];
  isClosed: boolean;
  isManifold: boolean;
}

export interface SolidEntity {
  solidId: string;
  outerShellId: string;
  voidShellIds: string[]; // Internal voids/cavities
  volume?: number;
  isClosed: boolean;
}

export interface BRepTwinDefinition {
  vertices: VertexEntity[];
  edges: EdgeEntity[];
  loops: LoopEntity[];
  faces: FaceEntity[];
  shells: ShellEntity[];
  solids: SolidEntity[];
  vertexCount: number;
  edgeCount: number;
  wireCount: number;
  faceCount: number;
  shellCount: number;
  solidCount: number;
  bRepHash: string;
  topologyHash: string;
}

export interface NURBSCurveDefinition {
  curveId: string;
  degree: number;
  knots: number[];
  weights: number[];
  controlPoints: Vector3D[];
  multiplicities: number[];
  isRational: boolean;
  parameterDomain: [number, number];
  curveHash: string;
}

export interface NURBSSurfaceDefinition {
  surfaceId: string;
  degreeU: number;
  degreeV: number;
  knotsU: number[];
  knotsV: number[];
  weights: number[][]; // 2D array matching control points grid
  controlPoints: Vector3D[][]; // 2D array of control points
  multiplicitiesU: number[];
  multiplicitiesV: number[];
  isRational: boolean;
  parameterDomainU: [number, number];
  parameterDomainV: [number, number];
  surfaceHash: string;
}

export type AnalyticSurfaceType = 'PLANE' | 'CYLINDER' | 'CONE' | 'SPHERE' | 'TORUS';
export type AnalyticCurveType = 'LINE' | 'CIRCLE' | 'ARC' | 'ELLIPSE';

export interface AnalyticGeometryDefinition {
  entityId: string;
  type: AnalyticSurfaceType | AnalyticCurveType;
  origin: Vector3D;
  axis: Vector3D;
  refDirection?: Vector3D;
  radius?: number;
  majorRadius?: number;
  minorRadius?: number;
  semiAngle?: number; // Cone angle
  parameterDomain?: [number, number];
  orientation: 'FORWARD' | 'REVERSED';
  analyticHash: string;
}

export interface AABB {
  min: Vector3D;
  max: Vector3D;
  center: Vector3D;
  extents: Vector3D;
}

export interface MassProperties {
  volume: number;
  surfaceArea: number;
  centerOfMass: Vector3D;
  principalAxes: [Vector3D, Vector3D, Vector3D];
  momentsOfInertia: [number, number, number];
}

export interface GeometryEvidence {
  evidenceId: string;
  source: string;
  geometryHash: string;
  topologyHash: string;
  revision: string;
  operation: string;
  actor: string;
  timestamp: string;
  evidenceHash: string;
}

export interface GeometryHealingEvent {
  healingId: string;
  inputGeometryHash: string;
  outputGeometryHash: string;
  operations: string[];
  kernel: string;
  kernelVersion: string;
  tolerance: number;
  timestamp: string;
  result: 'SUCCESS' | 'PARTIAL' | 'FAILED';
}

export interface GeometryRevision {
  revisionId: string;
  parentRevisionId: string | null;
  geometryHash: string;
  topologyHash: string;
  changeSet: string[];
  author: string;
  timestamp: string;
  reason: string;
}

export interface GeometryOccurrence {
  occurrenceId: string;
  componentId: string;
  componentRevision: string;
  definitionGeometryHash: string;
  transformMatrix: number[][]; // 4x4
  determinant: number;
  isRigid: boolean;
  scaleFactor: number;
  configurationId: string;
}

export interface AsManufacturedInspection {
  inspectionId: string;
  geometryRevision: string;
  measuredPoints: Vector3D[];
  measurementMethod: 'CMM' | 'LASER_SCANNER' | 'OPTICAL_COMPARATOR' | 'CT_SCAN';
  measurementDevice: string;
  calibrationId: string;
  measurementAccuracy: number;
  measurementTimestamp: string;
  measurementDataHash: string;
  algorithmVersion: string;
}

export interface DeviationMap {
  maxDeviation: number;
  minDeviation: number;
  meanDeviation: number;
  RMSDeviation: number;
  deviationDistribution: { [range: string]: number };
  pointDeviations: { point: Vector3D; nominalPoint: Vector3D; deviation: number }[];
}

export interface GeometryTwin {
  geometryTwinId: string;
  subjectId: string;
  geometryId: string;
  geometryRevisionId: string;
  geometryType: GeometryType;
  kernel: string;
  kernelVersion: string;
  topologyVersion: string;
  configurationId: string;
  variantId: string;
  coordinateSystem: GeometryCoordinateSystem;
  toleranceModel: GeometryToleranceModel;
  bRep?: BRepTwinDefinition;
  nurbsSurfaces?: NURBSSurfaceDefinition[];
  nurbsCurves?: NURBSCurveDefinition[];
  analyticEntities?: AnalyticGeometryDefinition[];
  occurrences?: GeometryOccurrence[];
  aabb: AABB;
  massProperties?: MassProperties;
  createdAt: string;
  updatedAt: string;
  state: 'DESIGN' | 'RELEASED' | 'MANUFACTURED' | 'INSPECTED' | 'ARCHIVED';
  geometryHash: string;
  topologyHash: string;
  rootHash: string;
  evidence: GeometryEvidence[];
  healingHistory: GeometryHealingEvent[];
  revisions: GeometryRevision[];
  latestInspection?: {
    inspection: AsManufacturedInspection;
    deviationMap: DeviationMap;
    verdict: MeasurementComparisonVerdict;
  };
}

export interface GeometrySnapshot {
  snapshotId: string;
  geometryTwinId: string;
  revisionId: string;
  timestamp: string;
  state: GeometryTwin;
  rootHash: string;
}
