/**
 * PATCH-SECP-058 — Manufacturing Execution & NC Post-Processing Core
 * Data structures and types for Machine Definitions, NC Dialects, Traceability,
 * Verification, and Deterministic Execution Packages.
 */

import { Vector3D } from '../cadKernel';
import { CutterLocationDataPackage } from '../cam/ToolpathTypes';

export type MachineAxisType = 'LINEAR' | 'ROTARY';

export interface MachineAxis {
  axisId: string;
  name: string; // X, Y, Z, A, B, C
  type: MachineAxisType;
  minLimit: number;
  maxLimit: number;
  maxSpeedMmMin: number; // or DegMin for rotary
  resolutionMm: number;  // or Deg for rotary
}

export interface SpindleCapability {
  maxRpm: number;
  minRpm: number;
  maxPowerKw: number;
  maxTorqueNm: number;
  supportedModes: ('DIRECT' | 'GEARED' | 'RIGID_TAPPING')[];
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
  pockets: Record<number, string>; // pocketNumber -> toolId
}

export type MachineCapabilityType = 
  | 'THREE_AXIS_MILLING'
  | 'FOUR_AXIS_MILLING'
  | 'FIVE_AXIS_MILLING'
  | 'PECK_DRILLING'
  | 'RIGID_TAPPING'
  | 'SWARF_CUTTING'
  | 'HIGH_SPEED_MACHINING';

export interface MachineDefinition {
  machineId: string;
  name: string;
  controllerId: 'FANUC' | 'SIEMENS' | 'HAAS' | 'HEIDENHAIN' | 'GENERIC_ISO';
  axes: MachineAxis[];
  spindle: SpindleCapability;
  envelope: MachineEnvelope;
  toolMagazine: ToolMagazine;
  capabilities: MachineCapabilityType[];
  provenanceHash: string;
}

export interface NCBlockProvenance {
  blockNumber: number;
  clMoveId: string;
  toolpathId: string;
  featureId?: string;
  topologyReference?: string;
  sourceRevision: string;
}

export interface NCBlock {
  blockNumber: number;
  gCodeLine: string;
  provenance: NCBlockProvenance;
}

export type NCValidationErrorType =
  | 'SYNTAX_ERROR'
  | 'UNSUPPORTED_COMMAND'
  | 'AXIS_LIMIT_VIOLATION'
  | 'FEED_LIMIT_VIOLATION'
  | 'SPINDLE_LIMIT_VIOLATION'
  | 'MISSING_TOOL_CHANGE'
  | 'INVALID_TOOL_REFERENCE'
  | 'IMPOSSIBLE_ROTARY_POSITION'
  | 'UNSAFE_RAPID_TRANSITION'
  | 'MALFORMED_BLOCK';

export interface NCValidationIssue {
  blockNumber: number;
  gCodeLine: string;
  issueType: NCValidationErrorType;
  description: string;
  severity: 'WARNING' | 'CRITICAL';
}

export interface NCVerificationReport {
  operationId: string;
  isValid: boolean;
  issues: NCValidationIssue[];
  checkedLinesCount: number;
  maxFeedRateUsedMmMin: number;
  maxSpindleRpmUsed: number;
  verifiedAt: string;
}

export interface ManufacturingExecutionPackage {
  packageId: string;
  verifiedCLData: CutterLocationDataPackage;
  machineDefinition: MachineDefinition;
  postProcessorVersion: string;
  controllerDialect: 'FANUC' | 'SIEMENS' | 'HAAS' | 'HEIDENHAIN' | 'GENERIC_ISO';
  ncProgram: string;
  ncBlocks: NCBlock[];
  verificationReport: NCVerificationReport;
  clDataHash: string;
  ncProgramHash: string;
  executionPackageHash: string;
  provenanceSignature: string;
  timestamp: string;
  revisionId: string;
}
