/**
 * SECP Industrial OS v3 — Real CAM Kernel
 * PATCH-258 — 5-Axis Kinematics Domain Models & Type Specifications
 */

import { Vector3D } from '../../cadKernel';

// ==========================================
// 1. MACHINE ARCHITECTURE & TOPOLOGY
// ==========================================

export type MachineArchitectureType = 
  | 'HEAD_HEAD'    // Both rotary axes in spindle/head (e.g. Swivel Head A-B or B-C)
  | 'TABLE_TABLE'  // Both rotary axes in workpiece table/trunnion (e.g. Trunnion A-C or B-C)
  | 'HEAD_TABLE';  // One rotary axis in head, one rotary axis in table (e.g. Head B + Table C)

export type MachineKinematicTopology = 
  | 'TABLE_TABLE_AC'   // Trunnion: A tilts around X, C rotates around Z (mounted on A)
  | 'TABLE_TABLE_BC'   // Trunnion: B tilts around Y, C rotates around Z (mounted on B)
  | 'HEAD_HEAD_AB'     // Head: A tilts around X, B tilts around Y
  | 'HEAD_HEAD_BC'     // Head: B tilts around Y, C rotates around Z
  | 'HEAD_HEAD_AC'     // Head: A tilts around X, C rotates around Z
  | 'HEAD_TABLE_BC'    // Head tilts around Y (B), Table rotates around Z (C)
  | 'HEAD_TABLE_AC'    // Head tilts around X (A), Table rotates around Z (C)
  | 'HEAD_TABLE_AB';   // Head tilts around X (A), Table rotates around Y (B)

export type FiveAxisAxisType = 
  | 'LINEAR_X' 
  | 'LINEAR_Y' 
  | 'LINEAR_Z' 
  | 'ROTARY_A' 
  | 'ROTARY_B' 
  | 'ROTARY_C';

export interface KinematicJointDefinition {
  axisName: 'X' | 'Y' | 'Z' | 'A' | 'B' | 'C';
  axisType: 'LINEAR' | 'ROTARY';
  axisVector: Vector3D;      // Unit vector of motion direction / rotation axis
  pivotCenterMm: Vector3D;   // Origin / center point of joint in base machine coordinate system
  minLimit: number;          // mm or deg
  maxLimit: number;          // mm or deg
  maxVelocity: number;       // mm/min or deg/min
  maxAcceleration: number;   // mm/s^2 or deg/s^2
  isContinuousRotation?: boolean;
}

export interface KinematicChainNode {
  id: string;
  name: string;
  parentJointId?: string;
  joint: KinematicJointDefinition;
  transformFromParent: number[][]; // 4x4 matrix
}

export interface FiveAxisMachineDefinition {
  machineId: string;
  name: string;
  manufacturer: string;
  architecture: MachineArchitectureType;
  topology: MachineKinematicTopology;
  kinematicChain: KinematicChainNode[];
  linearLimits: {
    X: { min: number; max: number; maxVelocity: number; maxAcceleration: number };
    Y: { min: number; max: number; maxVelocity: number; maxAcceleration: number };
    Z: { min: number; max: number; maxVelocity: number; maxAcceleration: number };
  };
  rotaryLimits: {
    primary: { 
      axis: 'A' | 'B' | 'C'; 
      limits: { min: number; max: number; maxVelocity: number; maxAcceleration: number }; 
      pivotCenterMm: Vector3D;
      axisVector: Vector3D;
      isContinuous: boolean;
    };
    secondary: { 
      axis: 'A' | 'B' | 'C'; 
      limits: { min: number; max: number; maxVelocity: number; maxAcceleration: number }; 
      pivotCenterMm: Vector3D;
      axisVector: Vector3D;
      isContinuous: boolean;
    };
  };
  gaugePivotOffsetMm: Vector3D; // Spindle gauge line to head rotary pivot offset
  tableCenterMm: Vector3D;      // Workpiece rotary table center in machine frame (MCS)
  maxSpindleRpm: number;
  rapidFeedMmMin: number;
  singularityConeAngleDeg: number; // Angular threshold for singularity warning (e.g. 0.5° - 2.0°)
  controllerType: 'FANUC_31I' | 'HEIDENHAIN_TNC640' | 'SIEMENS_840D' | 'HAAS_NGC' | 'MAZAK_SMOOTH' | 'GENERIC_ISO';
  workOffsetId: string; // e.g. G54, G55
}

// ==========================================
// 2. TOOL, TCP & ORIENTATION DEFINITIONS
// ==========================================

export interface ToolCenterPoint {
  position: Vector3D;        // TCP in Part / Workpiece Coordinate System (WCS) [mm]
  toolTipPosition: Vector3D; // Tool tip apex point in WCS [mm]
  cutterContactPoint?: Vector3D; // Contact point on part surface (CC) [mm]
  rotaryPivotOffsetMm?: Vector3D; // Machine pivot center relative to TCP [mm]
}

export interface ToolOrientationVector {
  x: number; // Tx (or I)
  y: number; // Ty (or J)
  z: number; // Tz (or K)
  normalizedMagnitude: number; // Must equal 1.0 (within 1e-6)
}

export interface SurfaceOrientationControl {
  surfaceNormal: Vector3D;     // Unit normal vector of CAD/B-Rep face [Nx, Ny, Nz]
  feedTangentVector: Vector3D; // Velocity / cutting path tangent direction [Tx, Ty, Tz]
  leadAngleDeg: number;        // Lead angle forward along feed tangent direction
  tiltAngleDeg: number;        // Tilt / roll angle sideways perpendicular to feed tangent
}

export type FiveAxisCapability = 
  | 'INDEXED_5_AXIS'     // 3+2 Machining: fixed tool orientation per operation segment
  | 'SIMULTANEOUS_5_AXIS'; // True 5-Axis continuous simultaneous multi-axis motion

// ==========================================
// 3. MACHINE JOINT COORDINATES & IK SOLUTIONS
// ==========================================

export interface MachineAxesState {
  X: number; // Linear X [mm]
  Y: number; // Linear Y [mm]
  Z: number; // Linear Z [mm]
  A: number; // Rotary A [deg]
  B: number; // Rotary B [deg]
  C: number; // Rotary C [deg]
}

export interface IKSolutionBranch {
  solutionId: string; // e.g. 'BRANCH_POSITIVE_TILT', 'BRANCH_NEGATIVE_TILT'
  axes: MachineAxesState;
  score: number; // Lower is better (0.0 = optimal)
  isWithinLimits: boolean;
  limitViolations: string[];
  isSingular: boolean;
  singularityDistanceDeg: number;
  velocityAmplification: number;
  rotaryUnwound: boolean;
  rejectionReason?: string;
  rankingDetails: {
    angularDistanceDeg: number;
    linearDisplacementMm: number;
    singularityPenalty: number;
    limitPenalty: number;
  };
}

export interface IKSolverResult {
  targetTCP: Vector3D;
  targetOrientation: ToolOrientationVector;
  candidateSolutions: IKSolutionBranch[];
  selectedSolution: IKSolutionBranch | null;
  reconstructedTCP: Vector3D;
  reconstructedOrientation: ToolOrientationVector;
  positionResidualMm: number;    // ||TCP_target - TCP_reconstructed|| (must be < 1e-4 mm)
  orientationResidualRad: number;// 1.0 - (T_target . T_reconstructed) (must be < 1e-5 rad)
  isValid: boolean;
  diagnostics: KinematicDiagnostic[];
}

// ==========================================
// 4. DIAGNOSTICS & ENUMS
// ==========================================

export type KinematicDiagnosticCode = 
  | 'INVALID_5AXIS_MACHINE'
  | 'INVALID_KINEMATIC_CHAIN'
  | 'NO_IK_SOLUTION'
  | 'MULTIPLE_IK_SOLUTIONS_UNRESOLVED'
  | 'LINEAR_AXIS_LIMIT_EXCEEDED'
  | 'ROTARY_AXIS_LIMIT_EXCEEDED'
  | 'KINEMATIC_SINGULARITY'
  | 'SINGULARITY_RISK_HIGH'
  | 'TOOL_ORIENTATION_DISCONTINUITY'
  | 'AXIS_VELOCITY_LIMIT_EXCEEDED'
  | 'AXIS_ACCELERATION_LIMIT_EXCEEDED'
  | 'INVALID_TCP'
  | 'KINEMATIC_RESIDUAL_EXCEEDED'
  | 'ORIENTATION_RESIDUAL_EXCEEDED'
  | 'MACHINE_ENVELOPE_VIOLATION'
  | 'FIVE_AXIS_TOOLPATH_INVALID'
  | 'FIVE_AXIS_REGENERATION_REQUIRED'
  | 'ROTARY_UNWRAP_APPLIED';

export interface KinematicDiagnostic {
  code: KinematicDiagnosticCode;
  severity: 'INFO' | 'WARNING' | 'ERROR';
  message: string;
  pointIndex?: number;
  axesState?: MachineAxesState;
  numericalDetails?: Record<string, number | string | boolean>;
}

// ==========================================
// ==========================================
// 8. 5-AXIS TOOLING & COLLISION TYPES
// ==========================================

export interface FiveAxisHolderDefinition {
  holderId?: string;
  holderDiameterMm: number;
  gaugeLengthMm: number;
  flangeDiameterMm?: number; // Added
  clearanceMarginMm: number;
  stages?: { diameterMm: number; lengthMm: number; bottomDiameterMm?: number; topDiameterMm?: number }[];
}

export interface FiveAxisToolDefinition {
  toolId: string;
  cutterDiameterMm: number;
  diameterMm?: number; // Alias
  fluteLengthMm: number;
  shoulderLengthMm?: number; // Added
  totalLengthMm?: number;
  stickoutMm: number;
  shankDiameterMm: number;
  holder: FiveAxisHolderDefinition;
}

export type CollisionClassification = 
  | 'CUTTER_SHANK_COLLISION'
  | 'HOLDER_COLLISION'
  | 'SPINDLE_COLLISION'
  | 'MACHINE_COMPONENT_COLLISION'
  | 'WORKPIECE_GOUGE'
  | 'FIXTURE_INTERFERENCE';

export interface CollisionEvent {
  classification: CollisionClassification;
  severity: 'WARNING' | 'CRITICAL' | 'FATAL';
  pointIndex: number;
  penetrationDepthMm: number;
  contactPointWCS: Vector3D;
  collidingComponent: string;
  timestamp?: string;
}

// 5. 5-AXIS TRAJECTORY & TOOLPATH POINT
// ==========================================

export interface FiveAxisTrajectoryPoint {
  pointIndex: number;
  targetTCP: Vector3D;
  targetOrientation: ToolOrientationVector;
  contactPoint?: Vector3D;
  surfaceNormal?: Vector3D;
  leadAngleDeg: number;
  tiltAngleDeg: number;
  feedMmMin: number;
  rotaryFeedDegMin: number;
  feedrateMode: 'G93' | 'G94'; // G93: Inverse-Time, G94: Units/Min
  spindleRpm: number;
  motionType: 'RAPID' | 'LINEAR' | 'PLUNGE' | 'RETRACT' | 'LEAD_IN' | 'LEAD_OUT' | 'INDEXED_MOVE';
  capability: FiveAxisCapability;
  machineAxes: MachineAxesState;
  ikResult: IKSolverResult;
  estimatedTimeSec: number;
  isSimultaneous5Axis: boolean;
}

export interface MachineIndependent5AxisPath {
  pathId: string;
  machineId: string;
  architecture: MachineArchitectureType;
  topology: MachineKinematicTopology;
  points: FiveAxisTrajectoryPoint[];
  totalLengthMm: number;
  totalCycleTimeSec: number;
  totalRotaryTravelPrimaryDeg: number;
  totalRotaryTravelSecondaryDeg: number;
  maxAxisVelocities: Record<string, number>;
  capability: FiveAxisCapability;
  isValid: boolean;
  diagnostics: KinematicDiagnostic[];
}

// ==========================================
// 6. REFERENCE BENCHMARK DEFINITION
// ==========================================

export interface FiveAxisBenchmarkConfig {
  id: 'BENCHMARK_A' | 'BENCHMARK_B' | 'BENCHMARK_C' | 'BENCHMARK_D' | 'BENCHMARK_E';
  name: string;
  description: string;
  capability: FiveAxisCapability;
  targetToleranceMm: number;
  targetMaxResidualMm: number;
  machineArchitecture: MachineArchitectureType;
  toolLengthMm: number;
  toolRadiusMm: number;
}

// ==========================================
// 7. CRYPTOGRAPHIC EVIDENCE PACKAGE
// ==========================================

export interface FiveAxisKinematicsEvidence {
  evidenceId: string;
  timestamp: string;
  machineModelHash: string;
  machineArchitecture: MachineArchitectureType;
  machineTopology: MachineKinematicTopology;
  kinematicChainHash: string;
  totalTrajectoryPoints: number;
  capability: FiveAxisCapability;
  maxPositionResidualMm: number;
  maxOrientationResidualRad: number;
  singularityEncountersCount: number;
  rotaryUnwindsAppliedCount: number;
  axisLimitViolationsCount: number;
  toolpathHash: string;
  gatePassed: boolean;
  classification: 'PROVEN' | 'PARTIAL' | 'UNPROVEN' | 'SIMULATED' | 'ABSENT';
  provenanceSignature: string;
}
