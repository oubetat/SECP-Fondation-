export type MachineCapabilityType = 
  | 'THREE_AXIS_MILLING'
  | 'FIVE_AXIS_MILLING'
  | 'PECK_DRILLING'
  | 'RIGID_TAPPING'
  | 'HIGH_SPEED_MACHINING'
  | 'TURNING'
  | 'WIRE_EDM';

export interface MachineAxis {
  axisId: string;
  name: string;
  type: 'LINEAR' | 'ROTARY';
  minLimit: number;
  maxLimit: number;
  maxSpeedMmMin: number;
  resolutionMm: number;
}

export interface SpindleCapability {
  maxRpm: number;
  minRpm: number;
  maxPowerKw: number;
  maxTorqueNm: number;
  supportedModes: string[];
}

export interface MachineEnvelope {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  zMin: number;
  zMax: number;
}

export interface ToolMagazine {
  capacity: number;
  maxToolDiameterMm: number;
  maxToolWeightKg: number;
  pockets: Record<number, string>;
}

export interface MachineDefinition {
  machineId: string;
  name: string;
  controllerId: 'HAAS' | 'FANUC' | 'SIEMENS' | 'HEIDENHAIN' | 'GENERIC_ISO';
  axes: MachineAxis[];
  spindle: SpindleCapability;
  envelope: MachineEnvelope;
  toolMagazine: ToolMagazine;
  capabilities: MachineCapabilityType[];
  provenanceHash: string;
}

export interface NCBlockProvenance {
  clMoveId: string;
  toolpathId: string;
  featureId: string;
  topologyReference: string;
  sourceRevision: string;
}

export interface NCBlock {
  blockNumber: number;
  gCodeLine: string;
  provenance: NCBlockProvenance;
}

export interface ManufacturingExecutionPackage {
  packageId: string;
  generatedAt: string;
  programName: string;
  machineId: string;
  blocksCount: number;
  ncProgram: string;
  blocks: NCBlock[];
  revisions: string[];
  merkleRoot: string;
  packageHash: string;
}
