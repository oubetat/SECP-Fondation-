import { ManufacturingToolType, ToolDefinition, ToolAssembly } from "../toolLibrary/types";
import { MachineKinematicModel, HomogeneousTransform, Vector3D } from "../kinematics/types";

export enum CAMOperationType {
  FACE_MILLING = "FACE_MILLING",
  ROUGHING = "ROUGHING",
  SEMI_FINISHING = "SEMI_FINISHING",
  FINISHING = "FINISHING",
  POCKETING = "POCKETING",
  CONTOURING = "CONTOURING",
  SLOT_MILLING = "SLOT_MILLING",
  PLANAR_MILLING = "PLANAR_MILLING",
  DRILLING = "DRILLING",
  BORING = "BORING",
  CHAMFERING = "CHAMFERING",
  CUSTOM = "CUSTOM",
  UNKNOWN = "UNKNOWN"
}

export enum StockType {
  BLOCK = "BLOCK",
  CYLINDER = "CYLINDER",
  MESH = "MESH",
  B_REP = "B_REP",
  CUSTOM = "CUSTOM"
}

export enum ToolpathSegmentType {
  RAPID = "RAPID",
  FEED = "FEED",
  PLUNGE = "PLUNGE",
  RETRACT = "RETRACT",
  ARC = "ARC",
  HELIX = "HELIX",
  DWELL = "DWELL",
  LINK = "LINK"
}

export enum CAMStrategyType {
  PLANAR = "PLANAR",
  CONTOUR = "CONTOUR",
  POCKET = "POCKET",
  Z_LEVEL = "Z_LEVEL",
  PARALLEL = "PARALLEL",
  CONSTANT_SCALLOP = "CONSTANT_SCALLOP",
  WATERLINE = "WATERLINE",
  SPIRAL = "SPIRAL",
  RASTER = "RASTER",
  ADAPTIVE = "ADAPTIVE",
  UNIMPLEMENTED = "UNIMPLEMENTED"
}

export enum ToolpathStatus {
  DRAFT = "DRAFT",
  GENERATED = "GENERATED",
  VALIDATED = "VALIDATED",
  QUALIFIED = "QUALIFIED",
  INVALID = "INVALID",
  SUPERSEDED = "SUPERSEDED"
}

export enum CAMVerdictType {
  GENERATED = "GENERATED",
  GENERATION_FAILED = "GENERATION_FAILED",
  VALIDATED = "VALIDATED",
  NOT_VALIDATED = "NOT_VALIDATED",
  QUALIFIED = "QUALIFIED",
  INVALID = "INVALID",
  INSUFFICIENT_DATA = "INSUFFICIENT_DATA",
  GEOMETRY_FAILURE = "GEOMETRY_FAILURE",
  KINEMATIC_FAILURE = "KINEMATIC_FAILURE",
  LIMIT_FAILURE = "LIMIT_FAILURE",
  OVER_CUT = "OVER_CUT",
  UNDER_CUT = "UNDER_CUT",
  GOUGE = "GOUGE",
  OUT_OF_TOLERANCE = "OUT_OF_TOLERANCE",
  UNREACHABLE = "UNREACHABLE",
  NUMERICAL_FAILURE = "NUMERICAL_FAILURE",
  UNDETERMINED = "UNDETERMINED",
  ORIENTATION_FAILURE = "ORIENTATION_FAILURE",
  ORIENTATION_DISCONTINUITY = "ORIENTATION_DISCONTINUITY",
  KINEMATIC_CLOSURE_FAILURE = "KINEMATIC_CLOSURE_FAILURE",
  COLLISION_DETECTED = "COLLISION_DETECTED",
  COLLISION_UNVERIFIED = "COLLISION_UNVERIFIED",
  SINGULAR = "SINGULAR"
}

export enum CAMOperationEligibility {
  ELIGIBLE = "ELIGIBLE",
  CONDITIONALLY_ELIGIBLE = "CONDITIONALLY_ELIGIBLE",
  INELIGIBLE = "INELIGIBLE",
  INSUFFICIENT_DATA = "INSUFFICIENT_DATA"
}

export interface TolerancePolicy {
  chordalTolerance: number;
  geometricTolerance: number;
  surfaceTolerance: number;
  boundaryTolerance: number;
}

export interface StockModel {
  stockId: string;
  stockRevision: number;
  type: StockType;
  dimensions: Vector3D;
  origin: Vector3D;
  geometryFingerprint: string;
  source: string;
}

export interface FixtureModel {
  fixtureId: string;
  type: string; // clamps, vise, jaws, plates
  dimensions: Vector3D;
  position: Vector3D;
}

export interface MachiningRegion {
  machiningBoundary: Vector3D[]; // 2D boundary polygons
  avoidBoundary: Vector3D[][];
  containmentBoundary?: Vector3D[];
  floorZ: number;
  topZ: number;
}

export interface CuttingConditions {
  spindleSpeed: number; // RPM
  cuttingSpeed: number; // m/min
  feedRate: number; // mm/min
  feedPerTooth: number; // mm/tooth
  feedPerRevolution: number; // mm/rev
  stepDown: number; // axial DOC (ap)
  stepOver: number; // radial DOC (ae)
  depthOfCut: number;
  widthOfCut: number;
  provenance: {
    source: string;
    sourceRevision: number;
    materialId: string;
    toolId: string;
    operationType: CAMOperationType;
  };
}

export interface CAMSetup {
  setupId: string;
  setupRevision: number;
  machineId: string;
  machineRevision: number;
  workpieceFrameId: string; // Refs CoordinateFrameGraph
  stock: StockModel;
  fixture?: FixtureModel;
  toolOrientation: Vector3D; // For 3-axis, always [0, 0, 1]
  origin: Vector3D;
  clearancePlane: number; // absolute Z height
  retractPlane: number;
  safetyPlane: number;
}

export interface CAMOperation {
  operationId: string;
  operationRevision: number;
  setupId: string;
  featureIds: string[];
  toolId: string;
  toolAssemblyId: string;
  machineId: string;
  strategy: CAMStrategyType;
  operationType: CAMOperationType;
  geometryReference: string; // B-Rep reference identifier
  stockReference: string;
  cuttingConditions: CuttingConditions;
  tolerancePolicy: TolerancePolicy;
  status: ToolpathStatus;
  fingerprint: string;
}

export interface ToolpathPoint {
  x: number;
  y: number;
  z: number;
  feed: number;
  spindle: number;
  segmentType: ToolpathSegmentType;
  sequence: number;
}

export interface ToolpathSegment {
  segmentId: string;
  segmentType: ToolpathSegmentType;
  points: ToolpathPoint[];
  startPoint: ToolpathPoint;
  endPoint: ToolpathPoint;
}

export interface Toolpath {
  toolpathId: string;
  operationId: string;
  toolpathRevision: number;
  segments: ToolpathSegment[];
  coordinateFrameId: string;
  toolId: string;
  machineId: string;
  tolerancePolicy: TolerancePolicy;
  generationMetadata: {
    timestamp: string;
    algorithmRevision: number;
    toolAssemblyRevision: number;
    machineRevision: number;
  };
  fingerprint: string;
  status: ToolpathStatus;
}

export interface MaterialRemovalStats {
  initialStockVolume: number;
  removedVolume: number;
  remainingStockVolume: number;
}

export interface CAMProgram {
  programId: string;
  setup: CAMSetup;
  operations: CAMOperation[];
  toolLibraryRevision: number;
  machineRevision: number;
  materialRevision: number;
}

export interface ToolpathValidationAnomaly {
  code: string;
  severity: "CRITICAL" | "WARNING" | "INFO";
  message: string;
  segmentId?: string;
  sequenceId?: number;
}

export interface ToolpathValidationReport {
  reportId: string;
  toolpathId: string;
  operationId: string;
  verdict: CAMVerdictType;
  timestamp: string;
  kinematicPassed: boolean;
  boundsPassed: boolean;
  gougeFree: boolean;
  limitCompliance: boolean;
  anomalies: ToolpathValidationAnomaly[];
  signature: string;
}

// ============================================================================
// PATCH-105: 5-Axis Simultaneous CAM Type System
// ============================================================================

export interface FiveAxisToolPose {
  position: Vector3D; // X, Y, Z
  toolAxis: Vector3D; // I, J, K (Normalized |v| ≈ 1)
  toolOrientation: Vector3D; // Secondary reference axis / vector or Euler representation
  coordinateFrame: string; // WCS, MCS, Tool Frame
  sequence: number;
}

export interface ToolOrientationField {
  poses: FiveAxisToolPose[];
  domainRange: { min: number; max: number };
}

export enum OrientationInterpolation {
  SLERP = "SLERP",
  LINEAR_VECTOR = "LINEAR_VECTOR",
  AXIS_ANGLE = "AXIS_ANGLE",
  MACHINE_DEFINED = "MACHINE_DEFINED"
}

export enum DriveSurfaceType {
  B_REP = "B_REP",
  NURBS = "NURBS",
  TRIMMED = "TRIMMED",
  MESH_DERIVED = "MESH_DERIVED"
}

export interface FiveAxisDriveSurface {
  surfaceId: string;
  type: DriveSurfaceType;
  geometryData: any; // Solid/face parameters or reference ID
  sourceOfTruth: string; // CAD model entity hash
}

export enum DriveCurveType {
  CURVE_3D = "CURVE_3D",
  SURFACE_CURVE = "SURFACE_CURVE",
  UV_CURVE = "UV_CURVE",
  BOUNDARY_CURVE = "BOUNDARY_CURVE",
  GUIDE_CURVE = "GUIDE_CURVE"
}

export interface FiveAxisDriveCurve {
  curveId: string;
  type: DriveCurveType;
  points: Vector3D[];
  parameterization?: number[]; // U/V parameter range
}

export interface GuideCurvesSet {
  leadingGuide?: FiveAxisDriveCurve;
  trailingGuide?: FiveAxisDriveCurve;
  sideGuide?: FiveAxisDriveCurve;
  orientationGuide?: FiveAxisDriveCurve;
}

export interface CheckSurfaceSet {
  keepOutSurface: FiveAxisDriveSurface[];
  avoidSurface: FiveAxisDriveSurface[];
  checkSurface: FiveAxisDriveSurface[];
  protectedSurface: FiveAxisDriveSurface[];
}

export interface MachiningContainment {
  allowedRegion: Vector3D[]; // 3D boundary polygon
  restrictedRegion: Vector3D[][]; // Exclusion loops
  entryRegion?: Vector3D[];
  exitRegion?: Vector3D[];
}

export enum FiveAxisStrategy {
  SWARF = "SWARF",
  MULTI_AXIS_CONTOUR = "MULTI_AXIS_CONTOUR",
  MULTI_AXIS_SURFACE = "MULTI_AXIS_SURFACE",
  FLOW = "FLOW",
  MORPH = "MORPH",
  PARALLEL = "PARALLEL",
  CONSTANT_SCALLOP = "CONSTANT_SCALLOP",
  GUIDE_CURVE = "GUIDE_CURVE",
  PROJECT_CURVE = "PROJECT_CURVE",
  PORT = "PORT",
  BLEND = "BLEND",
  IMPELLER = "IMPELLER",
  CUSTOM = "CUSTOM"
}

export enum ToolOrientationPolicyType {
  FIXED = "FIXED",
  NORMAL_TO_SURFACE = "NORMAL_TO_SURFACE",
  LEAD_TILT = "LEAD_TILT",
  LEAD_ONLY = "LEAD_ONLY",
  TILT_ONLY = "TILT_ONLY",
  GUIDE_CURVE = "GUIDE_CURVE",
  TARGET_VECTOR = "TARGET_VECTOR",
  SMOOTHED_FIELD = "SMOOTHED_FIELD",
  CUSTOM = "CUSTOM"
}

export interface LeadAngle {
  value: number; // Signed numeric angle (radians)
  unit: "RADIANS" | "DEGREES";
  referenceFrame: string;
  explicit: boolean;
}

export interface TiltAngle {
  value: number; // Signed numeric angle (radians)
  unit: "RADIANS" | "DEGREES";
  referenceFrame: string;
  explicit: boolean;
}

export interface SurfaceFrame {
  point: Vector3D;
  normal: Vector3D;
  tangentU: Vector3D;
  tangentV: Vector3D;
}

export enum SingularityProximity {
  SAFE = "SAFE",
  NEAR_SINGULAR = "NEAR_SINGULAR",
  SINGULAR = "SINGULAR",
  UNDETERMINED = "UNDETERMINED"
}

export enum OrientationSmoothingVerdict {
  SMOOTHED = "SMOOTHED",
  UNCHANGED = "UNCHANGED",
  FAILED = "FAILED",
  OUT_OF_TOLERANCE = "OUT_OF_TOLERANCE"
}

export enum ContactType {
  TIP = "TIP",
  BALL = "BALL",
  FLANK = "FLANK",
  SIDE = "SIDE",
  EDGE = "EDGE",
  CUSTOM = "CUSTOM"
}

export interface ToolContactPoint {
  surfacePoint: Vector3D;
  contactNormal: Vector3D;
  toolContactLocation: Vector3D;
  contactType: ContactType;
}

export enum DetectionStatus {
  DETECTED = "DETECTED",
  NOT_DETECTED = "NOT_DETECTED",
  UNDETERMINED = "UNDETERMINED"
}

export interface FiveAxisCollisionContract {
  toolpathId: string;
  toolAssembly: ToolAssembly;
  machineState: any; // Axis kinematic positions
  fixture: FixtureModel;
  workpiece: StockModel;
  machineGeometry: any; // Kinematic link meshes or bounding hierarchies
  samplingPolicy: string;
  tolerance: number;
}

export enum SurfaceAccessibility {
  ACCESSIBLE = "ACCESSIBLE",
  PARTIALLY_ACCESSIBLE = "PARTIALLY_ACCESSIBLE",
  INACCESSIBLE = "INACCESSIBLE",
  UNDETERMINED = "UNDETERMINED"
}

export enum FiveAxisSegmentType {
  CUT = "CUT",
  RAPID = "RAPID",
  LINK = "LINK",
  PLUNGE = "PLUNGE",
  RETRACT = "RETRACT",
  ORIENTATION_TRANSITION = "ORIENTATION_TRANSITION"
}

export interface FiveAxisToolpathPoint {
  position: Vector3D; // X, Y, Z
  toolAxis: Vector3D; // I, J, K
  orientation: Vector3D; // Euler rotary orientations or tool side reference
  feed: number;
  spindle: number;
  sequence: number;
}

export interface FiveAxisToolpathSegment {
  segmentId: string;
  segmentType: FiveAxisSegmentType;
  points: FiveAxisToolpathPoint[];
}

export interface FiveAxisToolpath {
  toolpathId: string;
  operationId: string;
  toolpathRevision: number;
  segments: FiveAxisToolpathSegment[];
  fingerprint: string;
}

export interface MachineAxisState {
  X: number;
  Y: number;
  Z: number;
  A: number; // rotary primary
  B: number; // rotary secondary
  C: number; // rotary tertiary
}

export interface MachineAxisToolpath {
  axisPositions: MachineAxisState[];
  axisVelocities: MachineAxisState[];
  axisAccelerations: MachineAxisState[];
  toolPose: FiveAxisToolPose[];
  sequence: number[];
}


