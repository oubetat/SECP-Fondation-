/**
 * PATCH-SECP-057 — Deterministic Multi-Axis Toolpath Generation
 * Type contracts for CAM Toolpath Generation, Stock Modeling, Cutter Location (CL) Data,
 * Independent Verification, and Digital Thread Traceability.
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

export interface ToolHolderGeometry {
  holderId: string;
  name: string;
  gaugeDiameterMm: number;
  upperDiameterMm: number;
  lengthMm: number;
  clearanceMarginMm: number;
}

export interface CutterGeometry {
  diameterMm: number;
  cornerRadiusMm: number;    // 0 for flat endmill, diameter/2 for ball nose
  fluteCount: number;
  fluteLengthMm: number;
  overallLengthMm: number;
  reachMm: number;           // Maximum overhang depth before holder collision
  material: 'CARBIDE' | 'HSS' | 'CERAMIC' | 'CBN' | 'PCD';
}

export interface CuttingTool {
  toolId: string;
  name: string;
  type: ToolType;
  diameterMm: number;
  cornerRadiusMm: number;
  fluteCount: number;
  fluteLengthMm: number;
  overallLengthMm: number;
  holderDiameterMm: number;
  gaugeLengthMm: number;
  reachMm?: number;
  material: 'CARBIDE' | 'HSS' | 'CERAMIC' | 'CBN' | 'PCD';
  holder?: ToolHolderGeometry;
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
  topologyId?: string;       // B-Rep persistent topology link
  tool: CuttingTool;
  feedsAndSpeeds: FeedsAndSpeeds;
  stepoverMm: number;         // Radial stepover ae
  stepdownMm: number;         // Axial depth of cut ap
  stockToLeaveMm: number;     // Finishing allowance
  clearancePlaneZ: number;    // Safe Z height
  retractPlaneZ: number;      // Retract Z height
  maxEngagementAngleDeg?: number; // For adaptive roughing (e.g., 45 deg)
}

/**
 * Candidate Toolpath (Unverified output from generation engine)
 */
export interface CandidateToolpathTrajectory {
  operationId: string;
  strategy: ToolpathStrategyType;
  tool: CuttingTool;
  points: CutterLocationPoint[];
  totalLengthMm: number;
  estimatedTimeSec: number;
  nominalVolumeMm3: number;
  maxEngagementAngleRad: number;
  generatedTimestamp: string;
}

export type VerificationFailureType = 
  | 'GOUGE_PART'
  | 'COLLISION_HOLDER'
  | 'COLLISION_RAPID'
  | 'INSUFFICIENT_CLEARANCE'
  | 'AXIS_LIMIT_VIOLATION'
  | 'EXCESSIVE_ENGAGEMENT';

export interface VerificationIssue {
  pointIndex: number;
  issueType: VerificationFailureType;
  location: Vector3D;
  description: string;
  severity: 'WARNING' | 'CRITICAL';
}

export interface ToolpathVerificationReport {
  operationId: string;
  isValid: boolean;
  gougeFree: boolean;
  collisionFree: boolean;
  clearanceSatisfied: boolean;
  axisLimitsSatisfied: boolean;
  issues: VerificationIssue[];
  verifiedPointsCount: number;
  verifiedAt: string;
}

export interface VerifiedToolpathTrajectory extends CandidateToolpathTrajectory {
  verificationReport: ToolpathVerificationReport;
  collisionFree: boolean;
  gougeFree: boolean;
}

export interface StockModelBounds {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  zMin: number;
  zMax: number;
}

export interface MaterialRemovalPassResult {
  passIndex: number;
  removedVolumeMm3: number;
  remainingStockVolumeMm3: number;
  maxRemainingDepthMm: number;
}

export interface DigitalThreadTraceabilityNode {
  topologyId: string;
  manufacturingFeatureId: string;
  operationId: string;
  candidateToolpathId: string;
  verifiedClPackageHash: string;
  provenanceSignature: string;
}

export interface CutterLocationDataPackage {
  patch: 'SECP-057';
  partId: string;
  timestamp: string;
  operations: MachiningOperationConfig[];
  trajectories: VerifiedToolpathTrajectory[];
  totalPointsCount: number;
  totalMachiningTimeSec: number;
  totalMaterialRemovedMm3: number;
  clDataHash: string;
  provenanceSignature: string;
  traceabilityNodes: DigitalThreadTraceabilityNode[];
}

