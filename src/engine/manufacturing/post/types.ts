import { PropertyProvenance } from "../../materials/types";
import { Point3D, Vector3D } from "../collision/types";
import { MachineAxisType, MachineType } from "../kinematics/types";

export enum NCDialect {
  GENERIC_GCODE = "GENERIC_GCODE",
  ISO_NC = "ISO_NC",
  FANUC_LIKE = "FANUC_LIKE",
  SIEMENS_LIKE = "SIEMENS_LIKE",
  HEIDENHAIN_LIKE = "HEIDENHAIN_LIKE",
  MITSUBISHI_LIKE = "MITSUBISHI_LIKE",
  CUSTOM = "CUSTOM"
}

export enum DialectImplementationStatus {
  IMPLEMENTED = "IMPLEMENTED",
  PARTIAL = "PARTIAL",
  UNIMPLEMENTED = "UNIMPLEMENTED"
}

export enum PostProcessorLifecycleState {
  UNINITIALIZED = "UNINITIALIZED",
  READY = "READY",
  PROCESSING = "PROCESSING",
  GENERATED = "GENERATED",
  VALIDATED = "VALIDATED",
  FAILED = "FAILED",
  INVALID = "INVALID"
}

export enum NCCommandType {
  RAPID_MOVE = "RAPID_MOVE",
  LINEAR_MOVE = "LINEAR_MOVE",
  ARC_MOVE = "ARC_MOVE",
  SPLINE_MOVE = "SPLINE_MOVE",
  TOOL_CHANGE = "TOOL_CHANGE",
  SPINDLE_START = "SPINDLE_START",
  SPINDLE_STOP = "SPINDLE_STOP",
  COOLANT_ON = "COOLANT_ON",
  COOLANT_OFF = "COOLANT_OFF",
  DWELL = "DWELL",
  PROGRAM_START = "PROGRAM_START",
  PROGRAM_END = "PROGRAM_END",
  WORK_OFFSET = "WORK_OFFSET",
  TOOL_OFFSET = "TOOL_OFFSET",
  COMMENT = "COMMENT",
  SUBPROGRAM_CALL = "SUBPROGRAM_CALL",
  SUBPROGRAM_RETURN = "SUBPROGRAM_RETURN",
  CUSTOM_COMMAND = "CUSTOM_COMMAND",
  CANNED_CYCLE = "CANNED_CYCLE"
}

export enum ArcPlane {
  XY_G17 = "XY_G17",
  XZ_G18 = "XZ_G18",
  YZ_G19 = "YZ_G19"
}

export enum ArcDirection {
  CW = "CW",
  CCW = "CCW"
}

export enum FeedMode {
  FEED_PER_MINUTE = "FEED_PER_MINUTE",
  FEED_PER_REVOLUTION = "FEED_PER_REVOLUTION",
  INVERSE_TIME = "INVERSE_TIME",
  CONTROLLER_SPECIFIC = "CONTROLLER_SPECIFIC"
}

export enum SpindleMode {
  RPM = "RPM",
  CSS = "CSS",
  OFF = "OFF"
}

export enum SpindleDirection {
  CW = "CW",
  CCW = "CCW",
  STOP = "STOP"
}

export enum CutterCompensationMode {
  NONE = "NONE",
  LEFT = "LEFT",
  RIGHT = "RIGHT",
  THREE_D = "THREE_D",
  CONTROLLER_NATIVE = "CONTROLLER_NATIVE"
}

export enum CannedCycleType {
  DRILL = "DRILL",
  PECK_DRILL = "PECK_DRILL",
  TAP = "TAP",
  BORE = "BORE",
  REAM = "REAM",
  CUSTOM = "CUSTOM"
}

export enum MacroSupportStatus {
  SUPPORTED = "SUPPORTED",
  UNSUPPORTED = "UNSUPPORTED",
  PARTIAL = "PARTIAL",
  UNKNOWN = "UNKNOWN"
}

export enum NCSafetyStatus {
  UNVERIFIED = "UNVERIFIED",
  SYNTAX_VALIDATED = "SYNTAX_VALIDATED",
  SEMANTICALLY_VALIDATED = "SEMANTICALLY_VALIDATED",
  KINEMATICALLY_VALIDATED = "KINEMATICALLY_VALIDATED",
  GEOMETRICALLY_VALIDATED = "GEOMETRICALLY_VALIDATED",
  COLLISION_VALIDATED = "COLLISION_VALIDATED",
  QUALIFIED = "QUALIFIED",
  INVALID = "INVALID"
}

export enum NCProgramStatus {
  DRAFT = "DRAFT",
  GENERATED = "GENERATED",
  SYNTAX_VALIDATED = "SYNTAX_VALIDATED",
  SEMANTICALLY_VALIDATED = "SEMANTICALLY_VALIDATED",
  KINEMATICALLY_VALIDATED = "KINEMATICALLY_VALIDATED",
  COLLISION_VALIDATED = "COLLISION_VALIDATED",
  QUALIFIED = "QUALIFIED",
  INVALID = "INVALID",
  SUPERSEDED = "SUPERSEDED"
}

export enum PostErrorCode {
  POST_INPUT_INVALID = "POST_INPUT_INVALID",
  POST_CONFIGURATION_INVALID = "POST_CONFIGURATION_INVALID",
  UNSUPPORTED_CONTROLLER_FEATURE = "UNSUPPORTED_CONTROLLER_FEATURE",
  AXIS_MAPPING_FAILURE = "AXIS_MAPPING_FAILURE",
  AXIS_LIMIT_FAILURE = "AXIS_LIMIT_FAILURE",
  ROTARY_CONVENTION_FAILURE = "ROTARY_CONVENTION_FAILURE",
  TOOL_CONFIGURATION_FAILURE = "TOOL_CONFIGURATION_FAILURE",
  FEED_CONFIGURATION_FAILURE = "FEED_CONFIGURATION_FAILURE",
  SPINDLE_CONFIGURATION_FAILURE = "SPINDLE_CONFIGURATION_FAILURE",
  FORMAT_FAILURE = "FORMAT_FAILURE",
  ROUNDING_FAILURE = "ROUNDING_FAILURE",
  NC_GENERATION_FAILURE = "NC_GENERATION_FAILURE",
  NC_SYNTAX_FAILURE = "NC_SYNTAX_FAILURE",
  NC_SEMANTIC_FAILURE = "NC_SEMANTIC_FAILURE",
  NC_ROUND_TRIP_FAILURE = "NC_ROUND_TRIP_FAILURE",
  NC_KINEMATIC_FAILURE = "NC_KINEMATIC_FAILURE",
  NC_GEOMETRIC_FAILURE = "NC_GEOMETRIC_FAILURE",
  NC_COLLISION_FAILURE = "NC_COLLISION_FAILURE"
}

export enum PostTrueVerdict {
  GENERATED = "GENERATED",
  GENERATION_FAILED = "GENERATION_FAILED",
  SYNTAX_VALIDATED = "SYNTAX_VALIDATED",
  SYNTAX_INVALID = "SYNTAX_INVALID",
  SEMANTICALLY_VALIDATED = "SEMANTICALLY_VALIDATED",
  SEMANTICALLY_INVALID = "SEMANTICALLY_INVALID",
  KINEMATICALLY_VALIDATED = "KINEMATICALLY_VALIDATED",
  KINEMATICALLY_INVALID = "KINEMATICALLY_INVALID",
  ROUND_TRIP_VALIDATED = "ROUND_TRIP_VALIDATED",
  ROUND_TRIP_FAILURE = "ROUND_TRIP_FAILURE",
  GEOMETRICALLY_VALIDATED = "GEOMETRICALLY_VALIDATED",
  GEOMETRICALLY_INVALID = "GEOMETRICALLY_INVALID",
  COLLISION_FREE = "COLLISION_FREE",
  COLLISION_DETECTED = "COLLISION_DETECTED",
  COLLISION_UNDETERMINED = "COLLISION_UNDETERMINED",
  QUALIFIED = "QUALIFIED",
  NOT_QUALIFIED = "NOT_QUALIFIED",
  INVALID = "INVALID",
  UNSUPPORTED_CONTROLLER_FEATURE = "UNSUPPORTED_CONTROLLER_FEATURE"
}

export interface AxisMapping {
  x: string;
  y: string;
  z: string;
  a?: string;
  b?: string;
  c?: string;
  custom?: Record<string, string>;
}

export enum RotaryWrapMode {
  SHORTEST_DISTANCE = "SHORTEST_DISTANCE",
  SIGNED_RANGE = "SIGNED_RANGE",
  UNWRAPPED = "UNWRAPPED",
  STRICT_RANGE = "STRICT_RANGE"
}

export interface RotaryAxisConvention {
  axisName: "A" | "B" | "C" | string;
  rotationDirection: "CW_POSITIVE" | "CCW_POSITIVE";
  zeroPosition: number;
  wrapMode: RotaryWrapMode;
  continuousMode: boolean;
  minAngle: number;
  maxAngle: number;
}

export interface WorkOffsetPolicy {
  defaultOffset: string;
  supportedOffsets: string[];
  modalWord: string;
}

export interface ToolOffsetPolicy {
  useToolLengthOffset: boolean;
  toolLengthOffsetWord: string; // e.g. "G43"
  toolRadiusOffsetWord: string; // e.g. "G41"/"G42"
  cancelOffsetWord: string;     // e.g. "G49", "G40"
  offsetNumberMapping: "MATCH_TOOL_NUMBER" | "EXPLICIT_H_D";
}

export interface ToolChangePolicy {
  stagedToolSupported: boolean;
  safeRetractZ: number;
  toolChangeMCode: string; // "M06"
  spindleStopBeforeToolChange: boolean;
  coolantOffBeforeToolChange: boolean;
  homeAxesBeforeToolChange: boolean;
  preCallWaitSeconds: number;
}

export interface SpindlePolicy {
  maxRPM: number;
  minRPM: number;
  cwMCode: string;   // "M03"
  ccwMCode: string;  // "M04"
  stopMCode: string; // "M05"
  cssGCode: string;  // "G96"
  rpmGCode: string;  // "G97"
  maxSpindleSpeedGCode: string; // "G50"
}

export interface FeedPolicy {
  defaultFeedMode: FeedMode;
  maxFeedRate: number;
  minFeedRate: number;
  feedPerMinCode: string; // "G94"
  feedPerRevCode: string; // "G95"
  inverseTimeCode: string; // "G93"
}

export interface NCPrecisionPolicy {
  linearPrecision: number;   // decimals, e.g. 4
  rotaryPrecision: number;   // decimals, e.g. 3
  feedPrecision: number;     // decimals, e.g. 1
  spindlePrecision: number;  // decimals, e.g. 0
  stripTrailingZeros: boolean;
  forceExplicitSign: boolean;
  decimalSeparator: "." | ",";
}

export interface SafeStartPolicy {
  startupBlocks: string[];
  safePlane: ArcPlane;
  absoluteCoordinates: boolean;
  cancelCycles: boolean;
  cancelCompensation: boolean;
}

export interface ProgramHeaderPolicy {
  programName: string;
  programNumber?: number;
  includeDateStamp: boolean;
  includeAuthorStamp: boolean;
  unitsCode: "G21" | "G20"; // G21 = mm, G20 = inch
  customPreambleComments: string[];
}

export interface ProgramFooterPolicy {
  coolantOffMCode: string; // "M09"
  spindleStopMCode: string; // "M05"
  retractHomeGCode: string[]; // e.g. ["G28 G91 Z0", "G90"]
  programEndMCode: string; // "M30" or "M02"
}

export interface ControllerCapabilityMatrix {
  supports3AxisLinear: boolean;
  supports5AxisSimultaneous: boolean;
  supportsArcs: boolean;
  supportedArcPlanes: ArcPlane[];
  supportsSplines: boolean;
  supportsNURBS: boolean;
  supportsTCP: boolean;
  supportsRTCP: boolean;
  supportsSubprograms: boolean;
  supportsMacros: MacroSupportStatus;
  supportsCutterComp2D: boolean;
  supportsCutterComp3D: boolean;
  supportsCannedCycles: boolean;
  supportsInverseTimeFeed: boolean;
  maxBlockLength: number;
  modalGCodeSupport: boolean;
}

export interface MachineProfile {
  machineId: string;
  machineRevision: number;
  name: string;
  kinematicType: MachineType;
  axisDefinitions: Record<string, { type: MachineAxisType; minLimit: number; maxLimit: number; maxFeed: number; unit: string }>;
  axisLimits: Record<string, { min: number; max: number }>;
  axisUnits: "METRIC_MM" | "IMPERIAL_INCH";
  homePositions: Record<string, number>;
  safePositions: Record<string, number>;
  rotaryAxes: RotaryAxisConvention[];
  spindle: { maxRPM: number; minRPM: number; maxPowerKW: number; directions: SpindleDirection[] };
  toolChanger: { capacity: number; maxToolLengthMM: number; maxToolDiameterMM: number; changeTimeSec: number };
  coolant: { flood: boolean; mist: boolean; throughSpindle: boolean; airBlast: boolean };
  provenance: PropertyProvenance;
}

export interface ControllerProfile {
  controllerId: string;
  controllerRevision: number;
  name: string;
  dialect: NCDialect;
  dialectStatus: DialectImplementationStatus;
  supportedWords: string[];
  supportedCommands: string[];
  supportedCycles: CannedCycleType[];
  supportedAxes: string[];
  formatRules: NCPrecisionPolicy;
  capabilities: ControllerCapabilityMatrix;
  provenance: PropertyProvenance;
}

export interface PostProcessorContract {
  postProcessorId: string;
  revision: number;
  machineId: string;
  machineRevision: number;
  controllerId: string;
  controllerRevision: number;
  inputTrajectoryVersion: string;
  outputDialect: NCDialect;
  units: "METRIC_MM" | "IMPERIAL_INCH";
  coordinateConvention: "ABSOLUTE" | "INCREMENTAL";
  axisMapping: AxisMapping;
  rotaryConvention: RotaryAxisConvention[];
  feedConvention: FeedPolicy;
  spindleConvention: SpindlePolicy;
  formatPolicy: NCPrecisionPolicy;
  safetyPolicy: {
    maxLinearVelocityMMMin: number;
    maxRotaryVelocityDegMin: number;
    enforceAxisLimits: boolean;
    requireSafeStartBlock: boolean;
    requireProgramFooter: boolean;
    chordalToleranceMM: number;
    orientationToleranceDeg: number;
  };
  provenance: PropertyProvenance;
}

export interface MachineAxisPoint {
  position: Point3D;
  rotaryAxes?: { a?: number; b?: number; c?: number };
  feedRate: number;
  spindleSpeed: number;
  spindleDirection: SpindleDirection;
  coolantState: { flood: boolean; mist: boolean; throughSpindle: boolean; air: boolean };
  sequenceNumber: number;
  toolNumber: number;
  offsetNumber?: number;
  operationId?: string;
  motionType: "RAPID" | "LINEAR" | "ARC" | "SPLINE" | "DWELL" | "CYCLE";
  arcParameters?: {
    plane: ArcPlane;
    center: Point3D;
    radius: number;
    direction: ArcDirection;
  };
  dwellSeconds?: number;
  cycleParameters?: {
    type: CannedCycleType;
    zDepth: number;
    rPlane: number;
    peckDepth?: number;
    dwellSec?: number;
  };
}

export interface MachineAxisToolpath {
  toolpathId: string;
  revision: number;
  machineId: string;
  points: MachineAxisPoint[];
  tolerance: number;
  coordinateSystem: "WORK_PIECE" | "MACHINE_BASE";
  provenance: PropertyProvenance;
}

export interface NCIntermediateCommand {
  commandId: string;
  type: NCCommandType;
  point?: MachineAxisPoint;
  textParams?: Record<string, any>;
  comment?: string;
}

export interface NCIntermediateRepresentation {
  representationId: string;
  sourceToolpathId: string;
  commands: NCIntermediateCommand[];
  modalInitialState: NCModalState;
  createdAt: string;
}

export interface NCWord {
  letter: string; // e.g. "G", "M", "X", "Y", "Z", "A", "B", "C", "F", "S", "T", "H", "D"
  value: number | string;
  rawText: string;
}

export interface NCBlock {
  blockNumber: number;
  sequenceNumber?: number;
  lineText: string;
  words: NCWord[];
  comment?: string;
  sourceOperation?: string;
  sourcePointIndex?: number;
  machineState?: MachineAxisPoint;
  modalState?: NCModalState;
}

export interface NCModalState {
  motionGCode: string; // "G00", "G01", "G02", "G03"
  planeGCode: string;  // "G17", "G18", "G19"
  distanceModeGCode: string; // "G90", "G91"
  feedModeGCode: string; // "G94", "G95", "G93"
  unitsGCode: string;    // "G20", "G21"
  cutterCompGCode: string; // "G40", "G41", "G42"
  workOffsetGCode: string; // "G54", "G55"...
  activeTool: number;
  toolLengthOffsetActive: boolean;
  spindleState: SpindleDirection;
  activeSpindleRPM: number;
  activeFeedRate: number;
  coolantActive: boolean;
}

export interface PostProcessingTraceEntry {
  step: string;
  inputSummary: string;
  transformation: string;
  decision: string;
  outputSummary: string;
  warningOrNote?: string;
}

export interface PostProcessingTrace {
  postProcessorId: string;
  machineProfileId: string;
  controllerProfileId: string;
  sourceToolpathId: string;
  startedAt: string;
  completedAt: string;
  entries: PostProcessingTraceEntry[];
  totalBlocksGenerated: number;
  totalConversionsApplied: number;
  errorsFound: string[];
}

export interface NCProgramFingerprint {
  sourceToolpathFingerprint: string;
  machineFingerprint: string;
  controllerFingerprint: string;
  postProcessorFingerprint: string;
  formatPolicyFingerprint: string;
  merkleRootHash: string;
}

export interface NCProgram {
  programId: string;
  revision: number;
  name: string;
  blocks: NCBlock[];
  rawGCodeText: string;
  machineProfileId: string;
  controllerProfileId: string;
  postProcessorId: string;
  sourceToolpathId: string;
  fingerprint: NCProgramFingerprint;
  status: NCProgramStatus;
  safetyStatus: NCSafetyStatus;
  trace: PostProcessingTrace;
  createdAt: string;
}

export interface NCSyntaxValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  totalBlocksChecked: number;
  unrecognizedWords: string[];
  syntaxVerdict: PostTrueVerdict;
}

export interface NCSemanticValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  axisLimitViolations: string[];
  spindleLimitViolations: string[];
  feedLimitViolations: string[];
  semanticVerdict: PostTrueVerdict;
}

export interface KinematicReconstructionResult {
  isValid: boolean;
  maxPositionErrorMM: number;
  maxOrientationErrorDeg: number;
  maxAxisError: Record<string, number>;
  reconstructedTrajectory: MachineAxisToolpath;
  kinematicVerdict: PostTrueVerdict;
}

export interface RoundTripVerificationResult {
  isIdenticalWithinTolerance: boolean;
  positionToleranceMM: number;
  angularToleranceDeg: number;
  maxObservedPositionDeltaMM: number;
  maxObservedAngularDeltaDeg: number;
  pointsEvaluated: number;
  roundTripVerdict: PostTrueVerdict;
}

export interface CollisionReverificationResult {
  verdict: PostTrueVerdict;
  collisionEventsCount: number;
  minimumClearanceMM: number;
  details: string[];
}

export interface HardAcceptanceResult107 {
  passed: boolean;
  scorePercentage: number;
  totalChecks: number;
  passedChecks: number;
  merkleRootHash: string;
  verdict: PostTrueVerdict;
  timestamp: string;
  details: {
    checkName: string;
    status: "PASS" | "FAIL";
    evidence: string;
  }[];
}
