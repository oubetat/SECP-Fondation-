/**
 * SECP-098 — CAM Toolpath Engine Domain Models
 * Type contracts for Deterministic Toolpath Generation, Stock Modeling, 
 * Forensic Provenance, and Machining Integrity.
 */

import { Vector3D } from '../cadKernel';

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
  fingerprint?: string;
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
  reachMm: number;           // Maximum overhang depth before holder collision
  material: 'CARBIDE' | 'HSS' | 'CERAMIC' | 'CBN' | 'PCD';
  holder?: ToolHolderGeometry;
  fingerprint: string;       // Deterministic tool hash
}

export interface ToolAssembly {
  assemblyId: string;
  tool: CuttingTool;
  holder: ToolHolderGeometry;
  offsetNumber: number;      // T-number in G-code
  compensationLengthMm: number;
  fingerprint: string;
}

export type MoveType = 
  | 'RAPID_APPROACH'
  | 'PLUNGE'
  | 'CUTTING'
  | 'ADAPTIVE_TROCHOIDAL'
  | 'RETRACT'
  | 'CLEARANCE_TRANSITION'
  | 'LEAD_IN'
  | 'LEAD_OUT'
  | 'LINK_MOVE';

export interface ToolpathSegment {
  segmentIndex: number;
  startPoint: Vector3D;
  endPoint: Vector3D;
  moveType: MoveType;
  feedRateMmMin: number;
  spindleRpm: number;
  lengthMm: number;
  durationSec: number;
}

export interface CutterLocationPoint {
  pointIndex: number;
  position: Vector3D;        // X, Y, Z in mm
  toolVector: Vector3D;      // I, J, K normalized tool axis vector
  feedRateMmMin: number;     // Feed rate in mm/min
  spindleRpm: number;        // Spindle speed in RPM
  moveType: MoveType;
  engagementAngleRad?: number; 
  stepoverMm?: number;
}

export type ToolpathStrategyType = 
  | 'FACING'
  | 'ROUGHING_ADAPTIVE'
  | 'FINISHING_Z_LEVEL'
  | 'CONTOUR_PROFILE'
  | 'POCKET_MACHINING'
  | 'DRILLING_PECK';

export interface MachiningParameters {
  stepoverMm: number;
  stepdownMm: number;
  stockToLeaveMm: number;
  toleranceMm: number;
  maxEngagementAngleDeg?: number;
  entryStrategy: 'PLUNGE' | 'RAMP' | 'HELIX';
}

export interface FeedsAndSpeeds {
  surfaceSpeedMMin: number;
  feedPerToothMm: number;
  spindleRpm: number;
  cuttingFeedMmMin: number;
  plungeFeedMmMin: number;
  rapidFeedMmMin: number;
}

export interface MachiningOperationConfig {
  operationId: string;
  name: string;
  strategy: ToolpathStrategyType;
  topologyId: string;       // B-Rep persistent topology link (SECP-096)
  toolAssembly: ToolAssembly;
  parameters: MachiningParameters;
  feedsAndSpeeds: FeedsAndSpeeds;
  clearancePlaneZ: number;
  retractPlaneZ: number;
  fingerprint: string;       // Deterministic op hash
}

export interface CandidateToolpathTrajectory {
  operationId: string;
  strategy: ToolpathStrategyType;
  points: CutterLocationPoint[];
  totalLengthMm: number;
  estimatedTimeSec: number;
  generatedAt: string;
  provenance: {
    inputTopologyHash: string;
    toolFingerprint: string;
    parameterHash: string;
    trajectoryHash: string;
  };
}

export type VerificationFailureType = 
  | 'GOUGE_PART'
  | 'COLLISION_HOLDER'
  | 'COLLISION_RAPID'
  | 'AXIS_LIMIT_VIOLATION'
  | 'EXCESSIVE_ENGAGEMENT'
  | 'DISCONTINUITY'
  | 'CONTINUITY_GAP'
  | 'ZERO_LENGTH_SEGMENT'
  | 'INVALID_SEGMENT'
  | 'STOCK_VIOLATION'
  | 'PARAMETER_OUT_OF_BOUNDS';

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
  metrics: {
    totalLengthMm: number;
    segmentCount: number;
    minSegmentLengthMm: number;
    zeroLengthSegments: number;
    continuityGaps: number;
    maxCoordinateDeviationMm: number;
    stockViolations: number;
    invalidSegments: number;
  };
  issues: VerificationIssue[];
  verifiedAt: string;
  provenanceHash: string;
}

export interface VerifiedToolpathTrajectory extends CandidateToolpathTrajectory {
  verificationReport: ToolpathVerificationReport;
}

export interface StockModel {
  stockId: string;
  material: string;
  bounds: {
    xMin: number; xMax: number;
    yMin: number; yMax: number;
    zMin: number; zMax: number;
  };
  initialVolumeMm3: number;
  fingerprint: string;
}

export interface StockModelBounds {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  zMin: number;
  zMax: number;
}

export interface CAMStructuralFingerprint {
  operationId: string;
  inputHash: string;
  outputHash: string;
  timestamp: string;
  validatorVersion: string;
}

export interface DigitalThreadTraceabilityNode {
  topologyId: string;
  manufacturingFeatureId: string;
  operationId: string;
  candidateToolpathId: string;
  verifiedClPackageHash: string;
  provenanceSignature: string;
}

export type CutterLocationDataPackage = any; // Legacy bridge

