// PHASE 3 CONTRACT CHANGE: Post-processor enum and mode types widened
export type UnitsMode = 'MILLIMETERS' | 'INCHES' | 'METRIC_MM' | 'INCH_IN';
export type ActivePlane = 'G17' | 'G18' | 'G19' | 'G17_XY' | 'G18_ZX' | 'G19_YZ';
export type CoordinateSystemId = 'G54' | 'G55' | 'G56' | 'G57' | 'G58' | 'G59' | 'G54.1_P1';
export type CoolantState = 'OFF' | 'FLOOD' | 'MIST' | 'AIR_BLAST' | 'THROUGH_SPINDLE' | 'M9_OFF' | 'M8_FLOOD' | 'M7_MIST' | 'M88_THROUGH_SPINDLE';
export type ControllerDialect = 'FANUC' | 'HAAS' | 'HEIDENHAIN' | 'SIEMENS' | 'MAZAK' | 'GRBL' | 'FANUC_31I' | 'SIEMENS_840D' | 'HEIDENHAIN_TNC640' | 'HAAS_NGC';
export type AxisName = 'X' | 'Y' | 'Z' | 'A' | 'B' | 'C';
export type MotionMode = 'G0' | 'G1' | 'G2' | 'G3' | 'G0_RAPID' | 'G1_LINEAR' | 'G2_CW_ARC' | 'G3_CCW_ARC';
export type FeedMode = 'PER_MINUTE' | 'PER_REV' | 'G94_UNITS_PER_MIN' | 'G95_UNITS_PER_REV';
export type SpindleState = 'CW' | 'CCW' | 'OFF' | 'M3_CW' | 'M4_CCW' | 'M5_OFF';
export type CutterCompensationMode = 'OFF' | 'LEFT' | 'RIGHT' | 'G40_OFF' | 'G41_LEFT' | 'G42_RIGHT';
export type IREventType = 'MOTION' | 'SPINDLE' | 'COOLANT' | 'TOOL_CHANGE' | 'WORK_OFFSET' | 'COMMENT';

export interface AxisDefinition {
  name: AxisName;
  minLimitMm?: number;
  maxLimitMm?: number;
  maxVelocityMms?: number;
}

// PHASE 3 CONTRACT CHANGE: ModalState fields added
export interface ModalState {
  units: UnitsMode;
  plane: ActivePlane;
  wcs?: CoordinateSystemId;
  workOffset?: CoordinateSystemId;
  motion?: MotionMode;
  motionMode?: MotionMode;
  feedMode: FeedMode;
  spindle?: SpindleState;
  spindleState?: SpindleState;
  coolant?: CoolantState;
  coolantState?: CoolantState;
  cutterComp?: CutterCompensationMode;
  compensationMode?: CutterCompensationMode;
  feedRateMmMin?: number;
  currentFeedRate?: number;
  spindleRpm?: number;
  currentSpindleRpm?: number;
  activeToolId?: string;
  activeToolNumber?: number;
  activeToolHOffset?: number;
  activeToolDOffset?: number;
  rtcpActive?: boolean;
  currentPosition?: { x?: number; y?: number; z?: number; a?: number; b?: number; c?: number };
}

export interface IREvent {
  id: string;
  type: IREventType;
  sequence: number;
  params: Record<string, any>;
}

export interface NCIntermediateRepresentation {
  programId: string;
  events: IREvent[];
  initialState: ModalState;
}

export interface PostValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface PostProcessorDefinition { controllerDialect: string; postId: string; version: string; }
export interface PostConfiguration { units: string; selectedWorkOffset: string; configHash: string; }
export interface MachineDefinition {
  machineId: string;
  name?: string;
  manufacturer?: string;
  machineType?: string;
  controllerDialect?: string;
  defaultUnits?: string;
  axes?: Record<string, any>;
  spindle?: any;
  toolChanger?: {
    toolChangeTimeSec: number;
    capacity?: number;
    maxToolDiameterMm?: number;
    maxToolWeightKg?: number;
  };
  entityHash?: string;
}
export interface NCProgram {
  programId: string; programName: string; postProcessorId: string; postProcessorVersion: string;
  controllerDialect: string; machineId: string; units: string; blocks: any[]; rawGCodeText: string;
  totalLines: number; totalBlocks: number; estimatedCycleTimeSec: number; sourceMap: any;
  validationStatus: string; validationErrors: any[]; validationWarnings: any[]; ncProgramHash: string;
  configHash: string; timestamp: number; origin: string;
}
export interface NCBlock {}
export interface NCSourceMap { programId: string; entries: any[]; operationBlockRanges: any; mappingHash: string; }
export interface NCSourceMapEntry {
  ncLineIndex: number; blockSequence: number; gcodeLine: string; sourceOperationId: string;
  sourceOperationName: string; sourceToolpathSegmentId: string; toolSnapshotId: string; machinePose: any;
}
export interface PostProcessingEvidence {}

