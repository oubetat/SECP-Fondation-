import { MachinePose } from '../kinematics/KinematicTypes';

export interface MachinePostProfile {
  id: string;
  hasA: boolean;
  hasC: boolean;
  limits: {
    X: [number, number];
    Y: [number, number];
    Z: [number, number];
    A: [number, number];
    C: [number, number];
  };
  feedRange: [number, number];
  spindleRange: [number, number];
  toolRange: [number, number];
}

export interface GCodeDocument {
  lines: string[];
  byteLength: number;
  provenance: any;
}

export interface GCodeVerificationMetrics {
  byteLength: number;
  commandCount: number;
  motionCommandCount: number;
  rapidMoveCount: number;
  cuttingMoveCount: number;
  toolChangeCount: number;
  spindleCommandCount: number;
  feedCommandCount: number;
  sourcePoseCount: number;
  reconstructedPoseCount: number;
  maxPositionDeviation: number;
  maxOrientationDeviation: number; // For simplified check
  maxAxisDeviation: number;
  minSegmentLength: number;
  zeroLengthSegmentCount: number;
  cartesianDiscontinuityCount: number;
  rotaryDiscontinuityCount: number;
  axisLimitViolations: number;
  modalViolations: number;
  syntaxViolations: number;
  dangerousCommandCount: number;
  verificationFailures: number;
}

export interface ReconstructedPose {
  machinePose: MachinePose;
  isRapid: boolean;
  feed: number;
  spindle: number;
  tool: number;
  lineIndex: number;
}
