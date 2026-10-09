import { Point3D, Vector3D, CollisionObject } from "../collision/types";
import { MachineKinematicModel, HomogeneousTransform } from "../kinematics/types";
import { MachineProfile, ControllerProfile, SpindleDirection, MachineAxisToolpath } from "../post/types";
import { ToolInstance } from "../toolLibrary/types";
import { BRepSolid } from "../../cad-kernel/brep/BRepContracts";
import { SimulationMachineState, SimulationEvidencePackage } from "../simulation/types";
import { GCodeVerificationReport } from "../verification/types";

export enum TwinLifecycleState {
  CREATED = "CREATED",
  CONFIGURED = "CONFIGURED",
  COMMISSIONED = "COMMISSIONED",
  SYNCHRONIZED = "SYNCHRONIZED",
  ACTIVE = "ACTIVE",
  DEGRADED = "DEGRADED",
  STALE = "STALE",
  OFFLINE = "OFFLINE",
  RETIRED = "RETIRED",
  INVALID = "INVALID"
}

export enum TwinVerdict {
  SYNCHRONIZED = "SYNCHRONIZED",
  DEGRADED = "DEGRADED",
  STALE = "STALE",
  STATE_DIVERGENCE = "STATE_DIVERGENCE",
  CONFIGURATION_DRIFT = "CONFIGURATION_DRIFT",
  TELEMETRY_FAILURE = "TELEMETRY_FAILURE",
  HISTORY_INTEGRITY_FAILURE = "HISTORY_INTEGRITY_FAILURE",
  KINEMATIC_MISMATCH = "KINEMATIC_MISMATCH",
  INVALID = "INVALID",
  UNDETERMINED = "UNDETERMINED"
}

export enum TwinEventType {
  MACHINE_STARTED = "MACHINE_STARTED",
  MACHINE_STOPPED = "MACHINE_STOPPED",
  PROGRAM_STARTED = "PROGRAM_STARTED",
  PROGRAM_PAUSED = "PROGRAM_PAUSED",
  PROGRAM_RESUMED = "PROGRAM_RESUMED",
  PROGRAM_COMPLETED = "PROGRAM_COMPLETED",
  TOOL_CHANGED = "TOOL_CHANGED",
  AXIS_MOVED = "AXIS_MOVED",
  SPINDLE_CHANGED = "SPINDLE_CHANGED",
  OFFSET_CHANGED = "OFFSET_CHANGED",
  FIXTURE_CHANGED = "FIXTURE_CHANGED",
  ALARM_RAISED = "ALARM_RAISED",
  ALARM_CLEARED = "ALARM_CLEARED",
  SENSOR_UPDATE = "SENSOR_UPDATE",
  STATE_SYNCHRONIZED = "STATE_SYNCHRONIZED",
  STATE_DIVERGED = "STATE_DIVERGED",
  TWIN_DEGRADED = "TWIN_DEGRADED",
  TWIN_OFFLINE = "TWIN_OFFLINE"
}

export enum TelemetryQuality {
  VALID = "VALID",
  INVALID = "INVALID",
  STALE = "STALE",
  MISSING = "MISSING",
  ESTIMATED = "ESTIMATED",
  OUT_OF_RANGE = "OUT_OF_RANGE"
}

export enum SynchronizationMode {
  REAL_TIME = "REAL_TIME",
  NEAR_REAL_TIME = "NEAR_REAL_TIME",
  BATCH = "BATCH",
  REPLAY = "REPLAY",
  OFFLINE = "OFFLINE"
}

export enum DivergenceType {
  POSITION_DIVERGENCE = "POSITION_DIVERGENCE",
  ORIENTATION_DIVERGENCE = "ORIENTATION_DIVERGENCE",
  SPINDLE_DIVERGENCE = "SPINDLE_DIVERGENCE",
  TOOL_DIVERGENCE = "TOOL_DIVERGENCE",
  OFFSET_DIVERGENCE = "OFFSET_DIVERGENCE",
  PROGRAM_DIVERGENCE = "PROGRAM_DIVERGENCE",
  TIMING_DIVERGENCE = "TIMING_DIVERGENCE",
  GEOMETRIC_DIVERGENCE = "GEOMETRIC_DIVERGENCE"
}

export enum DriftType {
  TOOL_DRIFT = "TOOL_DRIFT",
  FIXTURE_DRIFT = "FIXTURE_DRIFT",
  KINEMATIC_DRIFT = "KINEMATIC_DRIFT",
  CONTROLLER_DRIFT = "CONTROLLER_DRIFT",
  SENSOR_DRIFT = "SENSOR_DRIFT",
  GEOMETRY_DRIFT = "GEOMETRY_DRIFT",
  OFFSET_DRIFT = "OFFSET_DRIFT"
}

export enum SafetyState {
  NORMAL = "NORMAL",
  WARNING = "WARNING",
  LIMIT_APPROACH = "LIMIT_APPROACH",
  LIMIT_VIOLATION = "LIMIT_VIOLATION",
  COLLISION_RISK = "COLLISION_RISK",
  COLLISION = "COLLISION",
  EMERGENCY_STOP = "EMERGENCY_STOP",
  UNKNOWN = "UNKNOWN"
}

export enum HealthStatus {
  HEALTHY = "HEALTHY",
  DEGRADED = "DEGRADED",
  FAULT = "FAULT",
  UNKNOWN = "UNKNOWN"
}

export enum StateProvenanceSource {
  MEASURED = "MEASURED",
  DERIVED = "DERIVED",
  SIMULATED = "SIMULATED",
  ESTIMATED = "ESTIMATED",
  CONFIGURED = "CONFIGURED",
  UNKNOWN = "UNKNOWN"
}

export interface TwinIdentity {
  twinId: string;
  machineId: string;
  manufacturer: string;
  machineModel: string;
  machineSerialReference: string;
  configurationRevision: number;
  instanceFingerprint: string;
}

export interface MachineDigitalTwinContract {
  twinId: string;
  twinRevision: number;
  machineId: string;
  machineRevision: number;
  machineProfileId: string;
  controllerProfileId: string;
  kinematicModelId: string;
  geometryModelId: string;
  toolAssemblyId: string;
  fixtureModelId: string;
  telemetryProfileId: string;
  synchronizationPolicy: {
    mode: SynchronizationMode;
    maxLatencyMS: number;
    stalenessThresholdMS: number;
    clockSyncToleranceMS: number;
    reorderWindowMS: number;
  };
  statePolicy: {
    historyCapacity: number;
    checkpointIntervalMS: number;
    hashChainingEnabled: boolean;
  };
  healthPolicy: {
    maxTrackingErrorMM: number;
    maxSpindleRPMSlip: number;
    temperatureWarningThresholdC: number;
    temperatureFaultThresholdC: number;
    maxVibrationG: number;
  };
  uncertaintyPolicy: {
    sensorLinearToleranceMM: number;
    sensorAngularToleranceDeg: number;
    encoderResolutionMM: number;
    confidenceThreshold: number;
  };
}

export interface MachineComponentNode {
  componentId: string;
  componentType: "BASE" | "COLUMN" | "SADDLE" | "HEAD" | "SPINDLE" | "TABLE" | "ROTARY_TABLE" | "TOOL_CHANGER" | "SENSOR" | "FIXTURE" | "ENCLOSURE";
  name: string;
  parentId?: string;
  geometryId: string;
  kinematicNodeId?: string;
  configurationRevision: number;
  status: "ACTIVE" | "MAINTENANCE" | "DEGRADED" | "UNKNOWN";
  engineeringGeometry?: BRepSolid;
  collisionGeometry?: CollisionObject;
  visualizationMeshId?: string;
}

export interface MachineHierarchy {
  rootComponentId: string;
  components: Record<string, MachineComponentNode>;
}

export interface TransformEdge {
  sourceFrame: string;
  targetFrame: string;
  transform: HomogeneousTransform;
  timestamp: number;
  revision: number;
  provenance: StateProvenanceSource;
}

export interface MachineTransformGraph {
  frames: string[];
  transforms: TransformEdge[];
}

export interface AxisTwinState {
  axisName: string;
  commandedPosition: number;
  actualPosition: number;
  velocity: number;
  acceleration: number;
  trackingError: number;
  limitState: "NORMAL" | "SOFT_LIMIT_NEAR" | "SOFT_LIMIT_EXCEEDED" | "HARD_LIMIT_TRIPPED";
  timestamp: number;
  provenance: StateProvenanceSource;
}

export interface RotaryAxisTwinState {
  axisName: string;
  commandedAngleDeg: number;
  actualAngleDeg: number;
  angularVelocityDegS: number;
  angularAccelerationDegS2: number;
  trackingErrorDeg: number;
  wrapState: number; // number of full rotations
  limitState: "NORMAL" | "SOFT_LIMIT_NEAR" | "SOFT_LIMIT_EXCEEDED" | "HARD_LIMIT_TRIPPED";
  timestamp: number;
  provenance: StateProvenanceSource;
}

export interface SpindleTwinState {
  commandedRPM: number;
  actualRPM: number;
  direction: SpindleDirection;
  loadPercent: number;
  temperatureC: number;
  vibrationG: number;
  status: "STOPPED" | "ACCELERATING" | "RUNNING" | "DECELERATING" | "FAULT";
  slipRPM: number;
  timestamp: number;
  provenance: StateProvenanceSource;
}

export interface ControllerTwinState {
  programId: string;
  programLine: number;
  activeToolNumber: number;
  activeOffsetId: string;
  modalState: {
    motionMode: string; // G00, G01, etc.
    planeSelection: string; // G17, G18, G19
    feedMode: string; // G94, G95
    distanceMode: string; // G90, G91
  };
  feedRateMMMin: number;
  actualFeedRateMMMin: number;
  spindleSpeedRPM: number;
  machineMode: "AUTO" | "MDI" | "MANUAL" | "EDIT" | "EMERGENCY_STOP";
  alarmCodes: string[];
  timestamp: number;
  provenance: StateProvenanceSource;
}

export interface ToolTwinState {
  toolId: string;
  toolNumber: number;
  toolAssemblyId: string;
  lengthOffsetMM: number;
  radiusOffsetMM: number;
  wearLengthMM: number;
  wearRadiusMM: number;
  lifeState: "NEW" | "NORMAL" | "WORN" | "EXPIRED" | "BROKEN";
  measurementSource: "MEASURED" | "CONFIGURED" | "ESTIMATED" | "UNKNOWN";
  timestamp: number;
}

export interface WorkpieceTwinState {
  workpieceId: string;
  geometryRevision: number;
  fixtureId: string;
  stockStateHash: string;
  machinedStateHash: string;
  removedVolumeMM3: number;
  timestamp: number;
}

export interface FixtureTwinState {
  fixtureId: string;
  configurationId: string;
  clampState: "CLAMPED" | "UNCLAMPED" | "IN_TRANSIT" | "FAULT";
  fixtureRevision: number;
  timestamp: number;
}

export interface MachineHealthState {
  overallHealth: HealthStatus;
  axisHealth: Record<string, HealthStatus>;
  spindleHealth: HealthStatus;
  toolHealth: HealthStatus;
  controllerHealth: HealthStatus;
  sensorHealth: HealthStatus;
  diagnostics: string[];
  timestamp: number;
}

export interface MachineTwinState {
  stateId: string;
  sequenceNumber: number;
  timestamp: number;
  previousStateHash: string;
  currentStateHash: string;
  lifecycleState: TwinLifecycleState;
  axes: Record<string, AxisTwinState>;
  rotaryAxes: Record<string, RotaryAxisTwinState>;
  spindle: SpindleTwinState;
  controller: ControllerTwinState;
  tool: ToolTwinState;
  workpiece: WorkpieceTwinState;
  fixture: FixtureTwinState;
  safety: SafetyState;
  health: MachineHealthState;
  uncertaintyRadiusMM: number;
  provenance: StateProvenanceSource;
}

export interface MachineTwinEvent {
  eventId: string;
  timestamp: number;
  source: string;
  machineId: string;
  twinId: string;
  sequence: number;
  type: TwinEventType;
  payload: any;
  payloadHash: string;
  previousEventHash: string;
}

export interface TelemetryReading {
  sensorId: string;
  sourceTimestamp: number;
  ingestionTimestamp: number;
  processingTimestamp: number;
  value: number | string | boolean | object;
  unit: string; // "mm", "deg", "rpm", "degC", "bar", "g", "mm/min", "none"
  quality: TelemetryQuality;
  source: "OPC_UA" | "MTCONNECT" | "MQTT" | "INDUSTRIAL_ETHERNET" | "REST" | "NATIVE_API" | "SIMULATED";
  sequence: number;
  sensorRevision: number;
  calibrationValid: boolean;
}

export interface TelemetryContract {
  telemetryProfileId: string;
  sensorDefinitions: {
    sensorId: string;
    metric: string;
    unit: string;
    expectedSamplingRateHz: number;
    minDomainValue: number;
    maxDomainValue: number;
    calibrationValidUntil: string;
  }[];
}

export interface TrackingErrorMetrics {
  axisName: string;
  currentError: number;
  maxError: number;
  rmsError: number;
  sampleCount: number;
}

export interface DivergenceRecord {
  divergenceId: string;
  timestamp: number;
  type: DivergenceType;
  expectedValue: any;
  actualValue: any;
  difference: number;
  tolerance: number;
  severity: "INFO" | "WARNING" | "CRITICAL";
  affectedComponent: string;
}

export interface AnomalyRecord {
  anomalyId: string;
  timestamp: number;
  sensorId: string;
  metric: string;
  baseline: number;
  actual: number;
  deviation: number;
  threshold: number;
  confidence: number;
  thresholdProvenance: string;
}

export interface TwinCheckpoint {
  checkpointId: string;
  timestamp: number;
  machineStateHash: string;
  telemetryPosition: number;
  toolState: ToolTwinState;
  programState: ControllerTwinState;
  stockStateHash: string;
  healthState: MachineHealthState;
  snapshotState: MachineTwinState;
}

export interface TwinUncertaintyModel {
  sensorLinearUncertaintyMM: number;
  sensorAngularUncertaintyDeg: number;
  kinematicTransformationErrorMM: number;
  clockJitterMS: number;
  combinedSpatialUncertaintyMM: number;
  confidenceScore: number;
}

export interface MachineTwinFingerprint {
  machineProfileHash: string;
  kinematicModelHash: string;
  geometryHash: string;
  controllerProfileHash: string;
  toolAssemblyHash: string;
  fixtureHash: string;
  telemetrySchemaHash: string;
  policyHash: string;
  twinRevision: number;
  compositeFingerprint: string;
}

export interface ReconciliationResult {
  toolpathId: string;
  gcodeProgramId: string;
  sampleCount: number;
  averagePositionDeviationMM: number;
  maxPositionDeviationMM: number;
  averageSpindleSlipRPM: number;
  feedDeviationMMMin: number;
  divergences: DivergenceRecord[];
  isWithinAcceptanceBounds: boolean;
  verdict: TwinVerdict;
}

export interface MachineTwinEvidencePackage {
  contract: MachineDigitalTwinContract;
  identity: TwinIdentity;
  fingerprint: MachineTwinFingerprint;
  lifecycleState: TwinLifecycleState;
  verdict: TwinVerdict;
  currentState: MachineTwinState;
  history: MachineTwinState[];
  events: MachineTwinEvent[];
  checkpoints: TwinCheckpoint[];
  divergences: DivergenceRecord[];
  anomalies: AnomalyRecord[];
  trackingMetrics: Record<string, TrackingErrorMetrics>;
  reconciliation: ReconciliationResult;
  uncertainty: TwinUncertaintyModel;
  gateResult: HardAcceptanceResult110;
  generatedAt: string;
}

export interface HardAcceptanceResult110 {
  passed: boolean;
  scorePercentage: number;
  totalChecks: number;
  passedChecks: number;
  verdict: TwinVerdict;
  timestamp: string;
  details: {
    checkName: string;
    status: "PASS" | "FAIL";
    evidence: string;
  }[];
}
