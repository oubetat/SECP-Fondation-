/**
 * SECP Industrial OS v2 — Real CAM Kernel
 * PATCH-257 — 4-Axis Toolpath Engine: Types, Enums & System Contracts
 */

import { ManufacturingFeature, ManufacturingFeatureType, ToolAccessDirection } from '../feature-recognition/FeatureTypes';
import { ToolType, MotionType, CoolantState, Vector3D, CuttingTool } from '../toolpath/ToolpathTypes';

export type RotaryAxisLetter = 'A' | 'B' | 'C';
export type RotaryTableType = 'TABLE_ROTARY' | 'HEAD_ROTARY';
export type AngularUnit = 'DEGREES' | 'RADIANS';
export type FourAxisOperationMode = 'INDEXED_4AXIS' | 'SIMULTANEOUS_4AXIS';

export enum FourAxisStrategyType {
  INDEXED_MACHINING = 'INDEXED_MACHINING',
  ROTARY_WRAPPING = 'ROTARY_WRAPPING',
  WRAPPED_SLOT = 'WRAPPED_SLOT',
  ROTARY_CONTOUR = 'ROTARY_CONTOUR',
  ROTARY_POCKETING = 'ROTARY_POCKETING',
  INDEXED_HOLE_DRILLING = 'INDEXED_HOLE_DRILLING',
}

export enum FeedrateMode {
  UNITS_PER_MINUTE = 'G94', // mm/min (linear)
  INVERSE_TIME = 'G93',     // 1/min (simultaneous multi-axis)
  DEGREES_PER_MINUTE = 'DPM', // deg/min (pure rotary)
}

/**
 * 4-Axis Machine Kinematic Definition
 */
export interface FourAxisMachineModel {
  id: string;
  name: string;
  manufacturer: string;
  rotaryAxisLetter: RotaryAxisLetter; // 'A' (rotates around X), 'B' (around Y), or 'C' (around Z)
  tableType: RotaryTableType;
  
  // Linear Travel Limits [min, max] in mm
  xLimitsMm: [number, number];
  yLimitsMm: [number, number];
  zLimitsMm: [number, number];

  // Rotary Travel Limits [min, max] in degrees (or continuous flag)
  isContinuousRotation: boolean;
  rotaryLimitsDeg: [number, number]; // e.g. [-360, 360] or [-120, 120]

  // Machine Kinematic Center & Direction
  rotaryOriginMachine: Vector3D; // Pivot / axis center in Machine Coordinates
  rotaryAxisVector: Vector3D;    // e.g. [1,0,0] for A-axis, [0,1,0] for B-axis
  positiveRotationDirection: 'CW' | 'CCW'; // Right-hand rule positive direction

  // Feed & Speed Limits
  maxLinearFeedMmMin: number;
  maxRapidFeedMmMin: number;
  maxRotaryFeedDegMin: number;
  maxRotaryVelocityDegSec: number;
  maxSpindleRpm: number;

  // Home & Reference Positions (G28 / G53)
  homePosition: { x: number; y: number; z: number; rotaryDeg: number };
  toolChangePosition: { x: number; y: number; z: number; rotaryDeg: number };
}

/**
 * Rotary Coordinate System definition
 */
export interface RotaryCoordinateSystem {
  origin: Vector3D;              // Axis center line point in WCS
  axisVector: Vector3D;          // Normal vector of rotation axis (unit vector)
  zeroAngleVector: Vector3D;      // Reference vector corresponding to Angle = 0°
  positiveDirection: 'CW' | 'CCW';
  angularUnit: AngularUnit;
  wrapRadiusMm: number;          // Nominal cylindrical radius for unwrapping
  workOffsetId: string;          // G54, G55, etc.
}

/**
 * 4-Axis Discrete Tool Position & Kinematic State
 */
export interface FourAxisToolPosition {
  x: number; // Linear X in Machine / WCS
  y: number; // Linear Y in Machine / WCS
  z: number; // Linear Z in Machine / WCS
  rotaryAngleDeg: number; // A, B, or C angle in degrees
  rotaryAxisLetter: RotaryAxisLetter;

  // Kinematic Vectors
  toolVector: Vector3D;       // Unit vector of tool axis in Part Space
  partContactPoint: Vector3D; // Actual cutting point on part in Part Space
  surfaceNormal: Vector3D;    // Workpiece surface normal at contact point

  // Dynamic & Feed Parameters
  feedMmMin: number;          // Programmed linear/effective cutting feed
  rotaryFeedDegMin: number;   // Computed rotary angular feed
  feedrateMode: FeedrateMode;
  spindleRpm: number;
  motionType: MotionType;
  coolant: CoolantState;
  segmentIndex: number;
  operationId: string;
  timestampSec?: number;
}

/**
 * 4-Axis Toolpath Segment
 */
export interface FourAxisToolpathSegment {
  id: string;
  startPoint: FourAxisToolPosition;
  endPoint: FourAxisToolPosition;
  motionType: MotionType;
  feedMmMin: number;
  rotaryFeedDegMin: number;
  feedrateMode: FeedrateMode;
  spindleRpm: number;
  lengthMm: number;
  angularTravelDeg: number;
  estimatedTimeSec: number;
  isCutting: boolean;
  isSimultaneousRotary: boolean;
  operationMode: FourAxisOperationMode;
}

/**
 * 4-Axis Machining Operation Specification
 */
export interface FourAxisOperation {
  id: string;
  name: string;
  strategy: FourAxisStrategyType;
  mode: FourAxisOperationMode;
  targetFeatureId?: string;
  targetFeature?: ManufacturingFeature;
  tool: CuttingTool;
  
  // Cut parameters
  axialStepdownMm: number;
  radialStepoverMm: number;
  cuttingFeedMmMin: number;
  plungeFeedMmMin: number;
  spindleRpm: number;
  coolant: CoolantState;

  // 4-Axis Specific Options
  fixedIndexAngleDeg?: number;      // For INDEXED_4AXIS (e.g. 0, 90, 180, 270)
  cylinderRadiusMm?: number;        // For ROTARY_WRAPPING / WRAPPED_SLOT
  angularRangeDeg?: [number, number]; // [startAngle, endAngle] e.g. [0, 360]
  axialRangeMm?: [number, number];    // [zMin, zMax] or [xMin, xMax] along rotary axis
  slotWidthMm?: number;
  slotDepthMm?: number;
  spiralPitchMm?: number;

  // Clearance planes (Radial or Axial)
  safeRetractRadiusMm?: number;
  clearanceRadiusMm?: number;
  retractPlaneZMm?: number;
  clearancePlaneZMm?: number;
}

/**
 * 4-Axis CAM Setup
 */
export interface FourAxisSetup {
  id: string;
  name: string;
  machine: FourAxisMachineModel;
  wcs: RotaryCoordinateSystem;
  workOffset: string; // 'G54' | 'G55' | etc.
  stockType: 'CYLINDRICAL' | 'PRISMATIC_BLOCK';
  stockDimensions: {
    outerDiameterMm?: number;
    innerDiameterMm?: number;
    lengthMm: number;
    xLengthMm?: number;
    yLengthMm?: number;
    zLengthMm?: number;
  };
  fixtureModel?: {
    type: 'CHUCK_3JAW' | 'CHUCK_4JAW' | 'TAILSTOCK_CENTER' | 'VISE_ROTARY_PLATE';
    clampingLengthMm: number;
    jawClearanceRadiusMm: number;
    deadCenterOffsetMm?: number;
  };
  partPlacementOffset: Vector3D;
  partRotaryOrientationDeg: number;
  operations: FourAxisOperation[];
}

/**
 * Failure & Diagnostic Codes
 */
export type FourAxisFailureCode =
  | 'FOUR_AXIS_MACHINE_INVALID'
  | 'ROTARY_AXIS_UNDEFINED'
  | 'ROTARY_AXIS_LIMIT_EXCEEDED'
  | 'INVALID_ROTARY_TRANSFORM'
  | 'KINEMATIC_SINGULARITY'
  | 'ROTARY_FEED_LIMIT_EXCEEDED'
  | 'FOUR_AXIS_PATH_GENERATION_FAILED'
  | 'TOOL_COLLISION'
  | 'HOLDER_COLLISION'
  | 'GOUGE_DETECTED'
  | 'FIXTURE_COLLISION'
  | 'ROTARY_DISCONTINUITY'
  | 'STOCK_SIMULATION_FAILED'
  | 'FOUR_AXIS_VALIDATION_FAILED'
  | 'FOUR_AXIS_REGENERATION_REQUIRED'
  | 'UNREACHABLE_FEATURE'
  | 'INVALID_FEED_PARAMETER';

export interface FourAxisDiagnostic {
  code: FourAxisFailureCode;
  severity: 'ERROR' | 'WARNING' | 'INFO';
  operationId?: string;
  segmentId?: string;
  segmentIndex?: number;
  rotaryAngleDeg?: number;
  machinePosition?: Vector3D;
  partPosition?: Vector3D;
  featureId?: string;
  message: string;
  timestamp: string;
}

/**
 * 4-Axis Toolpath Result
 */
export interface FourAxisToolpathResult {
  toolpathId: string;
  setupId: string;
  machineId: string;
  rotaryAxisLetter: RotaryAxisLetter;
  operations: {
    operationId: string;
    strategy: FourAxisStrategyType;
    mode: FourAxisOperationMode;
    positions: FourAxisToolPosition[];
    segments: FourAxisToolpathSegment[];
    totalLengthMm: number;
    totalRotaryTravelDeg: number;
    estimatedMachiningTimeSec: number;
    rapidTimeSec: number;
    cuttingTimeSec: number;
  }[];
  allPositions: FourAxisToolPosition[];
  allSegments: FourAxisToolpathSegment[];
  totalMachiningTimeSec: number;
  totalRapidTravelMm: number;
  totalCuttingTravelMm: number;
  totalRotaryTravelDeg: number;
  minRotaryAngleDeg: number;
  maxRotaryAngleDeg: number;
  diagnostics: FourAxisDiagnostic[];
  isValid: boolean;
  generatedTimestamp: string;
  toolpathHash: string;
}

/**
 * 4-Axis Simulation & Material Removal Stats
 */
export interface FourAxisStockSimulationStats {
  initialStockVolumeMm3: number;
  finalStockVolumeMm3: number;
  removedVolumeMm3: number;
  materialRemovalPercentage: number;
  maxMrrMm3Min: number;
  avgMrrMm3Min: number;
  maxGougeDeviationMm: number;
  maxExcessStockDeviationMm: number;
  meanAbsoluteDeviationMm: number;
  inTolerancePercentage: number; // percentage within ±0.050mm
  simulatedTimeSec: number;
  collisionDetected: boolean;
  gougeDetected: boolean;
}

/**
 * Capability Classification as mandated by PATCH-257
 */
export type FourAxisCapabilityClassification =
  | 'PROVEN'
  | 'PARTIAL'
  | 'UNPROVEN'
  | 'SIMULATED'
  | 'ABSENT';

/**
 * Cryptographic Evidence Package
 */
export interface FourAxisEvidencePackage {
  evidenceId: string;
  cadModelHash: string;
  brepHash: string;
  featuresHash: string;
  machineHash: string;
  setupHash: string;
  toolpathHash: string;
  algorithmVersion: string;
  classification: FourAxisCapabilityClassification;
  machineSummary: {
    modelName: string;
    rotaryAxis: RotaryAxisLetter;
    tableType: RotaryTableType;
    limits: { x: [number, number]; y: [number, number]; z: [number, number]; rotaryDeg: [number, number] };
  };
  toolpathMetrics: {
    totalPositionsCount: number;
    totalSegmentsCount: number;
    totalMachiningTimeSec: number;
    totalRotaryTravelDeg: number;
    modesUsed: FourAxisOperationMode[];
    strategiesUsed: FourAxisStrategyType[];
  };
  kinematicVerification: {
    forwardInverseTransformResidualMm: number;
    maxAngularVelocityObservedDegSec: number;
    singularityAvoidanceVerified: boolean;
    angularContinuityVerified: boolean;
    unwindManagerActive: boolean;
  };
  safetyAndCollisionResults: {
    holderCollisionsCount: number;
    fixtureCollisionsCount: number;
    rapidPlungesCount: number;
    gougesCount: number;
    axisLimitViolationsCount: number;
  };
  stockSimulationSummary: FourAxisStockSimulationStats;
  gatePassed: boolean;
  timestamp: string;
}
