// SECP Industrial OS v2 — Manufacturing Twin Core Types & Data Definitions

export type ManufacturingFeatureType =
  | 'POCKET'
  | 'HOLE'
  | 'SLOT'
  | 'STEP'
  | 'BOSS'
  | 'FACE'
  | 'PROFILE'
  | 'THREAD'
  | 'CHAMFER'
  | 'FILLET'
  | 'DRILLING_FEATURE'
  | 'MILLING_FEATURE'
  | 'TURNING_FEATURE'
  | 'CUSTOM_FEATURE';

export type ManufacturingOperationType =
  | 'RAPID'
  | 'ROUGHING'
  | 'SEMI_FINISHING'
  | 'FINISHING'
  | 'DRILLING'
  | 'REAMING'
  | 'TAPPING'
  | 'BORING'
  | 'POCKETING'
  | 'PROFILE_MILLING'
  | 'FACE_MILLING'
  | 'TURNING'
  | 'THREADING'
  | 'GRINDING'
  | 'INSPECTION'
  | 'CUSTOM';

export type ExecutionStateStatus =
  | 'PLANNED'
  | 'READY'
  | 'RUNNING'
  | 'PAUSED'
  | 'ABORTED'
  | 'COMPLETED'
  | 'FAILED';

export type ManufacturingStateStatus =
  | 'READY'
  | 'NOT_READY'
  | 'MANUFACTURING_VALID'
  | 'MANUFACTURING_INVALID'
  | 'MACHINE_INCOMPATIBLE'
  | 'TOOLING_FAILURE'
  | 'FIXTURE_FAILURE'
  | 'COLLISION_DETECTED'
  | 'KINEMATIC_FAILURE'
  | 'GCODE_INVALID'
  | 'EXECUTION_FAILURE'
  | 'INSPECTION_FAILURE'
  | 'OUT_OF_TOLERANCE'
  | 'TRACEABILITY_FAILURE'
  | 'STALE'
  | 'OUT_OF_SYNC'
  | 'INCOMPLETE'
  | 'INVALID';

export type CollisionVerdict = 'COLLISION_FREE' | 'COLLISION_DETECTED' | 'CLEARANCE_FAILURE' | 'INCOMPLETE' | 'INVALID';
export type KinematicVerdict = 'KINEMATICALLY_VALID' | 'AXIS_LIMIT_FAILURE' | 'SINGULARITY_DETECTED' | 'MACHINE_INCOMPATIBLE' | 'INVALID';
export type GCodeVerdict = 'GCODE_VALID' | 'GCODE_INVALID' | 'MACHINE_INCOMPATIBLE' | 'KINEMATICALLY_INVALID' | 'INCOMPLETE';
export type InspectionVerdict = 'WITHIN_TOLERANCE' | 'OUT_OF_TOLERANCE' | 'MEASUREMENT_INVALID' | 'INCOMPLETE' | 'UNKNOWN';
export type NonconformityDisposition = 'ACCEPT' | 'REWORK' | 'SCRAP' | 'USE_AS_IS' | 'ENGINEERING_REVIEW';
export type ManufacturingFreshness = 'FRESH' | 'STALE' | 'OUT_OF_SYNC' | 'UNKNOWN';
export type DifferentialVerdict = 'MATCH' | 'MISMATCH' | 'INCOMPLETE' | 'INVALID';

export interface ManufacturingFeature {
  featureId: string;
  featureType: ManufacturingFeatureType;
  geometryEntityId: string;
  geometryRevision: string;
  geometryHash: string;
  parameters: Record<string, number>;
  tolerance: { upperLimit: number; lowerLimit: number; unit: string };
  datumReferences: string[];
  materialCondition: 'MMC' | 'LMC' | 'RFS';
  featureHash: string;
}

export interface OperationDefinition {
  operationId: string;
  operationType: ManufacturingOperationType;
  sequence: number;
  targetFeatureIds: string[];
  machineId: string;
  toolAssemblyId: string;
  fixtureId: string;
  parameters: Record<string, number>;
  feedRate: number; // mm/min
  spindleSpeed: number; // RPM
  depthOfCut: number; // mm
  stepover: number; // mm
  coolant: 'FLOOD' | 'MIST' | 'THROUGH_TOOL' | 'AIR' | 'DRY';
  operationHash: string;
}

export interface ProcessPlan {
  processPlanId: string;
  revision: string;
  operations: OperationDefinition[];
  sequence: string[]; // Ordered operation IDs
  machineId: string;
  processHash: string;
}

export interface MachineKinematics {
  axisCount: number;
  axisTypes: ('LINEAR_X' | 'LINEAR_Y' | 'LINEAR_Z' | 'ROTARY_A' | 'ROTARY_B' | 'ROTARY_C')[];
  travelLimits: Record<string, [number, number]>; // Axis -> [min, max]
  velocityLimits: Record<string, number>;
  accelerationLimits: Record<string, number>;
  homePositions: Record<string, number>;
  kinematicChain: string;
  pivotLocations: Record<string, number[]>;
}

export interface MachineConfiguration {
  machineId: string;
  machineModel: string;
  machineRevision: string;
  kinematicsRevision: string;
  kinematics: MachineKinematics;
  controllerType: string;
  controllerVersion: string;
  machineConfigurationHash: string;
}

export interface ToolDefinition {
  toolId: string;
  toolType: 'END_MILL' | 'BALL_NOSE' | 'BULL_NOSE' | 'DRILL' | 'TAP' | 'REAMER' | 'FACE_MILL' | 'TURNING_INSERT';
  diameter: number;
  length: number;
  cuttingEdges: number;
  material: string;
  coating: string;
  manufacturer: string;
  revision: string;
  toolHash: string;
}

export interface ToolHolder {
  holderId: string;
  holderType: 'CAT40' | 'BT40' | 'HSK63A' | 'CAPTO_C6';
  gaugeLength: number;
  diameter: number;
  interface: string;
  revision: string;
  holderHash: string;
}

export interface ToolAssembly {
  toolAssemblyId: string;
  tool: ToolDefinition;
  holder: ToolHolder;
  toolLifeRemaining: number; // Percentage 0-100
  usageCount: number;
  cuttingTimeMinutes: number;
  wearState: 'NEW' | 'NORMAL_WEAR' | 'CRITICAL_WEAR' | 'EXPIRED';
  toolAssemblyHash: string;
}

export interface FixtureDefinition {
  fixtureId: string;
  revision: string;
  locators: string[];
  clamps: string[];
  datumReferences: string[];
  fixtureGeometryHash: string;
  fixtureConfigurationHash: string;
}

export interface ManufacturingSetup {
  setupId: string;
  workpieceId: string;
  fixtureId: string;
  orientation: number[]; // RPY angles
  datumReferenceFrame: string;
  workOffset: string; // G54, G55, etc.
  setupRevision: string;
  setupHash: string;
}

export interface ToolpathSegment {
  segmentId: string;
  type: 'RAPID' | 'LINEAR' | 'CIRCULAR_CW' | 'CIRCULAR_CCW';
  startPoint: number[]; // [x, y, z]
  endPoint: number[]; // [x, y, z]
  toolAxis: number[]; // [i, j, k]
  feedRate: number;
  spindleSpeed: number;
}

export interface Toolpath {
  toolpathId: string;
  toolpathRevision: string;
  operationId: string;
  machineId: string;
  toolAssemblyId: string;
  segments: ToolpathSegment[];
  toolpathHash: string;
}

export interface PostProcessorDefinition {
  postId: string;
  postVersion: string;
  machineTarget: string;
  controllerTarget: string;
  configuration: Record<string, any>;
  revision: string;
  postHash: string;
}

export interface NCProgram {
  programId: string;
  programRevision: string;
  postProcessorHash: string;
  toolpathHash: string;
  machineHash: string;
  gcodeLines: string[];
  programTextHash: string;
}

export interface ExecutionTelemetryPacket {
  timestamp: string;
  sequence: number;
  axisPosition: Record<string, number>;
  axisVelocity: Record<string, number>;
  spindleSpeed: number;
  spindleLoad: number;
  feedRate: number;
  coolantState: boolean;
  temperature: number;
  vibrationLevel: number;
  payloadHash: string;
  signature: string;
}

export interface ManufacturingExecution {
  executionId: string;
  manufacturingTwinId: string;
  machineId: string;
  operatorId: string;
  programHash: string;
  toolpathHash: string;
  startTime: string;
  endTime?: string;
  executionState: ExecutionStateStatus;
  telemetryStream: ExecutionTelemetryPacket[];
  executionHash: string;
}

export interface AsManufacturedGeometry {
  measurementDataId: string;
  pointCloudHash: string;
  scanHash: string;
  inspectionGeometryHash: string;
  measurementDevice: string;
  measurementAccuracy: number; // mm
  calibrationId: string;
  timestamp: string;
}

export interface DeviationMap {
  maxDeviation: number;
  minDeviation: number;
  meanDeviation: number;
  RMSDeviation: number;
}

export interface ToleranceVerification {
  featureId: string;
  nominalValue: number;
  measuredValue: number;
  upperLimit: number;
  lowerLimit: number;
  deviation: number;
  uncertainty: number;
  verdict: InspectionVerdict;
}

export interface ManufacturingNonconformity {
  nonconformityId: string;
  featureId: string;
  requirement: string;
  actualValue: number;
  allowedRange: [number, number];
  deviation: number;
  severity: 'MINOR' | 'MAJOR' | 'CRITICAL';
  disposition: NonconformityDisposition;
}

export interface ManufacturedPartIdentity {
  partSerial: string;
  manufacturingTwinId: string;
  executionId: string;
  materialBatch: string;
  machineId: string;
  programHash: string;
  inspectionId: string;
  finalGeometryHash: string;
}

export interface ManufacturingState {
  designState: { productId: string; productRevision: string };
  geometryState: { geometryTwinId: string; geometryHash: string; geometryRevision: string };
  materialState: { materialId: string; materialRevision: string; materialBatch: string };
  featureState: { features: ManufacturingFeature[]; featuresHash: string };
  processState: { processPlan: ProcessPlan; processHash: string };
  machineState: { machineConfiguration: MachineConfiguration; machineConfigHash: string };
  toolState: { toolAssemblies: ToolAssembly[]; toolingHash: string };
  fixtureState: { fixture: FixtureDefinition; setup: ManufacturingSetup; fixtureConfigHash: string };
  toolpathState: { toolpaths: Toolpath[]; toolpathsHash: string };
  ncState: { postProcessor: PostProcessorDefinition; ncProgram: NCProgram; ncHash: string };
  executionState?: ManufacturingExecution;
  asManufacturedState?: AsManufacturedGeometry;
  inspectionState?: { verifications: ToleranceVerification[]; deviationMap: DeviationMap; verdict: InspectionVerdict };
  evidenceState: { evidenceId: string; evidenceHash: string };
}

export interface ManufacturingTwin {
  manufacturingTwinId: string;
  productId: string;
  productRevision: string;
  geometryTwinId: string;
  materialRevision: string;
  manufacturingRevision: string;
  processPlanId: string;
  machineConfigurationId: string;
  toolConfigurationId: string;
  fixtureConfigurationId: string;
  toolpathId: string;
  ncProgramId: string;
  executionId: string;
  inspectionId: string;
  state: ManufacturingStateStatus;
  manufacturingState: ManufacturingState;
  createdAt: string;
  updatedAt: string;
  inputHash: string;
  processHash: string;
  executionHash: string;
  resultHash: string;
  rootHash: string;
}

export interface ManufacturingEvent {
  eventId: string;
  manufacturingTwinId: string;
  executionId: string;
  eventType:
    | 'JOB_CREATED'
    | 'PLAN_RELEASED'
    | 'SETUP_CREATED'
    | 'TOOL_LOADED'
    | 'FIXTURE_INSTALLED'
    | 'PROGRAM_LOADED'
    | 'EXECUTION_STARTED'
    | 'EXECUTION_COMPLETED'
    | 'INSPECTION_COMPLETED'
    | 'NONCONFORMITY_DETECTED';
  timestamp: string;
  previousStateHash: string;
  newStateHash: string;
  source: string;
  actor: string;
  evidenceId: string;
  eventHash: string;
}

export interface ManufacturingProvenance {
  sourceGeometry: string;
  sourceMaterial: string;
  sourceProcessPlan: string;
  sourceMachine: string;
  sourceTooling: string;
  sourceFixture: string;
  sourceToolpath: string;
  sourceNCProgram: string;
  sourceExecution: string;
  sourceInspection: string;
}

export interface ManufacturingEvidence {
  evidenceId: string;
  manufacturingTwinId: string;
  inputHash: string;
  processHash: string;
  ncHash: string;
  executionHash: string;
  inspectionHash: string;
  rootHash: string;
  provenance: ManufacturingProvenance;
  partIdentity: ManufacturedPartIdentity;
  timestamp: string;
}
