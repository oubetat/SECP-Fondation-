/**
 * SECP Industrial OS v3 — Real CAM Kernel
 * PATCH-263 — G-Code Verification Types & Data Contracts
 * 
 * Formal data structures for Tokenization, AST Parsing, Modal Machine States,
 * Motion Reconstruction, Machine Envelope Checks, Kinematic Back-Verification,
 * Toolpath-to-NC Geometric Deviation, Precision Auditing, and Cryptographic Evidence.
 */

import { Vector3D } from '../../cadKernel';
import { ControllerDialect, MachineDefinition, CoordinateSystemId, UnitsMode, ActivePlane, MotionMode, FeedMode, SpindleState, CoolantState, CutterCompensationMode, RTCPMode, NCSourceMap } from '../post-processor/PostTypes';
import { ToolSnapshot } from '../tool-library/ToolTypes';
import { FiveAxisMachinePose } from '../fiveaxis/FiveAxisTypes';
import { ToolpathSegment } from '../ToolpathTypes';

// ==========================================
// 1. TOKENIZATION & PARSED WORDS
// ==========================================

export type NCWordLetter = 
  | 'G' | 'M' | 'X' | 'Y' | 'Z' | 'A' | 'B' | 'C' | 'U' | 'V' | 'W'
  | 'F' | 'S' | 'T' | 'H' | 'D' | 'P' | 'R' | 'Q' | 'L' | 'I' | 'J' | 'K' | 'N' | 'O';

export interface NCWord {
  letter: NCWordLetter;
  numericValue: number;
  rawValue: string;
  isInteger: boolean;
  precision: number;
}

export interface NCBlockTokens {
  lineIndex: number;
  sequenceNumber?: number;
  rawText: string;
  comment?: string;
  words: NCWord[];
  wordsMap: Map<NCWordLetter, number[]>; // letter -> list of values in block
  isCommentOnly: boolean;
  isEmpty: boolean;
  hasBlockSkip: boolean;
}

// ==========================================
// 2. MODAL & RECONSTRUCTED MACHINE STATE
// ==========================================

export interface MachineCoordinates {
  x: number;
  y: number;
  z: number;
  a: number;
  b: number;
  c: number;
}

export interface NCExecutionState {
  stepIndex: number;
  lineIndex: number;
  blockNumber?: number;
  rawGCode: string;
  
  // Position in Active WCS (mm / deg)
  position: MachineCoordinates;
  // Orientation Unit Vector (for 4/5-Axis)
  toolOrientation: Vector3D;

  // Modal Groups
  motionMode: MotionMode;
  units: UnitsMode;
  plane: ActivePlane;
  distanceMode: 'G90_ABSOLUTE' | 'G91_INCREMENTAL';
  arcDistanceMode: 'G90.1_ABSOLUTE' | 'G91.1_INCREMENTAL';
  feedMode: FeedMode;
  coordinateSystem: CoordinateSystemId;
  wcsOffset: MachineCoordinates;
  
  // Tool & Compensation
  activeToolNumber: number;
  activeToolId?: string;
  activeToolSnapshot?: ToolSnapshot;
  activeHOffsetNumber: number;
  activeDOffsetNumber: number;
  toolLengthCompActive: boolean;
  cutterCompMode: CutterCompensationMode;
  rtcpMode: RTCPMode;

  // Spindle & Dynamic
  spindleState: SpindleState;
  spindleRpm: number;
  feedRate: number; // mm/min
  coolantState: CoolantState;
  
  // Cycle State
  cycleActive: boolean;
  cycleType?: string;
  cycleParams?: Record<string, number>;

  // Status flags
  isRapid: boolean;
  isCutting: boolean;
}

// ==========================================
// 3. RECONSTRUCTED MOTION GEOMETRY
// ==========================================

export type MotionReconstructionType = 
  | 'RAPID'
  | 'LINEAR'
  | 'ARC_CW'
  | 'ARC_CCW'
  | 'ROTARY_ONLY'
  | 'CANNED_CYCLE_PLUNGE'
  | 'CANNED_CYCLE_RETRACT'
  | 'TOOL_CHANGE'
  | 'DWELL'
  | 'SAFETY_RETRACT';

export interface MachineMotionStep {
  stepIndex: number;
  lineIndex: number;
  sequenceNumber?: number;
  rawText: string;
  motionType: MotionReconstructionType;
  
  startPoint: MachineCoordinates;
  endPoint: MachineCoordinates;
  
  // Arcs
  centerPoint?: Vector3D;
  radius?: number;
  sweptAngleDeg?: number;
  arcPlane?: ActivePlane;
  arcNormal?: Vector3D;
  
  // Rotary & Kinematics
  startPose?: FiveAxisMachinePose;
  endPose?: FiveAxisMachinePose;
  toolVector?: Vector3D;
  
  // Metrics
  distanceMm: number;
  rotaryDistanceDeg: number;
  feedRate: number;
  spindleRpm: number;
  estimatedDurationSec: number;
  
  isCutting: boolean;
  isRapid: boolean;
  toolNumber: number;
  
  // Traceability
  sourceOperationId?: string;
  sourceOperationName?: string;
  sourceToolpathSegmentId?: string;
  toolSnapshotId?: string;
}

export interface MachineMotionSequence {
  steps: MachineMotionStep[];
  totalDistanceMm: number;
  totalCuttingDistanceMm: number;
  totalRapidDistanceMm: number;
  totalEstimatedTimeSec: number;
  totalCuttingTimeSec: number;
  totalRapidTimeSec: number;
  
  bounds: {
    minX: number; maxX: number;
    minY: number; maxY: number;
    minZ: number; maxZ: number;
    minA: number; maxA: number;
    minB: number; maxB: number;
    minC: number; maxC: number;
  };
  
  toolChangesCount: number;
  toolsUsed: number[];
}

// ==========================================
// 4. VERIFICATION SEVERITY & ISSUE TYPES
// ==========================================

export type VerificationSeverity = 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';

export type VerificationStatus = 
  | 'VERIFIED'
  | 'VERIFIED_WITH_WARNINGS'
  | 'FAILED'
  | 'UNVERIFIED'
  | 'UNSUPPORTED';

export type VerificationIssueCode = 
  | 'UNSUPPORTED_NC_COMMAND'
  | 'SYNTAX_ERROR'
  | 'AXIS_LIMIT_VIOLATION'
  | 'ROTARY_LIMIT_VIOLATION'
  | 'FEED_LIMIT_VIOLATION'
  | 'SPINDLE_LIMIT_VIOLATION'
  | 'TOOL_MISMATCH'
  | 'TOOL_NOT_FOUND'
  | 'TOOL_CHANGER_CAPACITY_EXCEEDED'
  | 'COMPENSATION_CONFLICT'
  | 'DOUBLE_COMPENSATION_DETECTED'
  | 'INVALID_MODAL_TRANSITION'
  | 'INVALID_ARC_GEOMETRY'
  | 'KINEMATIC_DEVIATION_EXCEEDED'
  | 'TOOLPATH_DEVIATION_EXCEEDED'
  | 'MISSING_TOOLPATH_MOTION'
  | 'EXTRA_DANGEROUS_MOTION'
  | 'MISSING_RETRACT_BEFORE_RAPID'
  | 'CUTTING_WITH_SPINDLE_STOPPED'
  | 'INVALID_SAFETY_SEQUENCE'
  | 'MISSING_PROGRAM_TERMINATION'
  | 'NUMERICAL_ROUNDING_VIOLATION'
  | 'UNITS_MISMATCH'
  | 'CYCLE_PARAMETER_INVALID'
  | 'CONTEXT_INSUFFICIENT'
  | 'COLLISION_DETECTED';

export interface VerificationIssue {
  id: string;
  code: VerificationIssueCode;
  severity: VerificationSeverity;
  lineIndex: number;
  sequenceNumber?: number;
  rawGCode?: string;
  message: string;
  axis?: string;
  expectedValue?: string | number;
  actualValue?: string | number;
  recommendation?: string;
}

// ==========================================
// 5. TOLERANCES & COMPARISON CONFIGURATION
// ==========================================

export interface VerificationTolerances {
  linearToleranceMm: number;        // e.g. 0.01 mm
  angularToleranceDeg: number;      // e.g. 0.05 deg
  arcEndpointToleranceMm: number;   // e.g. 0.005 mm
  arcRadiusToleranceMm: number;     // e.g. 0.01 mm
  rotaryToleranceDeg: number;       // e.g. 0.02 deg
  feedToleranceMmMin: number;       // e.g. 0.1 mm/min
  rpmTolerance: number;             // e.g. 1.0 RPM
  maxAllowedToolpathDeviationMm: number; // e.g. 0.025 mm
}

export const DEFAULT_VERIFICATION_TOLERANCES: VerificationTolerances = {
  linearToleranceMm: 0.010,
  angularToleranceDeg: 0.050,
  arcEndpointToleranceMm: 0.005,
  arcRadiusToleranceMm: 0.010,
  rotaryToleranceDeg: 0.020,
  feedToleranceMmMin: 0.100,
  rpmTolerance: 1.0,
  maxAllowedToolpathDeviationMm: 0.025
};

// ==========================================
// 6. DEVIATION & PRECISION REPORTS
// ==========================================

export interface ToolpathDeviationPoint {
  ncStepIndex: number;
  lineIndex: number;
  toolpathSegmentId?: string;
  ncPosition: Vector3D;
  toolpathPosition: Vector3D;
  deviationMm: number;
}

export interface ToolpathDeviationReport {
  comparedPointsCount: number;
  maxDeviationMm: number;
  maxDeviationStepIndex: number;
  maxDeviationLine: number;
  meanDeviationMm: number;
  rmsDeviationMm: number;
  isWithinTolerance: boolean;
  toleranceMm: number;
  unmatchedToolpathSegmentsCount: number;
  unmatchedNcMotionCount: number;
  deviations: ToolpathDeviationPoint[];
}

export interface KinematicDeviationPoint {
  stepIndex: number;
  lineIndex: number;
  reconstructedPose: FiveAxisMachinePose;
  referencePose?: FiveAxisMachinePose;
  positionErrorMm: number;
  angularErrorDeg: number;
  rotaryAErrorDeg: number;
  rotaryCErrorDeg: number;
}

export interface KinematicDeviationReport {
  isMultiaxis: boolean;
  comparedPosesCount: number;
  maxPositionErrorMm: number;
  meanPositionErrorMm: number;
  maxAngularErrorDeg: number;
  meanAngularErrorDeg: number;
  maxRotaryErrorDeg: number;
  isWithinTolerance: boolean;
  deviations: KinematicDeviationPoint[];
}

export interface NCPrecisionReport {
  detectedDecimalPrecision: number;
  maxRoundingErrorMm: number;
  angularRoundingErrorDeg: number;
  totalBlocksAudited: number;
  hasFormattingAnomalies: boolean;
}

// ==========================================
// 7. INPUT CONTRACT & OUTPUT VERIFICATION RESULT
// ==========================================

export interface VerificationContract {
  ncProgramText: string;
  programName?: string;
  controllerDialect: ControllerDialect;
  machine: MachineDefinition;
  toolSnapshots: ToolSnapshot[];
  referenceToolpaths?: ToolpathSegment[];
  referenceKinematicPoses?: FiveAxisMachinePose[];
  sourceMap?: NCSourceMap;
  tolerances?: Partial<VerificationTolerances>;
  allowUnverifiedToolpaths?: boolean;
}

export interface GCodeVerificationEvidence {
  evidenceId: string;
  timestamp: string;
  engineVersion: string;
  
  ncProgramHash: string;
  machineDefinitionHash: string;
  controllerDialect: ControllerDialect;
  toolSnapshotsHash: string;
  referenceToolpathHash?: string;
  tolerancesHash: string;
  
  overallStatus: VerificationStatus;
  isPassing: boolean;
  
  statistics: {
    totalBlocks: number;
    reconstructedMotionSteps: number;
    cuttingDistanceMm: number;
    rapidDistanceMm: number;
    estimatedMachiningTimeSec: number;
    criticalIssuesCount: number;
    errorsCount: number;
    warningsCount: number;
    infoCount: number;
  };
  
  metrics: {
    maxToolpathDeviationMm: number;
    rmsToolpathDeviationMm: number;
    maxKinematicAngularErrorDeg: number;
    machineEnvelopeUtilizationPct: Record<string, number>;
  };
  
  issuesSummary: Array<{
    code: VerificationIssueCode;
    severity: VerificationSeverity;
    count: number;
  }>;
  
  verificationDigestSha256: string;
  provenanceSignature: string;
}

export interface VerificationResult {
  contract: VerificationContract;
  tolerances: VerificationTolerances;
  status: VerificationStatus;
  isPassing: boolean;
  
  tokenizedBlocks: NCBlockTokens[];
  executionStates: NCExecutionState[];
  motionSequence: MachineMotionSequence;
  
  issues: VerificationIssue[];
  toolpathDeviationReport?: ToolpathDeviationReport;
  kinematicDeviationReport?: KinematicDeviationReport;
  precisionReport: NCPrecisionReport;
  
  evidence: GCodeVerificationEvidence;
}
