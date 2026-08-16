export interface MachineAxisConfig {
  id: string;
  type: 'LINEAR' | 'ROTARY';
  minLimit: number;
  maxLimit: number;
  home: number;
  resolution: number;
  direction: 1 | -1;
}

export interface RotaryAxisConfig extends MachineAxisConfig {
  type: 'ROTARY';
  axisVector: { x: number; y: number; z: number };
  center: { x: number; y: number; z: number };
}

export interface MachineKinematicConfig {
  id: string;
  linearAxes: MachineAxisConfig[];
  rotaryAxes: RotaryAxisConfig[];
}

export interface ToolOrientation {
  i: number;
  j: number;
  k: number;
}

export interface MachineAxisPosition {
  [axisId: string]: number;
}

export interface MachinePose {
  position: { x: number; y: number; z: number };
  orientation: ToolOrientation;
  machineAxes: MachineAxisPosition;
}

export interface AxisLimitViolation {
  axis: string;
  requested: number;
  limit: number;
  excess: number;
  poseIndex: number;
}

export type SingularityStatus = 'SAFE' | 'WARNING' | 'SINGULAR' | 'REJECTED';

export interface SingularityEvent {
  status: SingularityStatus;
  metric: number;
  tolerance: number;
  poseIndex: number;
}

export type CollisionType =
  | 'TOOL_WORKPIECE_COLLISION'
  | 'TOOL_HOLDER_WORKPIECE_COLLISION'
  | 'RAPID_COLLISION'
  | 'CLEARANCE_VIOLATION'
  | 'NOT_AVAILABLE';

export interface CollisionEvent {
  type: CollisionType;
  poseIndex: number;
  clearance?: number;
  location?: { x: number; y: number; z: number };
}

export type ClearanceStatus = 'CLEAR' | 'CLEARANCE_WARNING' | 'COLLISION' | 'UNVERIFIED';

export interface ClearanceResult {
  status: ClearanceStatus;
  minClearance: number;
  minClearancePoseIndex: number;
  violations: number;
}

export interface GougingEvent {
  detected: boolean;
  penetrationDepth: number;
  poseIndex: number;
  location?: { x: number; y: number; z: number };
}

export interface FiveAxisToolpathPoint {
  position: { x: number; y: number; z: number };
  toolOrientation: ToolOrientation;
  machinePose?: MachinePose;
  feed: number;
  moveType: 'RAPID' | 'CUTTING' | 'LINK';
  sourceIndex: number;
}

export interface FiveAxisToolpath {
  operationId: string;
  points: FiveAxisToolpathPoint[];
  provenance: any;
}

export interface FiveAxisVerificationMetrics {
  pathLength: number;
  poseCount: number;
  validPoseCount: number;
  rejectedPoseCount: number;
  minCartesianSegmentLength: number;
  minMachineAxisStep: number;
  maxPositionResidual: number;
  maxOrientationResidual: number;
  maxAxisLimitExcursion: number;
  minClearance: number;
  collisionCount: number;
  gougingCount: number;
  singularityCount: number;
  zeroLengthSegmentCount: number;
  cartesianContinuityGapCount: number;
  orientationDiscontinuityCount: number;
  machineAxisDiscontinuityCount: number;
}

export interface FiveAxisProvenanceRecord {
  secp096Hash: string;
  secp097Hash: string;
  secp098Hash: string;
  machineConfigHash: string;
  toolGeometryHash: string;
  kinematicParamsHash: string;
  collisionParamsHash: string;
  inputPathHash: string;
  metricsHash: string;
  finalProvenanceHash: string;
}

export interface KinematicVerificationResult {
  isValid: boolean;
  metrics: FiveAxisVerificationMetrics;
  limitViolations: AxisLimitViolation[];
  singularityEvents: SingularityEvent[];
  collisionEvents: CollisionEvent[];
  clearanceResult: ClearanceResult;
  gougingEvents: GougingEvent[];
  provenanceHash: string;
}
