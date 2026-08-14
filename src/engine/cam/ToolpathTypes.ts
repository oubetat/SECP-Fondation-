/**
 * PATCH-SECP-057 — Deterministic Multi-Axis Toolpath Generation
 * Type contracts for CAM Toolpath Generation, Cutter Location (CL) Data, and Machining Operations.
 */

import { Vector3D } from '../cadKernel';
import { ProcessType } from '../manufacturing/ManufacturingTypes';

export type ToolType = 
  | 'FLAT_ENDMILL'
  | 'BALL_NOSE'
  | 'BULL_NOSE'
  | 'CHAMFER_MILL'
  | 'FACE_MILL'
  | 'TWIST_DRILL'
  | 'TAP'
  | 'REAMER';

export interface CuttingTool {
  toolId: string;
  name: string;
  type: ToolType;
  diameterMm: number;
  cornerRadiusMm: number;    // 0 for flat endmill, diameter/2 for ball nose
  fluteCount: number;
  fluteLengthMm: number;
  overallLengthMm: number;
  holderDiameterMm: number;
  gaugeLengthMm: number;     // Distance from gauge line to tip
  material: 'CARBIDE' | 'HSS' | 'CERAMIC' | 'CBN' | 'PCD';
}

export type MoveType = 
  | 'RAPID_APPROACH'
  | 'PLUNGE'
  | 'CUTTING'
  | 'ADAPTIVE_TROCHOIDAL'
  | 'RETRACT'
  | 'CLEARANCE_TRANSITION'
  | 'LEAD_IN'
  | 'LEAD_OUT';

export interface CutterLocationPoint {
  pointIndex: number;
  position: Vector3D;        // X, Y, Z in mm
  toolVector: Vector3D;      // I, J, K normalized tool axis vector
  feedRateMmMin: number;     // Feed rate in mm/min
  spindleRpm: number;        // Spindle speed in RPM
  moveType: MoveType;
  engagementAngleRad?: number; // Tool engagement angle in radians
  scallopHeightMm?: number;   // Calculated surface scallop height
  stepoverMm?: number;        // Radial depth of cut
}

export type ToolpathStrategyType = 
  | 'FACING'
  | 'ADAPTIVE_ROUGHING'
  | 'Z_LEVEL_FINISHING'
  | 'PLANAR_RASTER'
  | 'DRILLING_PECK'
  | 'TAPPING'
  | 'MULTI_AXIS_SWARF'
  | 'FIVE_AXIS_CONTOUR';

export interface FeedsAndSpeeds {
  surfaceSpeedMMin: number;   // Cutting speed Vc (m/min)
  feedPerToothMm: number;     // Feed per tooth fz (mm/tooth)
  spindleRpm: number;         // Computed n (RPM)
  cuttingFeedMmMin: number;   // Computed Vf (mm/min)
  plungeFeedMmMin: number;    // Plunge feed rate
  rapidFeedMmMin: number;     // Rapid traverse speed (G0)
}

export interface MachiningOperationConfig {
  operationId: string;
  name: string;
  strategy: ToolpathStrategyType;
  targetFeatureId?: string;
  tool: CuttingTool;
  feedsAndSpeeds: FeedsAndSpeeds;
  stepoverMm: number;         // Radial stepover ae
  stepdownMm: number;         // Axial depth of cut ap
  stockToLeaveMm: number;     // Finishing allowance
  clearancePlaneZ: number;    // Safe Z height
  retractPlaneZ: number;      // Retract Z height
  maxEngagementAngleDeg?: number; // For adaptive roughing (e.g., 45 deg)
}

export interface ToolpathTrajectory {
  operationId: string;
  strategy: ToolpathStrategyType;
  tool: CuttingTool;
  points: CutterLocationPoint[];
  totalLengthMm: number;
  estimatedTimeSec: number;
  materialRemovalVolumeMm3: number;
  maxEngagementAngleRad: number;
  collisionFree: boolean;
  gougeFree: boolean;
}

export interface CutterLocationDataPackage {
  patch: 'SECP-057';
  partId: string;
  timestamp: string;
  operations: MachiningOperationConfig[];
  trajectories: ToolpathTrajectory[];
  totalPointsCount: number;
  totalMachiningTimeSec: number;
  totalMaterialRemovedMm3: number;
  clDataHash: string;
  provenanceSignature: string;
}
