import { PropertyProvenance } from "../../materials/types";

export enum MachineType {
  MILL_3_AXIS = "MILL_3_AXIS",
  MILL_4_AXIS = "MILL_4_AXIS",
  MILL_5_AXIS = "MILL_5_AXIS",
  TURNING = "TURNING",
  MILL_TURN = "MILL_TURN",
  LATHE = "LATHE",
  ROBOTIC_MANUFACTURING = "ROBOTIC_MANUFACTURING",
  CUSTOM = "CUSTOM",
  UNKNOWN = "UNKNOWN"
}

export enum MachineAxisType {
  LINEAR_X = "LINEAR_X",
  LINEAR_Y = "LINEAR_Y",
  LINEAR_Z = "LINEAR_Z",
  ROTARY_A = "ROTARY_A",
  ROTARY_B = "ROTARY_B",
  ROTARY_C = "ROTARY_C",
  CUSTOM_LINEAR = "CUSTOM_LINEAR",
  CUSTOM_ROTARY = "CUSTOM_ROTARY"
}

export enum KinematicJointType {
  PRISMATIC = "PRISMATIC",
  REVOLUTE = "REVOLUTE",
  FIXED = "FIXED",
  CUSTOM = "CUSTOM"
}

export enum IKSolutionStatus {
  VALID = "VALID",
  LIMIT_VIOLATION = "LIMIT_VIOLATION",
  SINGULAR = "SINGULAR",
  UNREACHABLE = "UNREACHABLE",
  COLLISION_UNKNOWN = "COLLISION_UNKNOWN",
  NUMERICAL_FAILURE = "NUMERICAL_FAILURE"
}

export enum ReachabilityStatus {
  REACHABLE = "REACHABLE",
  UNREACHABLE = "UNREACHABLE",
  CONDITIONALLY_REACHABLE = "CONDITIONALLY_REACHABLE",
  INSUFFICIENT_DATA = "INSUFFICIENT_DATA"
}

export enum CalibrationStatus {
  CALIBRATED = "CALIBRATED",
  PARTIALLY_CALIBRATED = "PARTIALLY_CALIBRATED",
  UNCALIBRATED = "UNCALIBRATED",
  EXPIRED = "EXPIRED",
  UNKNOWN = "UNKNOWN"
}

export enum MachineLibraryStatus {
  DRAFT = "DRAFT",
  VALIDATED = "VALIDATED",
  ACTIVE = "ACTIVE",
  SUSPENDED = "SUSPENDED",
  OBSOLETE = "OBSOLETE",
  INVALID = "INVALID"
}

export enum MachineCompatibilityVerdict {
  COMPATIBLE = "COMPATIBLE",
  CONDITIONALLY_COMPATIBLE = "CONDITIONALLY_COMPATIBLE",
  INCOMPATIBLE = "INCOMPATIBLE",
  INSUFFICIENT_DATA = "INSUFFICIENT_DATA",
  INVALID = "INVALID"
}

export enum TrueKinematicVerdict {
  VALID = "VALID",
  INVALID = "INVALID",
  REACHABLE = "REACHABLE",
  UNREACHABLE = "UNREACHABLE",
  LIMIT_VIOLATION = "LIMIT_VIOLATION",
  SINGULAR = "SINGULAR",
  NUMERICAL_FAILURE = "NUMERICAL_FAILURE",
  CONDITIONALLY_VALID = "CONDITIONALLY_VALID",
  INSUFFICIENT_DATA = "INSUFFICIENT_DATA",
  FRAME_INCONSISTENCY = "FRAME_INCONSISTENCY"
}

export interface HomogeneousTransform {
  matrix: number[][]; // 4x4 homogenous matrix representing rotation & translation
}

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export interface MachineAxis {
  axisId: string;
  axisName: string;
  axisType: MachineAxisType;
  direction: Vector3D; // Normalized vector
  origin: Vector3D;
  parent?: string;
  jointId: string;
  travelLimits: {
    min: number;
    max: number;
    softMin?: number;
    softMax?: number;
  };
  velocityLimit: number; // units/s or deg/s
  accelerationLimit: number; // units/s^2 or deg/s^2
  jerkLimit?: number; // units/s^3 or deg/s^3
  homePosition: number;
  zeroPosition: number;
  signConvention: number; // 1 or -1
  continuousRotation?: boolean;
}

export interface KinematicJoint {
  jointId: string;
  jointType: KinematicJointType;
  parentLink: string;
  childLink: string;
  axisId?: string;
  origin: Vector3D;
  offset: number;
}

export interface KinematicLink {
  linkId: string;
  name: string;
  geometryPath?: string;
  mass?: number;
  centerOfMass?: Vector3D;
}

export interface KinematicChain {
  chainId: string;
  links: KinematicLink[];
  joints: KinematicJoint[];
  baseFrameId: string;
}

export interface MachineBaseFrame {
  frameId: string;
  origin: Vector3D;
  xAxis: Vector3D;
  yAxis: Vector3D;
  zAxis: Vector3D;
  handedness: "RIGHT_HANDED" | "LEFT_HANDED";
}

export interface CoordinateSystem {
  id: string;
  name: string; // MCS, WCS, TCS
  baseFrameId: string;
  transformToBase: HomogeneousTransform;
}

export interface ToolCenterPoint {
  position: Vector3D;
  orientation: Vector3D; // Euler angles or direction vector
  reference: "TOOL_TIP" | "TOOL_CENTER" | "GAUGE_POINT" | "SPINDLE_REFERENCE";
}

export interface ControllerKinematicCapabilities {
  rtcpSupported: boolean;
  toolLengthCompensation: boolean;
  workOffsetsCount: number;
  rotaryInterpolation: boolean;
  inverseTimeFeed: boolean;
  continuous5Axis: boolean;
}

export interface MachineCalibration {
  calibrationId: string;
  status: CalibrationStatus;
  axisOffset: Record<string, number>;
  squareness: Record<string, number>;
  rotaryAxisError?: {
    pivotError: Vector3D;
    tiltError: number;
  };
  calibrationRevision: number;
  calibrationDate: string;
}

export interface MachineKinematicModel {
  machineId: string;
  machineRevision: number;
  machineType: MachineType;
  kinematicChain: KinematicChain;
  axes: MachineAxis[];
  baseFrame: MachineBaseFrame;
  coordinateSystems: CoordinateSystem[];
  spindle: {
    spindleId: string;
    maxRPM: number;
    interfaceType: string;
    powerLimit?: number;
    torqueLimit?: number;
  };
  limits: {
    maxWorkpieceWeight: number;
    maxToolWeight: number;
    workEnvelope: {
      xMin: number;
      xMax: number;
      yMin: number;
      yMax: number;
      zMin: number;
      zMax: number;
    };
  };
  controllerCapabilities: ControllerKinematicCapabilities;
  calibration?: MachineCalibration;
  fingerprint: string;
  status: MachineLibraryStatus;
  provenance: {
    source: string;
    manufacturer: string;
    model: string;
    serialNumber: string;
    importDate: string;
  };
}

export interface MachineKinematicState {
  axisPositions: Record<string, number>; // axisId -> current value
  axisVelocities: Record<string, number>;
  axisAccelerations: Record<string, number>;
  toolPose: HomogeneousTransform;
  workpiecePose: HomogeneousTransform;
  timestamp: string;
  stateFingerprint: string;
}

export interface KinematicSnapshot {
  snapshotId: string;
  machineId: string;
  machineRevision: number;
  state: MachineKinematicState;
  coordinateFrames: CoordinateSystem[];
  timestamp: string;
}

export interface IKSolution {
  solutionId: string;
  axisValues: Record<string, number>;
  status: IKSolutionStatus;
  errorDistance: number;
}

export interface KinematicPathContract {
  machineRevision: number;
  startState: MachineKinematicState;
  targetPose: HomogeneousTransform;
  axisSolution: IKSolution;
  limits: {
    positionPassed: boolean;
    velocityPassed: boolean;
  };
  solverRevision: number;
  tolerancePolicy: {
    positionTolerance: number;
    angularTolerance: number;
  };
}
