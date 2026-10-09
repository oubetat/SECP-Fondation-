/**
 * PATCH-SECP-087: Interactive 5-Axis Toolpath 3D Machine Simulation & Kinematic Render Types
 */

import { FiveAxisCutterPoint, FiveAxisToolpath, ToolAssembly, Vector3D } from '../classa5axis/SECP083Types';

export type { Vector3D };

export type MachineKinematicType = 
  | 'TABLE_TABLE_TRUNNION_AC'  // Table A (tilt X), Table C (rot Z)
  | 'TABLE_TABLE_TRUNNION_BC'  // Table B (tilt Y), Table C (rot Z)
  | 'HEAD_TABLE_BC'            // Head B (tilt Y), Table C (rot Z)
  | 'HEAD_TABLE_AC'            // Head A (tilt X), Table C (rot Z)
  | 'HEAD_HEAD_AB';            // Head A (tilt X), Head B (rot Y)

export interface MachineAxisLimits {
  xMinMm: number; xMaxMm: number;
  yMinMm: number; yMaxMm: number;
  zMinMm: number; zMaxMm: number;
  aMinDeg: number; aMaxDeg: number;
  bMinDeg: number; bMaxDeg: number;
  cMinDeg: number; cMaxDeg: number;
  maxLinearFeedMmMin: number;
  maxRapidFeedMmMin: number;
  maxRotaryVelocityDegSec: number;
  maxRotaryAccelDegSec2: number;
}

export interface MachineStructureGeometry {
  bedDimensionsMm: Vector3D;
  tableRadiusMm: number;
  pivotOffsetMm: Vector3D; // Distance from C-table center to A/B tilt axis
  gaugePivotOffsetMm: Vector3D; // Head pivot offset to gauge line
  spindleClearanceMm: number;
  fixtureOffsetMm: Vector3D;
  stockDimensionsMm: Vector3D;
}

export interface MachineConfiguration {
  machineId: string;
  name: string;
  kinematicType: MachineKinematicType;
  limits: MachineAxisLimits;
  geometry: MachineStructureGeometry;
  configHash: string;
}

export type Matrix4x4 = number[][]; // 4x4 homogenous matrix

export interface MachineJointValues {
  xMm: number;
  yMm: number;
  zMm: number;
  aDeg: number;
  bDeg: number;
  cDeg: number;
}

export interface ComponentTransforms {
  bedTransform: Matrix4x4;
  tableTransform: Matrix4x4;
  workpieceTransform: Matrix4x4;
  toolTransform: Matrix4x4;
  spindleTransform: Matrix4x4;
  headTransform: Matrix4x4;
}

export interface SECP087MachineState {
  stepIndex: number;
  timestampSec: number;
  joints: MachineJointValues;
  toolTipWcs: Vector3D;
  toolVectorWcs: Vector3D;
  toolTipMcs: Vector3D;
  forwardKinematicsPos: Vector3D;
  forwardKinematicsVector: Vector3D;
  forwardKinematicErrorMm: number;
  moveType: 'RAPID' | 'APPROACH' | 'CUTTING' | 'RETRACT';
  feedRateMmMin: number;
  spindleRpm: number;
  isSpindleActive: boolean;
  hasAxisLimitViolation: boolean;
  hasSingularity: boolean;
  hasOrientationFlip: boolean;
  hasGougeCollision: boolean;
  hasHolderCollision: boolean;
  hasMachineCollision: boolean;
  collisionDetails?: string;
  componentTransforms: ComponentTransforms;
  stateHash: string;
}

export interface SimulationControlsState {
  isPlaying: boolean;
  isPaused: boolean;
  currentStepIndex: number;
  playbackSpeedMultiplier: number;
  safetyModeAutoStop: boolean;
  showToolpathTrace: boolean;
  showCollisions: boolean;
  showMachineComponents: boolean;
  singleBlockMode: boolean;
}

export interface DeterministicReplayResult {
  machineConfigHash: string;
  toolpathHash: string;
  kinematicStateHash: string;
  simulationHash: string;
  totalSteps: number;
  totalDurationSec: number;
  limitViolationCount: number;
  gougeCollisionCount: number;
  holderCollisionCount: number;
  machineCollisionCount: number;
  isDeterministic: boolean;
  provenanceEntryHash: string;
}
