import { Vector3D } from '../cadKernel';

export interface DigitalThreadTraceabilityNode {
  clMoveId: string;
  toolpathId: string;
  featureId: string;
  topologyReference: string;
  sourceRevision: string;
}

export interface CuttingTool {
  toolId: string;
  name: string;
  type: string;
  diameterMm: number;
  cornerRadiusMm: number;
  fluteCount: number;
  fluteLengthMm: number;
  overallLengthMm: number;
  holderDiameterMm: number;
  gaugeLengthMm: number;
  reachMm: number;
  material: string;
  fingerprint: string;
}

export interface ToolHolder {
  holderId: string;
  name: string;
  gaugeDiameterMm: number;
  upperDiameterMm: number;
  lengthMm: number;
  clearanceMarginMm: number;
}

export interface ToolAssembly {
  assemblyId: string;
  tool: CuttingTool;
  holder: ToolHolder;
  offsetNumber: number;
  compensationLengthMm: number;
  fingerprint: string;
}

export interface MachiningOperationConfig {
  id?: string;
  operationId?: string;
  name: string;
  strategy?: string;
  strategyType?: string;
  toolId?: string;
  topologyId?: string;
  toolAssembly?: ToolAssembly;
  parameters?: {
    stepoverMm: number;
    stepdownMm: number;
    stockToLeaveMm: number;
    toleranceMm: number;
    entryStrategy: string;
  };
  feedsAndSpeeds?: {
    surfaceSpeedMMin: number;
    feedPerToothMm: number;
    spindleRpm: number;
    cuttingFeedMmMin: number;
    plungeFeedMmMin: number;
    rapidFeedMmMin: number;
  };
  clearancePlaneZ?: number;
  retractPlaneZ?: number;
  fingerprint?: string;
}

export interface CutterLocationPoint {
  pointIndex: number;
  position: Vector3D;
  toolVector?: Vector3D;
  feedRateMmMin: number;
  spindleRpm: number;
  moveType: 'RAPID_APPROACH' | 'CUTTING' | 'RETRACT' | 'PLUNGE' | 'CLEARANCE' | 'TRANSITION';
  x?: number;
  y?: number;
  z?: number;
  i?: number;
  j?: number;
  k?: number;
  feed?: number;
  rpm?: number;
}

export interface MachineConfiguration {
  machineId: string;
  name: string;
  axes: any[];
  controllerType: string;
  fingerprint: string;
}

export interface StockModel {
  stockId: string;
  material: string;
  bounds: { xMin: number; xMax: number; yMin: number; yMax: number; zMin: number; zMax: number };
  initialVolumeMm3: number;
  fingerprint: string;
}

export interface VerificationIssue {
  pointIndex: number;
  issueType: string;
  location: Vector3D;
  description: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
}

export type VerificationFailureType = 'INVALID_SEGMENT' | 'COLLISION' | 'GOUGE_PART' | 'OUT_OF_BOUNDS';

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

export interface CandidateToolpathTrajectory {
  operationId: string;
  strategy: string;
  points: CutterLocationPoint[];
  totalLengthMm: number;
  estimatedTimeSec: number;
  generatedAt: string;
  provenance: any;
}

export interface VerifiedToolpathTrajectory {
  operationId?: string;
  strategy?: string;
  points: Array<CutterLocationPoint | {
    x: number;
    y: number;
    z: number;
    i?: number;
    j?: number;
    k?: number;
    feed: number;
    rpm: number;
  }>;
  totalLengthMm?: number;
  estimatedTimeSec: number;
  generatedAt?: string;
  provenance?: any;
  verificationReport?: ToolpathVerificationReport;
}

export interface CutterLocationDataPackage {
  patch: 'SECP-057';
  partId: string;
  timestamp: string;
  operations: MachiningOperationConfig[];
  trajectories: VerifiedToolpathTrajectory[];
  totalPointsCount: number;
  totalEstimatedTimeSec: number;
  totalMaterialRemovedMm3: number;
  traceabilityNodes: DigitalThreadTraceabilityNode[];
  clDataHash: string;
  provenanceSignature: string;
}
