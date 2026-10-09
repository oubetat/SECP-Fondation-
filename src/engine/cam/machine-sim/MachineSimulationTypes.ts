/**
 * SECP Industrial OS - PATCH-264: Machine Simulation Engine
 * Core Types, Interfaces, Enums & Data Structures
 */

import { ControllerDialect } from '../post-processor/PostTypes';
import { GCodeVerificationResult } from '../verification/GCodeVerificationTypes';
import { ToolGeometryDefinition, ToolHolderDefinition } from '../tool-library/ToolTypes';

export type MachineKinematicType = '3-AXIS-MILL' | '4-AXIS-TABLE-ROTARY' | '5-AXIS-TABLE-TABLE' | '5-AXIS-HEAD-TABLE' | '5-AXIS-HEAD-HEAD' | 'MILL-TURN';

export type CollisionSeverity = 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';

export type CollisionClassification =
  | 'TOOL_COLLISION'
  | 'HOLDER_COLLISION'
  | 'SPINDLE_COLLISION'
  | 'FIXTURE_COLLISION'
  | 'MACHINE_COLLISION'
  | 'STOCK_COLLISION'
  | 'AXIS_LIMIT_COLLISION';

export type SimulationVerdict =
  | 'SIMULATION_PASSED'
  | 'PASSED_WITH_WARNINGS'
  | 'COLLISION_DETECTED'
  | 'AXIS_LIMIT_FAILURE'
  | 'STOCK_DEVIATION'
  | 'KINEMATIC_FAILURE'
  | 'SIMULATION_FAILED'
  | 'UNSUPPORTED_MACHINE'
  | 'UNVERIFIED'
  | 'MACHINE_SIMULATION_BLOCKED';

export type CoolantState = 'OFF' | 'FLOOD' | 'MIST' | 'THROUGH_TOOL' | 'AIR_BLAST';

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export interface AxisLimits {
  min: number;
  max: number;
  softMin?: number;
  softMax?: number;
  maxVelocity: number; // mm/min or deg/min
  maxAcceleration?: number; // mm/s^2 or deg/s^2
}

export interface MachineAxisDefinition {
  name: 'X' | 'Y' | 'Z' | 'A' | 'B' | 'C';
  type: 'LINEAR' | 'ROTARY';
  direction: Vector3D;
  limits: AxisLimits;
  homePosition: number;
  rotationCenter?: Vector3D;
  continuous?: boolean;
}

export interface SpindleDefinition {
  maxRpm: number;
  minRpm: number;
  maxPowerKw: number;
  accelerationTimeSec: number;
  interfaceType: string; // e.g. "BT40", "CAT50", "HSK-A63"
  gaugeLength: number; // mm from spindle face to gauge line
}

export interface MachineDefinition {
  id: string;
  name: string;
  vendor: string;
  type: MachineKinematicType;
  controllerDialect: ControllerDialect;
  axes: MachineAxisDefinition[];
  spindle: SpindleDefinition;
  toolChanger: {
    capacity: number;
    toolChangeTimeSec: number;
    chipToChipTimeSec: number;
  };
  tableDimensions: {
    length: number;
    width: number;
    height: number;
  };
  machineOrigin: Vector3D;
  kinematicChain: {
    baseComponent: string;
    tableChain: string[];
    headChain: string[];
  };
}

export interface FixtureClampMesh {
  id: string;
  name: string;
  type: 'VISE_JAW' | 'STEP_CLAMP' | 'CHUCK' | 'TOMBSTONE' | 'CUSTOM_FIXTURE';
  bounds: {
    min: Vector3D;
    max: Vector3D;
  };
  center: Vector3D;
  dimensions: Vector3D;
  color?: string;
}

export interface FixtureModel {
  id: string;
  name: string;
  clamps: FixtureClampMesh[];
  mountingOffset: Vector3D;
}

export interface StockModelDefinition {
  id: string;
  dimensions: Vector3D;
  origin: Vector3D;
  resolutionMm: number;
  material: string;
  initialHash: string;
  voxels?: Uint8Array; // 3D voxel density or occupancy grid
  heightfield?: Float32Array; // 2.5D height grid
  gridSize?: { nx: number; ny: number; nz: number };
}

export interface SimulationTolerances {
  collisionClearanceMm: number;
  holderClearanceMm: number;
  fixtureClearanceMm: number;
  stockDeviationToleranceMm: number;
  gougeToleranceMm: number;
  angularDiscontinuityThresholdDeg: number;
  singularityAngleThresholdDeg: number;
  minSamplingStepMm: number;
  maxSamplingStepMm: number;
  adaptiveSubdivisionLevel: number;
}

export interface MachineSimulationInput {
  ncProgram: string;
  gcodeVerification?: GCodeVerificationResult;
  machine: MachineDefinition;
  controller: ControllerDialect;
  tools: Map<number, ToolGeometryDefinition>;
  holders: Map<number, ToolHolderDefinition>;
  fixture: FixtureModel;
  stock: StockModelDefinition;
  wcsOffsets: Record<string, Vector3D>;
  tolerances?: Partial<SimulationTolerances>;
  diagnosticMode?: boolean;
}

export interface AxisPositionState {
  x: number;
  y: number;
  z: number;
  a: number;
  b: number;
  c: number;
}

export interface MachinePose {
  axes: AxisPositionState;
  toolTipWorld: Vector3D;
  toolBaseWorld: Vector3D;
  toolOrientationWorld: Vector3D;
  holderOriginWorld: Vector3D;
  spindleNoseWorld: Vector3D;
  tablePositionWorld: Vector3D;
  stockOriginWorld: Vector3D;
}

export interface ModalSimulationState {
  units: 'METRIC' | 'INCH';
  distanceMode: 'ABSOLUTE' | 'INCREMENTAL';
  feedMode: 'UNITS_PER_MINUTE' | 'UNITS_PER_REV';
  motionMode: 'RAPID' | 'LINEAR' | 'CW_ARC' | 'CCW_ARC' | 'CANNED_CYCLE' | 'EXACT_STOP';
  activePlane: 'XY' | 'XZ' | 'YZ';
  activeWcs: string; // 'G54', 'G55' ...
  activeToolNumber: number;
  activeLengthOffsetH: number;
  activeRadiusOffsetD: number;
  spindleState: 'CW' | 'CCW' | 'STOPPED';
  spindleRpm: number;
  feedrate: number;
  coolant: CoolantState;
  rtcpActive: boolean;
}

export interface MachineStateSnapshot {
  stepIndex: number;
  blockIndex: number;
  timestampSec: number;
  rawGCodeLine: string;
  modal: ModalSimulationState;
  pose: MachinePose;
  feedActualMmMin: number;
  isCutting: boolean;
  materialRemovedMm3: number;
  totalMaterialRemovedMm3: number;
  activeCollisions: CollisionRecord[];
  activeViolations: MachineLimitViolation[];
}

export interface CollisionRecord {
  id: string;
  timestampSec: number;
  blockIndex: number;
  rawGCodeLine: string;
  classification: CollisionClassification;
  severity: CollisionSeverity;
  primaryObject: string;
  secondaryObject: string;
  contactPoint: Vector3D;
  penetrationDepthMm: number;
  axesAtCollision: AxisPositionState;
  description: string;
}

export interface MachineLimitViolation {
  id: string;
  timestampSec: number;
  blockIndex: number;
  rawGCodeLine: string;
  axis: 'X' | 'Y' | 'Z' | 'A' | 'B' | 'C' | 'FEED' | 'SPINDLE';
  currentValue: number;
  limitMin: number;
  limitMax: number;
  limitType: 'SOFT_LIMIT' | 'HARD_LIMIT' | 'ROTARY_LIMIT' | 'FEED_LIMIT' | 'SPINDLE_LIMIT';
  description: string;
}

export interface KinematicAnomalyRecord {
  id: string;
  timestampSec: number;
  blockIndex: number;
  type: 'SINGULARITY_PROXIMITY' | 'ROTARY_FLIP' | 'ORIENTATION_DISCONTINUITY' | 'AXIS_WRAPPING_JUMP';
  severity: 'WARNING' | 'ERROR';
  angleDeg: number;
  description: string;
}

export interface MaterialRemovalRecord {
  blockIndex: number;
  timestampSec: number;
  volumeRemovedMm3: number;
  cutType: 'ROUGHING' | 'FINISHING' | 'DRILLING' | 'AIR_CUT';
  chipLoadMm: number;
}

export interface CycleTimeBreakdown {
  rapidTimeSec: number;
  cuttingTimeSec: number;
  toolChangeTimeSec: number;
  auxiliaryTimeSec: number;
  idleTimeSec: number;
  totalTimeSec: number;
  cuttingPercentage: number;
  rapidPercentage: number;
  toolChangePercentage: number;
}

export interface StockSimulationResult {
  initialHash: string;
  finalHash: string;
  totalVolumeRemovedMm3: number;
  initialStockVolumeMm3: number;
  remainingStockVolumeMm3: number;
  maxGougeDepthMm: number;
  gougeCount: number;
  meanDeviationMm: number;
  maxDeviationMm: number;
  gougeLocations: Vector3D[];
}

export interface MachineSimulationResult {
  id: string;
  verdict: SimulationVerdict;
  executionStatus: 'COMPLETED' | 'BLOCKED' | 'DIAGNOSTIC_TERMINATED';
  startTimeMs: number;
  endTimeMs: number;
  durationMs: number;
  totalBlocks: number;
  totalSimulationSteps: number;
  cycleTime: CycleTimeBreakdown;
  collisions: CollisionRecord[];
  limitViolations: MachineLimitViolation[];
  kinematicAnomalies: KinematicAnomalyRecord[];
  stockResult: StockSimulationResult;
  toolChangesCount: number;
  snapshots: MachineStateSnapshot[];
  evidenceDigest: string;
  summary: {
    passed: boolean;
    collisionFree: boolean;
    limitsRespected: boolean;
    stockWithinTolerance: boolean;
    kinematicContinuous: boolean;
    verdictMessage: string;
  };
}

export interface MachineSimulationEvidence {
  evidenceId: string;
  timestamp: string;
  engineVersion: string;
  ncProgramHash: string;
  machineHash: string;
  controllerHash: string;
  toolSnapshotHash: string;
  fixtureHash: string;
  stockInitialHash: string;
  stockFinalHash: string;
  gcodeVerificationHash?: string;
  parametersHash: string;
  simulationResultHash: string;
  verdict: SimulationVerdict;
  totalSteps: number;
  totalCycleTimeSec: number;
  collisionCount: number;
  limitViolationCount: number;
  maxStockDeviationMm: number;
  cryptographicSignature: string;
}
