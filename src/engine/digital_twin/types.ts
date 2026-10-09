export type TwinType = 
  | 'PRODUCT_TWIN' 
  | 'ASSEMBLY_TWIN' 
  | 'COMPONENT_TWIN' 
  | 'MANUFACTURING_TWIN' 
  | 'MACHINE_TWIN' 
  | 'PROCESS_TWIN' 
  | 'SYSTEM_TWIN' 
  | 'FIELD_TWIN';

export type StateLayer = 
  | 'DESIGN_STATE' 
  | 'RELEASED_STATE' 
  | 'MANUFACTURED_STATE' 
  | 'INSTALLED_STATE' 
  | 'MAINTAINED_STATE' 
  | 'CURRENT_STATE';

export type TwinVerdict = 
  | 'VALID' 
  | 'INVALID' 
  | 'INCOMPLETE' 
  | 'OUT_OF_SYNC' 
  | 'CONFLICT' 
  | 'CORRUPTED' 
  | 'NON_RECONSTRUCTABLE';

export type SyncVerdict = 
  | 'SYNCHRONIZED' 
  | 'OUT_OF_SYNC' 
  | 'CONFLICT' 
  | 'INVALID' 
  | 'INCOMPLETE';

export type TwinFreshness = 
  | 'FRESH' 
  | 'STALE' 
  | 'UNKNOWN';

export type TwinClosure = 
  | 'OPEN' 
  | 'PARTIAL' 
  | 'COMPLETE' 
  | 'BLOCKED' 
  | 'INVALID';

export type TwinRelationship = 
  | 'REPRESENTS' 
  | 'CONTAINS' 
  | 'DEPENDS_ON' 
  | 'DERIVED_FROM' 
  | 'CONFIGURED_AS' 
  | 'MANUFACTURED_AS' 
  | 'INSTALLED_AS' 
  | 'SIMULATED_BY' 
  | 'VERIFIED_BY' 
  | 'VALIDATED_BY' 
  | 'SERVICED_BY' 
  | 'SUPERSEDES';

export type MaterialStateType = 
  | 'DESIGN_MATERIAL' 
  | 'QUALIFIED_MATERIAL' 
  | 'BATCH_MATERIAL' 
  | 'MANUFACTURED_STATE' 
  | 'HEAT_TREATED_STATE';

export interface BRepIdentity {
  solidHash: string;
  faceTopologyHash: string;
  edgeTopologyHash: string;
  vertexTopologyHash: string;
  surfaceDefinitionHash: string;
  curveDefinitionHash: string;
}

export interface GeometryTwinState {
  geometryId: string;
  geometryRevision: string;
  kernelVersion: string;
  topologyHash: string;
  geometryHash: string;
  brep?: BRepIdentity;
}

export interface MaterialTwinState {
  materialId: string;
  materialRevision: string;
  materialQualification: string;
  materialBatch: string;
  materialState: MaterialStateType;
  temperatureProperties?: Record<string, number>;
  plasticityModel?: string;
  creepModel?: string;
  fatigueProperties?: Record<string, number>;
  fractureProperties?: Record<string, number>;
}

export interface AssemblyTwinState {
  assemblyId: string;
  assemblyRevision: string;
  assemblyHash: string;
  components: string[]; // Component IDs
  occurrences: Array<{ occurrenceId: string; componentId: string; transform: number[] }>;
  constraints: Array<{ constraintId: string; type: string; entities: string[] }>;
  configuration: string;
  variant: string;
}

export interface BOMTwinState {
  bomId: string;
  BOMRevision: string;
  BOMHash: string;
  componentSet: Array<{ partNumber: string; revision: string; quantity: number; findNumber: number }>;
  effectivity: string;
  configuration: string;
  variant: string;
}

export interface ConfigurationTwinState {
  configurationId: string;
  configurationVersion: string;
  configurationHash: string;
  variantHash: string;
  revisionSetHash: string;
  BOMHash: string;
  assemblyHash: string;
}

export interface VariantTwinState {
  variantId: string;
  variantVersion: string;
  variantHash: string;
  parentVariant?: string;
  rules: string[];
  options: Record<string, string>;
  configuration: string;
  effectivity: string;
}

export interface PhysicsTwinState {
  physicsDomain: 'STRUCTURAL' | 'THERMAL' | 'CFD' | 'ELECTROMAGNETIC' | 'MULTIBODY';
  governingModel: string;
  loads: Record<string, any>;
  constraints: Record<string, any>;
  boundaryConditions: Record<string, any>;
  initialConditions?: Record<string, any>;
  materialModels: string[];
  solver: string;
  solverVersion: string;
  inputHash: string;
  meshHash?: string;
  resultHash?: string;
  verificationVerdict?: string;
  validationVerdict?: string;
}

export interface MachineTwinState {
  machineId: string;
  machineType: string;
  kinematics: Record<string, any>;
  controller: string;
  axes: string[];
  limits: Record<string, number[]>;
  state: 'IDLE' | 'SETUP' | 'RUNNING' | 'PAUSED' | 'FAULT' | 'MAINTENANCE' | 'OFFLINE';
  lastStateChange: string;
  source: string;
}

export interface ToolTwinState {
  toolId: string;
  toolRevision: string;
  geometryHash: string;
  material: string;
  holder: string;
  assignedMachine?: string;
  lifeExpectedMinutes: number;
  currentWearMinutes: number;
  calibrationDate: string;
}

export interface ManufacturingTwinState {
  manufacturingOrderId: string;
  releasedConfigurationId: string;
  processPlanId: string;
  machineId: string;
  machineState: MachineTwinState;
  tools: ToolTwinState[];
  toolpathHash: string;
  postProcessorVersion: string;
  gcodeHash: string;
  inspectionRecords: Array<{ feature: string; nominal: number; actual: number; tolerance: number; passed: boolean }>;
  manufacturedInstanceId: string;
}

export interface SensorTelemetry {
  sensorId: string;
  timestamp: string;
  measurement: number;
  unit: string;
  quality: 'GOOD' | 'UNCERTAIN' | 'BAD';
  source: string;
  signature: string;
  sequenceNumber: number;
}

export interface FieldTwinState {
  installedConfigurationId: string;
  currentConfigurationId: string;
  operatingHours: number;
  serviceHistory: Array<{ serviceId: string; date: string; action: string; technician: string; evidenceId: string }>;
  telemetry: Record<string, SensorTelemetry>;
  deviations: Array<{ feature: string; designValue: any; fieldActual: any; recordedAt: string; proposalId?: string }>;
}

export interface TwinState {
  layer: StateLayer;
  geometryState?: GeometryTwinState;
  materialState?: MaterialTwinState;
  assemblyState?: AssemblyTwinState;
  bomState?: BOMTwinState;
  configurationState?: ConfigurationTwinState;
  variantState?: VariantTwinState;
  physicsState?: PhysicsTwinState;
  manufacturingState?: ManufacturingTwinState;
  fieldState?: FieldTwinState;
  lifecycleState?: { state: string; effectiveDate: string };
  evidenceReferences: string[]; // Evidence IDs from Patch-121
  timestamp: string;
  stateHash: string;
}

export interface UnifiedDigitalTwin {
  twinId: string;
  twinType: TwinType;
  subjectId: string;
  subjectType: string;
  productId: string;
  revisionId: string;
  variantId: string;
  configurationId: string;
  instanceId?: string;
  currentLayer: StateLayer;
  version: string;
  createdAt: string;
  updatedAt: string;
  twinHash: string;
}

export interface TwinEvent {
  eventId: string;
  twinId: string;
  eventType: string;
  previousStateHash: string;
  newStateHash: string;
  timestamp: string;
  source: string;
  actor: string;
  evidenceId: string;
  eventHash: string;
  payload?: any;
}

export interface DigitalTwinSnapshot {
  twinId: string;
  timestamp: string;
  geometryHash: string;
  materialHash: string;
  BOMHash: string;
  assemblyHash: string;
  revisionHash: string;
  variantHash: string;
  configurationHash: string;
  physicsHash: string;
  manufacturingHash: string;
  fieldHash: string;
  evidenceHash: string;
  twinRootHash: string;
}

export interface TwinSyncEvent {
  syncId: string;
  sourceDomain: 'CAD' | 'PLM' | 'FEM' | 'CFD' | 'CAM' | 'FIELD';
  sourceVersion: string;
  sourceHash: string;
  targetDomain: 'CAD' | 'PLM' | 'FEM' | 'CFD' | 'CAM' | 'FIELD';
  targetVersion: string;
  targetHash: string;
  timestamp: string;
  result: SyncVerdict;
  details?: string;
}

export interface DigitalTwinGraphNode {
  id: string;
  type: string;
  label: string;
  hash: string;
  metadata?: Record<string, any>;
}

export interface DigitalTwinGraphEdge {
  id: string;
  source: string;
  target: string;
  relationship: TwinRelationship;
  evidenceId?: string;
  hash: string;
}
