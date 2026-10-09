/**
 * SECP Industrial OS v2 — CAM Production Engine
 * PATCH-256 — 3-Axis Toolpath Engine: Core Types & Contracts
 */

import { ManufacturingFeature, ManufacturingFeatureType, ManufacturingIntent, ToolAccessDirection } from '../feature-recognition/FeatureTypes';

export enum ToolType {
  FLAT_END_MILL = 'FLAT_END_MILL',
  BALL_NOSE = 'BALL_NOSE',
  BULL_NOSE = 'BULL_NOSE', // Corner Radius Mill
  CHAMFER_MILL = 'CHAMFER_MILL',
  DRILL = 'DRILL',
  SPOT_DRILL = 'SPOT_DRILL',
  FACE_MILL = 'FACE_MILL',
  SLOT_MILL = 'SLOT_MILL',
}

export enum MotionType {
  RAPID = 'RAPID',       // G0 non-cutting positioning
  FEED = 'FEED',         // G1 linear cutting
  PLUNGE = 'PLUNGE',     // G1 linear vertical entry
  RAMP = 'RAMP',         // G1 inclined ramp entry
  HELIX = 'HELIX',       // G2/G3 helical entry
  ARC_CW = 'ARC_CW',     // G2 clockwise circular motion
  ARC_CCW = 'ARC_CCW',   // G3 counter-clockwise circular motion
  RETRACT = 'RETRACT',   // Retract to clearance/retract plane
}

export enum CoolantState {
  OFF = 'OFF',
  FLOOD = 'FLOOD',
  MIST = 'MIST',
  AIR_BLAST = 'AIR_BLAST',
  THROUGH_SPINDLE = 'THROUGH_SPINDLE',
}

export enum OperationStrategyType {
  FACING = 'FACING',
  POCKET_ROUGHING = 'POCKET_ROUGHING',
  POCKET_FINISHING = 'POCKET_FINISHING',
  ADAPTIVE_ROUGHING = 'ADAPTIVE_ROUGHING',
  CONTOUR_PROFILE = 'CONTOUR_PROFILE',
  SLOT_MILLING = 'SLOT_MILLING',
  DRILLING = 'DRILLING',
  SPOT_DRILLING = 'SPOT_DRILLING',
  HELICAL_BORE = 'HELICAL_BORE',
  PARALLEL_FINISHING = 'PARALLEL_FINISHING',
  CONSTANT_Z_FINISHING = 'CONSTANT_Z_FINISHING',
  REST_MACHINING = 'REST_MACHINING',
}

export enum EntryStrategyType {
  PLUNGE = 'PLUNGE',
  RAMP = 'RAMP',
  HELIX = 'HELIX',
  PRE_DRILLED_HOLE = 'PRE_DRILLED_HOLE',
}

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export interface ToolPosition {
  x: number;
  y: number;
  z: number;
  i?: number; // Tool vector X (0 for 3-axis)
  j?: number; // Tool vector Y (0 for 3-axis)
  k?: number; // Tool vector Z (1 for 3-axis)
  feedMmMin: number;
  spindleRpm: number;
  motionType: MotionType;
  coolant: CoolantState;
  segmentIndex: number;
  arcCenter?: Vector3D; // For ARC_CW / ARC_CCW
  arcRadius?: number;
  arcPlane?: 'XY' | 'XZ' | 'YZ';
  timestampSec?: number;
}

export interface ToolpathSegment {
  id: string;
  startPoint: Vector3D;
  endPoint: Vector3D;
  motionType: MotionType;
  feedMmMin: number;
  spindleRpm: number;
  lengthMm: number;
  estimatedTimeSec: number;
  isCutting: boolean;
  zLevelMm: number;
  arcCenter?: Vector3D;
  arcRadius?: number;
}

export interface CuttingTool {
  id: string;
  name: string;
  type: ToolType;
  diameterMm: number;
  fluteLengthMm: number;
  overallLengthMm: number;
  numberOfFlutes: number;
  cornerRadiusMm?: number;
  tipAngleDeg?: number; // For drills & chamfer mills
  holderDiameterMm: number;
  holderLengthMm: number;
  maxRpm: number;
  maxFeedMmMin: number;
  material: 'CARBIDE' | 'HSS' | 'COATED_CARBIDE' | 'CERAMIC';
}

export interface WorkCoordinateSystem {
  id: string; // e.g. G54, G55
  name: string;
  origin: Vector3D; // Offset relative to CAD origin
  xAxis: Vector3D;  // Default [1, 0, 0]
  yAxis: Vector3D;  // Default [0, 1, 0]
  zAxis: Vector3D;  // Default [0, 0, 1]
  rotationDegZ: number;
}

export interface StockModel {
  id: string;
  type: 'BOX' | 'CYLINDER' | 'CUSTOM_MESH';
  boundsMm: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    minZ: number;
    maxZ: number;
  };
  dimensionsMm: {
    dx: number;
    dy: number;
    dz: number;
    diameter?: number;
  };
  origin: Vector3D;
  initialVolumeMm3: number;
  currentVolumeMm3: number;
}

export interface MachiningSetup {
  id: string;
  name: string;
  wcs: WorkCoordinateSystem;
  stock: StockModel;
  partBodyId: string;
  toolOrientation: Vector3D; // [0,0,1] for standard 3-axis top setup
  safePlaneZMm: number;
  retractPlaneZMm: number;
  clearancePlaneZMm: number;
  fixtureBounds?: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    minZ: number;
    maxZ: number;
  };
  operations: MachiningOperation[];
}

export interface CuttingParameters {
  spindleRpm: number;
  cuttingFeedMmMin: number;
  plungeFeedMmMin: number;
  rampFeedMmMin: number;
  rapidFeedMmMin: number;
  stepdownMm: number;
  stepoverMm: number;
  stockToLeaveFloorMm: number;
  stockToLeaveWallMm: number;
  entryStrategy: EntryStrategyType;
  rampAngleDeg?: number;
  helixRadiusMm?: number;
  helixPitchMm?: number;
  coolant: CoolantState;
}

export interface MachiningBoundary {
  type: 'RECTANGLE' | 'POLYGON' | 'FEATURE_DRIVEN';
  points: { x: number; y: number }[];
  containment: 'INSIDE' | 'OUTSIDE';
  offsetMm: number;
  minZMm: number;
  maxZMm: number;
}

export interface MachiningOperation {
  id: string;
  name: string;
  setupId: string;
  featureId?: string;
  strategyType: OperationStrategyType;
  tool: CuttingTool;
  parameters: CuttingParameters;
  boundary?: MachiningBoundary;
  toolpath?: Toolpath;
  isValidated: boolean;
  validationReport?: ToolpathValidationReport;
  isInvalidated: boolean;
  invalidationReason?: string;
}

export interface Toolpath {
  id: string;
  operationId: string;
  setupId: string;
  toolId: string;
  positions: ToolPosition[];
  segments: ToolpathSegment[];
  totalLengthMm: number;
  rapidLengthMm: number;
  cuttingLengthMm: number;
  estimatedMachiningTimeSec: number;
  maxDepthMm: number;
  zPassCount: number;
  boundingVolume: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    minZ: number;
    maxZ: number;
  };
  toolpathHash: string;
}

export interface CollisionEvent {
  segmentIndex: number;
  toolPosition: Vector3D;
  collisionType: 'TOOL_HOLDER_PART' | 'TOOL_SHANK_PART' | 'TOOL_FIXTURE' | 'RAPID_STOCK_COLLISION';
  penetrationDepthMm: number;
  description: string;
}

export interface GougeEvent {
  segmentIndex: number;
  toolPosition: Vector3D;
  surfaceId: string;
  gougeDepthMm: number;
  description: string;
}

export interface ToolpathValidationReport {
  isValid: boolean;
  operationId: string;
  totalSegments: number;
  rapidSegments: number;
  cuttingSegments: number;
  collisions: CollisionEvent[];
  gouges: GougeEvent[];
  diagnostics: string[];
  maxStepdownExceeded: boolean;
  boundaryViolations: number;
  nanCoordinatesCount: number;
  safeRetractVerified: boolean;
}

export interface ToolpathEvidence {
  evidenceId: string;
  timestamp: string;
  partHash: string;
  bRepHash: string;
  featureIds: string[];
  setupId: string;
  toolDefinitions: CuttingTool[];
  operationCount: number;
  toolpathSignatures: { operationId: string; strategy: OperationStrategyType; hash: string; points: number }[];
  masterToolpathHash: string;
  algorithmVersion: string;
  verdict: 'PROVEN' | 'PARTIAL' | 'FAILED';
  deterministicFingerprint: string;
  simulationMetrics: {
    initialStockVolumeMm3: number;
    finalStockVolumeMm3: number;
    removedVolumeMm3: number;
    maxCuspHeightMm: number;
    maxPositiveDeviationMm: number;
    maxNegativeGougeMm: number;
  };
}
