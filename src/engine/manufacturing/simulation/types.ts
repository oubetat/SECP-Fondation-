import { HomogeneousTransform } from "../kinematics/types";
import { Point3D, Vector3D, CollisionModel, CollisionObject } from "../collision/types";
import { MachineProfile, ControllerProfile, MachineAxisToolpath, SpindleDirection, MachineAxisPoint } from "../post/types";
import { MachineKinematicModel } from "../kinematics/types";
import { ToolInstance } from "../toolLibrary/types";
import { BRepSolid } from "../../cad-kernel/brep/BRepContracts";
import { PropertyProvenance } from "../../materials/types";

export enum SimulationVerdict {
  SIMULATED = "SIMULATED",
  SIMULATION_COMPLETE = "SIMULATION_COMPLETE",
  SIMULATION_INCOMPLETE = "SIMULATION_INCOMPLETE",
  COLLISION_DETECTED = "COLLISION_DETECTED",
  LIMIT_VIOLATION = "LIMIT_VIOLATION",
  GOUGE = "GOUGE",
  EXCESS_MATERIAL = "EXCESS_MATERIAL",
  NUMERICAL_FAILURE = "NUMERICAL_FAILURE",
  SIMULATION_GAP = "SIMULATION_GAP",
  MODEL_UNCERTAIN = "MODEL_UNCERTAIN",
  INVALID = "INVALID",
  UNDETERMINED = "UNDETERMINED"
}

export enum SimulationEventType {
  SIMULATION_STARTED = "SIMULATION_STARTED",
  SIMULATION_CHECKPOINT = "SIMULATION_CHECKPOINT",
  TOOL_CHANGE = "TOOL_CHANGE",
  MOTION_STARTED = "MOTION_STARTED",
  MOTION_COMPLETED = "MOTION_COMPLETED",
  MATERIAL_REMOVED = "MATERIAL_REMOVED",
  COLLISION_DETECTED = "COLLISION_DETECTED",
  CLEARANCE_CRITICAL = "CLEARANCE_CRITICAL",
  LIMIT_VIOLATION = "LIMIT_VIOLATION",
  NUMERICAL_FAILURE = "NUMERICAL_FAILURE",
  SIMULATION_GAP = "SIMULATION_GAP",
  SIMULATION_COMPLETED = "SIMULATION_COMPLETED",
  SIMULATION_ABORTED = "SIMULATION_ABORTED"
}

export enum RemovalRepresentation {
  VOXEL = "VOXEL",
  SDF = "SDF",
  DEXEL = "DEXEL",
  BREP = "BREP",
  HYBRID = "HYBRID"
}

export enum ContactClassification {
  CUTTING_CONTACT = "CUTTING_CONTACT",
  EXPECTED_CONTACT = "EXPECTED_CONTACT",
  FIXTURE_CONTACT = "FIXTURE_CONTACT",
  UNEXPECTED_CONTACT = "UNEXPECTED_CONTACT",
  COLLISION = "COLLISION"
}

export interface ToolpathSimulationContract {
  simulationId: string;
  simulationRevision: number;
  toolpathId: string;
  toolpathRevision: number;
  machineProfileId: string;
  controllerProfileId: string;
  toolAssemblyId: string;
  stockModelId: string;
  fixtureModelId: string;
  workpieceModelId: string;
  simulationPolicy: {
    representation: RemovalRepresentation;
    timeStep: number;
    adaptiveSubdivision: boolean;
    precisionMM: number;
  };
  collisionPolicy: {
    enabled: boolean;
    stopOnCollision: boolean;
    clearanceThresholdMM: number;
  };
  tolerancePolicy: {
    gougeToleranceMM: number;
    excessToleranceMM: number;
  };
  samplingPolicy: {
    minStepMM: number;
    maxStepMM: number;
    maxAngularStepDeg: number;
  };
}

export interface SimulationMachineState {
  timestamp: number;
  axisPositions: Record<string, number>;
  rotaryPositions: Record<string, number>;
  toolPose: {
    position: Point3D;
    orientation: Vector3D;
  };
  activeTool: string;
  feed: number;
  spindleRPM: number;
  spindleDirection: SpindleDirection;
  coolantState: { flood: boolean; mist: boolean; throughSpindle: boolean; air: boolean };
  workOffset: string;
  toolOffset: number;
  collisionState: boolean;
  stockStateHash: string;
}

export interface SimulationStock {
  stockId: string;
  type: "BOX" | "CYLINDER" | "MESH" | "VOXEL";
  geometry: BRepSolid | any;
  representation: RemovalRepresentation;
  resolution: number;
  boundingBox: { min: Point3D; max: Point3D };
  volume: number;
  coordinateSystem: string;
  fingerprint: string;
}

export interface SimulationModel {
  machine: MachineKinematicModel;
  controller: ControllerProfile;
  tool: ToolInstance;
  holder: CollisionObject;
  spindle: CollisionObject;
  stock: SimulationStock;
  workpiece: CollisionObject;
  fixture: CollisionObject[];
  coordinateSystems: Record<string, HomogeneousTransform>;
  toolpath: MachineAxisToolpath;
}

export interface ToolpathSimulationEvent {
  eventId: string;
  type: SimulationEventType;
  timestamp: number;
  simulationId: string;
  operationId?: string;
  segmentId?: string;
  machineStateHash: string;
  stockStateHash: string;
  evidenceReference: string;
  data?: any;
}

export interface DeviationMap {
  maxDeviation: number;
  minDeviation: number;
  RMSDeviation: number;
  percentWithinTolerance: number;
  points: { point: Point3D; deviation: number }[];
}

export interface SimulationMetrics {
  totalSimulationTime: number;
  physicalMachiningTime: number;
  numberOfSamples: number;
  numberOfSegments: number;
  removedVolume: number;
  remainingVolume: number;
  minimumClearance: number;
  maximumDeviation: number;
  RMSDeviation: number;
  collisionCount: number;
  limitViolationCount: number;
  gapCount: number;
  performance: {
    samplesPerSec: number;
    segmentsPerSec: number;
    voxelsPerSec?: number;
    memoryMB: number;
  };
}

export interface HardAcceptanceResult109 {
  passed: boolean;
  scorePercentage: number;
  totalChecks: number;
  passedChecks: number;
  verdict: SimulationVerdict;
  timestamp: string;
  details: {
    checkName: string;
    status: "PASS" | "FAIL";
    evidence: string;
  }[];
}

export interface SimulationStateTrace {
  simulationId: string;
  samples: SimulationMachineState[];
}

export interface SimulationEvidencePackage {
  contract: ToolpathSimulationContract;
  integrityReport: { isValid: boolean; failures: string[] };
  model: SimulationModel;
  initialState: SimulationMachineState;
  stateTrace: SimulationMachineState[];
  events: ToolpathSimulationEvent[];
  metrics: SimulationMetrics;
  deviationMap: DeviationMap;
  verdict: SimulationVerdict;
  gateResult: HardAcceptanceResult109;
}
