import { PropertyProvenance } from "../../materials/types";
import { ToolAssembly, ToolDefinition } from "../toolLibrary/types";
import { MachineKinematicModel } from "../kinematics/types";

export interface FiveAxisPoint {
  position: Point3D;
  toolAxis: Vector3D;
  toolOrientation?: Vector3D;
  feedRate?: number;
  spindleSpeed?: number;
  sequenceNumber?: number;
}

export interface FiveAxisToolpath {
  toolpathId: string;
  operationId?: string;
  points: FiveAxisPoint[];
  tolerance?: number;
  totalLength?: number;
  estimatedTimeSeconds?: number;
}

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export interface AABB3D {
  min: Point3D;
  max: Point3D;
}

export interface OBB3D {
  center: Point3D;
  extents: Point3D; // half lengths along local axes
  axes: [Vector3D, Vector3D, Vector3D]; // 3 orthonormal orientation axes
}

export interface Capsule3D {
  p1: Point3D;
  p2: Point3D;
  radius: number;
}

export interface Cylinder3D {
  base: Point3D;
  axis: Vector3D;
  length: number;
  radius: number;
}

export interface Triangle3D {
  v1: Point3D;
  v2: Point3D;
  v3: Point3D;
  normal?: Vector3D;
}

export enum CollisionObjectType {
  TOOL = "TOOL",
  TOOL_HOLDER = "TOOL_HOLDER",
  SPINDLE = "SPINDLE",
  MACHINE_HEAD = "MACHINE_HEAD",
  MACHINE_TABLE = "MACHINE_TABLE",
  FIXTURE = "FIXTURE",
  STOCK = "STOCK",
  WORKPIECE = "WORKPIECE",
  CHECK_SURFACE = "CHECK_SURFACE",
  KEEP_OUT_VOLUME = "KEEP_OUT_VOLUME",
  CUSTOM = "CUSTOM"
}

export enum CollisionHierarchyType {
  CRITICAL = "CRITICAL",
  WARNING = "WARNING",
  CONTACT = "CONTACT",
  CLEARANCE_VIOLATION = "CLEARANCE_VIOLATION",
  INTERFERENCE = "INTERFERENCE",
  GOUGE = "GOUGE"
}

export enum CollisionSeverity {
  NONE = "NONE",
  ADVISORY = "ADVISORY",
  WARNING = "WARNING",
  MAJOR = "MAJOR",
  CRITICAL = "CRITICAL"
}

export enum ContactClassification {
  VALID_CONTACT = "VALID_CONTACT",
  UNINTENDED_CONTACT = "UNINTENDED_CONTACT",
  INTENDED_MATERIAL_REMOVAL = "INTENDED_MATERIAL_REMOVAL",
  UNINTENDED_INTERFERENCE = "UNINTENDED_INTERFERENCE"
}

export enum ClearanceState {
  CLEAR = "CLEAR",
  MARGINAL = "MARGINAL",
  VIOLATED = "VIOLATED",
  UNKNOWN = "UNKNOWN"
}

export enum BroadPhaseVerdict {
  CANDIDATE = "CANDIDATE",
  DISJOINT = "DISJOINT",
  POSSIBLE_INTERSECTION = "POSSIBLE_INTERSECTION",
  UNKNOWN = "UNKNOWN"
}

export enum NarrowPhaseVerdict {
  DISJOINT = "DISJOINT",
  CONTACT = "CONTACT",
  INTERSECTION = "INTERSECTION",
  PENETRATION = "PENETRATION",
  UNKNOWN = "UNKNOWN"
}

export enum SweptVolumeType {
  LINEAR_SWEEP = "LINEAR_SWEEP",
  ROTATIONAL_SWEEP = "ROTATIONAL_SWEEP",
  SIX_DOF_SWEEP = "SIX_DOF_SWEEP",
  APPROXIMATED_SWEEP = "APPROXIMATED_SWEEP",
  EXACT_OR_SUPPORTED_SWEEP = "EXACT_OR_SUPPORTED_SWEEP"
}

export enum AvoidanceStrategy {
  RETRACT = "RETRACT",
  REORIENT = "REORIENT",
  TILT_ADJUSTMENT = "TILT_ADJUSTMENT",
  LEAD_ADJUSTMENT = "LEAD_ADJUSTMENT",
  LOCAL_DEVIATION = "LOCAL_DEVIATION",
  PATH_SHIFT = "PATH_SHIFT",
  PATH_REGENERATE = "PATH_REGENERATE",
  ALTERNATIVE_IK = "ALTERNATIVE_IK",
  SLOWDOWN = "SLOWDOWN",
  STOP = "STOP"
}

export enum AvoidanceFailureReason {
  NO_SAFE_PATH = "NO_SAFE_PATH",
  NO_VALID_ORIENTATION = "NO_VALID_ORIENTATION",
  NO_REACHABLE_IK = "NO_REACHABLE_IK",
  LIMIT_CONFLICT = "LIMIT_CONFLICT",
  COLLISION_PERSISTENT = "COLLISION_PERSISTENT",
  GEOMETRY_CONSTRAINT_CONFLICT = "GEOMETRY_CONSTRAINT_CONFLICT",
  NUMERICAL_FAILURE = "NUMERICAL_FAILURE"
}

export enum AvoidanceVerdict {
  AVOIDED = "AVOIDED",
  NOT_AVOIDED = "NOT_AVOIDED",
  NO_SAFE_PATH = "NO_SAFE_PATH",
  REPLANNED = "REPLANNED",
  REVERIFICATION_FAILED = "REVERIFICATION_FAILED",
  UNDETERMINED = "UNDETERMINED"
}

export enum TrueCollisionVerdict {
  COLLISION_FREE = "COLLISION_FREE",
  COLLISION_DETECTED = "COLLISION_DETECTED",
  COLLISION_UNDETERMINED = "COLLISION_UNDETERMINED",
  CONTACT_ONLY = "CONTACT_ONLY",
  CLEARANCE_VIOLATION = "CLEARANCE_VIOLATION",
  GOUGE = "GOUGE",
  HOLDER_COLLISION = "HOLDER_COLLISION",
  SPINDLE_COLLISION = "SPINDLE_COLLISION",
  MACHINE_COLLISION = "MACHINE_COLLISION",
  FIXTURE_COLLISION = "FIXTURE_COLLISION",
  STOCK_INTERFERENCE = "STOCK_INTERFERENCE",
  WORKPIECE_INTERFERENCE = "WORKPIECE_INTERFERENCE"
}

export enum GeometryRepType {
  EXACT_BREP = "EXACT_BREP",
  TRIANGLE_MESH = "TRIANGLE_MESH",
  OBB = "OBB",
  AABB = "AABB",
  BVH = "BVH",
  CONVEX_HULL = "CONVEX_HULL",
  SDF = "SDF",
  CYLINDER_CAPSULE = "CYLINDER_CAPSULE"
}

export interface CollisionObject {
  objectId: string;
  name: string;
  type: CollisionObjectType;
  geometryType: GeometryRepType;
  aabb: AABB3D;
  obb?: OBB3D;
  capsule?: Capsule3D;
  cylinder?: Cylinder3D;
  triangles?: Triangle3D[];
  parentJointId?: string;
  offsetFromParent?: Point3D;
  isActive: boolean;
}

export interface CollisionPair {
  pairId: string;
  objectAId: string;
  objectBId: string;
  objectAType: CollisionObjectType;
  objectBType: CollisionObjectType;
  allowedContactType: ContactClassification;
  clearanceRequirement: ClearanceRequirement;
  enabled: boolean;
}

export interface ClearanceRequirement {
  minimumDistance: number; // in mm
  objectPair: [CollisionObjectType, CollisionObjectType];
  tolerance: number; // in mm
  policy: "STRICT" | "ALLOW_MARGINAL" | "CONTACT_TOLERANT";
  source: string;
}

export interface CollisionTolerancePolicy {
  geometricTolerance: number; // e.g. 0.005 mm
  collisionTolerance: number; // e.g. 0.001 mm
  contactTolerance: number;   // e.g. 0.02 mm
  clearanceTolerance: number; // e.g. 1.0 mm (warning zone)
  angularToleranceDeg: number;// e.g. 0.1 deg
}

export interface DistanceQueryResult {
  minimumDistance: number;
  closestPointA: Point3D;
  closestPointB: Point3D;
  normal: Vector3D;
  pair: [string, string];
  confidence: number;
}

export interface PenetrationDepthResult {
  penetrationDepth: number; // 0 if disjoint
  penetrationLocation: Point3D;
  penetrationPair: [string, string];
  estimatedVolume?: number;
}

export interface MachineStateCapture {
  machineRevision: string;
  jointPositions: Record<string, number>;
  toolPose: {
    position: Point3D;
    toolAxis: Vector3D;
  };
  feedRate: number;
  spindleSpeed: number;
  timestamp: string;
}

export interface CollisionEvent {
  eventId: string;
  toolpathId: string;
  segmentId: string;
  sampleIndex: number;
  timestampOrSequence: number;
  objectA: CollisionObject;
  objectB: CollisionObject;
  classification: CollisionHierarchyType;
  severity: CollisionSeverity;
  minimumDistance: number;
  penetrationDepth: number;
  location: Point3D;
  machineState: MachineStateCapture;
  contextMessage: string;
}

export interface SamplingPolicy {
  sampleCount: number;
  minimumStep: number; // in mm
  maximumStep: number; // in mm
  adaptiveTriggers: string[];
  coverageMetric: number; // 0.0 to 1.0
  continuousMotionEnabled: boolean;
  minAngularStepDeg: number;
}

export interface SweptVolumeConfig {
  sweepType: SweptVolumeType;
  intermediateSteps: number;
  envelopeExpansionTol: number;
}

export interface SweptVolumeResult {
  boundingBox: AABB3D;
  intermediatePoses: Array<{
    position: Point3D;
    toolAxis: Vector3D;
    t: number;
  }>;
  sweptRadius: number;
}

export interface AvoidanceCandidate {
  candidateId: string;
  sourceCollisionId: string;
  modifiedPath: FiveAxisToolpath;
  modificationType: AvoidanceStrategy;
  geometricDeviation: number; // max euclidean offset in mm
  orientationDeviationDeg: number; // max angular deviation
  axisMotionCost: number; // kinetic/rotational cost
  clearanceGain: number; // distance improvement in mm
  riskScore: number; // 0 (safest) to 100
  valid: boolean;
}

export interface CandidateRanking {
  candidates: AvoidanceCandidate[];
  bestCandidateId: string | null;
  rankingCriteria: string[];
}

export interface CollisionModel {
  collisionModelId: string;
  revision: number;
  machineGeometry: CollisionObject[];
  toolAssembly: CollisionObject[];
  stock: CollisionObject;
  workpiece: CollisionObject;
  fixture: CollisionObject[];
  checkSurfaces: CollisionObject[];
  keepOutVolumes: CollisionObject[];
  tolerance: CollisionTolerancePolicy;
  samplingPolicy: SamplingPolicy;
}

export interface CollisionMap {
  toolpathId: string;
  segments: Array<{
    segmentId: string;
    location: Point3D;
    minDistance: number;
    severity: CollisionSeverity;
    event?: CollisionEvent;
  }>;
  overallStatus: TrueCollisionVerdict;
}

export interface ClearanceProfile {
  toolpathId: string;
  samples: Array<{
    s: number; // normalized parameter 0..1
    arcLength: number; // mm
    minDistance: number;
    clearanceState: ClearanceState;
    closestPair: [string, string];
  }>;
  globalMinDistance: number;
}

export interface CollisionFingerprint {
  toolpathFingerprint: string;
  collisionModelFingerprint: string;
  samplingPolicyFingerprint: string;
  engineRevision: string;
  eventSetHash: string;
  deterministicHash: string;
}

export interface CollisionDetectionReport {
  reportId: string;
  timestamp: string;
  collisionModelId: string;
  toolpathId: string;
  verdict: TrueCollisionVerdict;
  collisionEvents: CollisionEvent[];
  minClearance: number;
  broadPhasePruned: number;
  narrowPhaseChecked: number;
  samplingCoverage: number;
  fingerprint: CollisionFingerprint;
  provenSafe: boolean;
}

export interface AvoidanceResult {
  reportId: string;
  originalToolpathId: string;
  verdict: AvoidanceVerdict;
  strategyUsed?: AvoidanceStrategy;
  chosenCandidate?: AvoidanceCandidate;
  replannedToolpath?: FiveAxisToolpath;
  revalidationReport?: CollisionDetectionReport;
  failureReason?: AvoidanceFailureReason;
  message: string;
}
