import { PropertyProvenance } from "../../materials/types";

export enum ManufacturingStateType {
  AS_DESIGNED = "AS_DESIGNED",
  AS_PLANNED = "AS_PLANNED",
  AS_SCHEDULED = "AS_SCHEDULED",
  IN_PROCESS = "IN_PROCESS",
  AS_MANUFACTURED = "AS_MANUFACTURED",
  AS_INSPECTED = "AS_INSPECTED",
  REWORKED = "REWORKED",
  SCRAPPED = "SCRAPPED",
  RELEASED = "RELEASED"
}

export enum ManufacturingEventType {
  MATERIAL_ASSIGNED = "MATERIAL_ASSIGNED",
  BATCH_CREATED = "BATCH_CREATED",
  OPERATION_STARTED = "OPERATION_STARTED",
  OPERATION_COMPLETED = "OPERATION_COMPLETED",
  TOOL_CHANGED = "TOOL_CHANGED",
  FIXTURE_CHANGED = "FIXTURE_CHANGED",
  HEAT_TREATMENT_COMPLETED = "HEAT_TREATMENT_COMPLETED",
  INSPECTION_COMPLETED = "INSPECTION_COMPLETED",
  DEFECT_DETECTED = "DEFECT_DETECTED",
  REWORK_STARTED = "REWORK_STARTED",
  REWORK_COMPLETED = "REWORK_COMPLETED",
  SCRAPPED = "SCRAPPED",
  RELEASED = "RELEASED"
}

export interface ManufacturingEvent {
  eventId: string;
  eventType: ManufacturingEventType;
  partId: string;
  timestamp: string;
  payload?: any;
}

export interface ManufacturingStateTransition {
  transitionId: string;
  fromState: ManufacturingStateType;
  toState: ManufacturingStateType;
  eventId: string;
  processId: string;
  operatorOrSystem: string;
  timestamp: string;
  reason: string;
  evidenceReference?: string;
  authorization?: string;
  fingerprint: string;
}

export interface ManufacturingBatch {
  batchId: string;
  materialLot: string;
  processPlan: string;
  parts: string[];
  productionWindow: { start: string; end: string };
  equipment: string[];
  provenance: PropertyProvenance;
  revision: number;
}

export interface ManufacturingLot {
  lotId: string;
  batchId: string;
  materialLotId: string;
  partIds: string[];
}

export interface ManufacturingGenealogy {
  partId: string;
  rawMaterialId: string;
  stockId: string;
  blankId: string;
  operations: string[];
  heatTreatmentId?: string;
  machiningId?: string;
  surfaceTreatmentId?: string;
  inspectionId?: string;
}

export interface ManufacturingOperation {
  operationId: string;
  operationType: string;
  sequence: number;
  plannedParameters: Record<string, any>;
  actualParameters: Record<string, any>;
  machineId: string;
  toolId: string;
  fixtureId: string;
  startTime: string;
  endTime: string;
  operator: string;
  result: string;
  evidence: string;
}

export interface MachineState {
  machineId: string;
  machineRevision: number;
  operatingMode: string;
  spindleState?: string;
  thermalState?: string;
  calibrationState: "VALID" | "EXPIRED" | "NONE";
  maintenanceState: string;
  telemetryReference?: string;
}

export interface ToolState {
  toolId: string;
  toolType: string;
  geometry: Record<string, any>;
  material: string;
  revision: number;
  wearState: {
    measured?: number;
    inferred?: number;
    simulated?: number;
  };
  usageCount: number;
  cumulativeCuttingTime: number; // s
  inspectionState: string;
}

export interface FixtureState {
  fixtureId: string;
  configuration: string;
  clampingState: "SECURED" | "UNCLAMPED" | "UNKNOWN";
  locatingScheme: string;
  revision: number;
  inspectionStatus: string;
}

export interface ManufacturedGeometryState {
  nominalGeometry: string;
  actualGeometryReference?: string;
  geometricRevision: number;
  deviationReference?: string;
  coordinateSystem: string;
  toleranceState: string;
}

export interface GeometricDeviation {
  nominal: number;
  actual: number;
  deviation: number;
  tolerance: number;
  measurementMethod: string;
  uncertainty: number;
}

export interface DimensionalInspectionState {
  measurement: string;
  nominal: number;
  actual: number;
  deviation: number;
  tolerance: number;
  instrument: string;
  calibration: string;
  timestamp: string;
}

export interface SurfaceState {
  roughness?: {
    Ra: number; // um
    Rz: number; // um
  };
  waviness?: number;
  texture?: string;
  coating?: string;
  surfaceTreatment?: string;
  provenance: string;
}

export interface ManufacturingThermalState {
  temperatureHistory: { time: number; temperature: number }[];
  heatInput?: number;
  coolingHistory?: { time: number; temperature: number }[];
  thermalCycles?: any[];
  source: string;
  uncertainty: number;
}

export interface ResidualStressState {
  stressTensor?: number[][];
  location: string;
  coordinateSystem: string;
  measurementMethod: string;
  uncertainty: number;
  provenance: "MEASURED" | "SIMULATED" | "INFERRED" | "REFERENCE";
}

export interface DistortionState {
  displacement: number;
  deformation?: number;
  angularDistortion?: number;
  dimensionalShift?: number;
  source: string;
  uncertainty: number;
}

export interface ManufacturingDefectState {
  defectId: string;
  defectType: string;
  location: string;
  size: number;
  orientation: string;
  severity: number; // custom domain
  detectionMethod: string;
  confidence: number;
  provenance: string;
}

export interface ManufacturingInspectionState {
  inspectionId: string;
  method: string;
  instrument: string;
  calibration: string;
  result: "PASS" | "FAIL" | "CONDITIONAL";
  defectFindings: ManufacturingDefectState[];
  dimensionalFindings: DimensionalInspectionState[];
  materialFindings: any[];
  operator: string;
  evidence: string;
}

export interface ManufacturingQualityState {
  verdict: "PASS" | "FAIL" | "CONDITIONAL" | "INDETERMINATE" | "INVALID" | "NON_COMPLIANT";
  basis: string;
}

export interface ManufacturingStateSnapshot {
  snapshotId: string;
  stateId: string;
  revision: number;
  timestamp: string;
  hash: string;
}

export interface ManufacturingState {
  stateId: string;
  partId: string;
  batchId: string;
  lotId: string;
  materialId: string;
  materialRevision: number;
  stateType: ManufacturingStateType;
  parentStateId?: string;
  processHistory: ManufacturingOperation[];
  geometryState: ManufacturedGeometryState;
  materialCondition?: any; // Q&T or annealed from PATCH-096
  thermalState?: ManufacturingThermalState;
  microstructureState?: any; // from PATCH-096
  residualStressState?: ResidualStressState;
  distortionState?: DistortionState;
  surfaceState?: SurfaceState;
  defectState?: ManufacturingDefectState[];
  inspectionState?: ManufacturingInspectionState[];
  provenance: PropertyProvenance;
  revision: number;
  timestamp: string;
  fingerprint: string;
}
