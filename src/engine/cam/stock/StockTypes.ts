/**
 * SECP-260 — Stock Simulation Types & Core Interfaces
 * Defines all representations, states, geometries, engagement metrics,
 * coordinate systems, deviations, and cryptographic evidence for CAM Stock Simulation.
 */

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export function vec3(x: number, y: number, z: number): Vector3D {
  return { x, y, z };
}

export type StockGeometryType = 
  | 'BOUNDING_BOX' 
  | 'CYLINDRICAL' 
  | 'EXTRUDED' 
  | 'IMPORTED_SOLID' 
  | 'CUSTOM_BREP' 
  | 'MESH';

export type StockRepresentationType = 
  | 'BREP' 
  | 'VOXEL' 
  | 'OCTREE' 
  | 'DEXEL' 
  | 'MESH';

export type SimulationResolution = 
  | 'COARSE_PREVIEW' 
  | 'STANDARD' 
  | 'HIGH_RES_VERIFICATION';

export type StockStage = 
  | 'INITIAL' 
  | 'ROUGHING' 
  | 'SEMI_FINISHING' 
  | 'FINISHING' 
  | 'FINAL';

export type ToolCutterType = 
  | 'FLAT_ENDMILL' 
  | 'BALL_ENDMILL' 
  | 'BULLNOSE' 
  | 'DRILL' 
  | 'REAMER' 
  | 'CHAMFER';

export type MotionType = 
  | 'RAPID' 
  | 'LINEAR' 
  | 'CIRCULAR' 
  | 'FOUR_AXIS_ROTARY' 
  | 'FIVE_AXIS_SIMULTANEOUS';

export type EngagementContactType = 
  | 'AIR_CUT' 
  | 'SLOTTING' 
  | 'PERIPHERAL' 
  | 'PLUNGE' 
  | 'FACE_MILLING' 
  | 'OVER_ENGAGEMENT';

export type DeviationClassification = 
  | 'IN_TOLERANCE' 
  | 'REMAINING_MATERIAL' 
  | 'UNMACHINED' 
  | 'OVER_CUT' 
  | 'GOUGE';

export interface StockCoordinateSystem {
  origin: Vector3D;
  xAxis: Vector3D;
  yAxis: Vector3D;
  zAxis: Vector3D;
  matrix4x4: number[][]; // 4x4 homogenous transform matrix
}

export interface StockMaterialMetadata {
  materialId: string;
  materialName: string;
  densityGPerCm3: number;
  hardnessHRC?: number;
  machinabilityRatingPercent: number;
  specificCuttingForceKc1_1: number; // N/mm²
}

export interface StockBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

export interface StockDefinition {
  stockId: string;
  name: string;
  geometryType: StockGeometryType;
  dimensions: {
    lengthMm?: number;
    widthMm?: number;
    heightMm?: number;
    diameterMm?: number;
    polygonVertices?: [number, number][];
    extrusionHeightMm?: number;
    customMeshTriangles?: number[][];
  };
  bounds: StockBounds;
  coordinateSystem: StockCoordinateSystem;
  materialMetadata: StockMaterialMetadata;
  initialVolumeMm3: number;
  resolutionMm: number;
  toleranceMm: number;
  initialTransform?: number[][];
  fixtureId?: string;
  sha256Hash: string;
}

export interface ToolGeometry {
  toolId: string;
  name: string;
  cutterType: ToolCutterType;
  diameterMm: number;
  cornerRadMm: number; // For bullnose / toroidal
  fluteLengthMm: number;
  overallLengthMm: number;
  shankDiameterMm: number;
  tipAngleDeg?: number; // For drill / chamfer (e.g. 118° or 90°)
  fluteCount: number;
  sha256Hash: string;
}

export interface ToolPose {
  poseId: string;
  tcp: Vector3D; // Tool Center Point (X, Y, Z) in Work Coordinates
  toolAxis: Vector3D; // Normalized orientation vector (I, J, K)
  machineJoints?: {
    x: number;
    y: number;
    z: number;
    a?: number;
    b?: number;
    c?: number;
  };
  feedRateMmMin: number;
  spindleRpm: number;
  motionType: MotionType;
}

export interface ToolpathSegment {
  segmentIndex: number;
  operationId: string;
  operationName: string;
  stage: StockStage;
  startPose: ToolPose;
  endPose: ToolPose;
  tool: ToolGeometry;
  feedRateMmMin: number;
  spindleRpm: number;
  motionType: MotionType;
}

export interface SweptCutterVolume {
  segmentIndex: number;
  startPose: ToolPose;
  endPose: ToolPose;
  tool: ToolGeometry;
  boundingMin: Vector3D;
  boundingMax: Vector3D;
  subSegmentCount: number;
  sweptLengthMm: number;
}

export interface ToolEngagement {
  segmentIndex: number;
  axialDepthMm: number; // a_p
  radialEngagementMm: number; // a_e
  engagementAngleDeg: number; // theta_e
  contactType: EngagementContactType;
  instantaneousMRR_Cm3Min: number; // Material Removal Rate in cm³/min
  chipLoadMm: number; // Feed per tooth
  volumeRemovedInSegmentMm3: number;
}

export interface StockState {
  stateId: string;
  timestamp: number;
  segmentIndex: number;
  stage: StockStage;
  removedVolumeMm3: number;
  remainingVolumeMm3: number;
  initialVolumeMm3: number;
  percentRemoved: number;
  engagement: ToolEngagement;
  stockHash: string;
}

export interface StockCheckpoint {
  checkpointId: string;
  segmentIndex: number;
  stage: StockStage;
  timestamp: number;
  state: StockState;
  gridSnapshotRef: string; // Deterministic state reference
}

export interface TargetCadGeometry {
  cadId: string;
  name: string;
  bounds: StockBounds;
  targetVolumeMm3: number;
  triangles: {
    v0: Vector3D;
    v1: Vector3D;
    v2: Vector3D;
    normal: Vector3D;
  }[];
  sha256Hash: string;
}

export interface DeviationPoint {
  position: Vector3D;
  targetDistanceMm: number; // Signed distance: positive = remaining stock, negative = overcut/gouge
  targetNormal: Vector3D;
  classification: DeviationClassification;
}

export interface StockDeviationMap {
  comparisonId: string;
  timestamp: number;
  targetCadHash: string;
  finalStockHash: string;
  toleranceMm: number;
  totalSampleCount: number;
  inToleranceCount: number;
  remainingMaterialCount: number;
  overcutCount: number;
  gougeCount: number;
  maxPositiveDeviationMm: number; // Highest unmachined excess
  maxNegativeDeviationMm: number; // Deepest gouge
  averageDeviationMm: number;
  unmachinedVolumeMm3: number;
  overcutVolumeMm3: number;
  samples: DeviationPoint[];
}

export interface StockSimulationResult {
  simulationId: string;
  success: boolean;
  stockDefinition: StockDefinition;
  targetCad?: TargetCadGeometry;
  representationType: StockRepresentationType;
  resolution: SimulationResolution;
  resolutionMm: number;
  toleranceMm: number;
  totalSegments: number;
  simulatedSegments: number;
  initialVolumeMm3: number;
  finalRemainingVolumeMm3: number;
  totalRemovedVolumeMm3: number;
  airCutSegmentsCount: number;
  overcutSegmentsCount: number;
  gougeDetectedCount: number;
  timeline: StockState[];
  checkpoints: StockCheckpoint[];
  deviationMap?: StockDeviationMap;
  executionDurationMs: number;
  evidence: StockSimulationEvidence;
  diagnosticCodes: string[];
}

export interface StockSimulationEvidence {
  evidenceId: string;
  simulationId: string;
  timestamp: number;
  provenance: {
    stockDefinitionHash: string;
    targetCadHash: string;
    toolpathHash: string;
    toolLibraryHash: string;
    machineKinematicsHash: string;
  };
  metrics: {
    representationType: StockRepresentationType;
    resolutionMm: number;
    initialVolumeMm3: number;
    finalRemainingVolumeMm3: number;
    totalRemovedVolumeMm3: number;
    maxGougeDepthMm: number;
    maxRemainingExcessMm: number;
    unmachinedVolumeMm3: number;
    overcutVolumeMm3: number;
    airCutRatioPercent: number;
  };
  capabilitiesProven: {
    proven3AxisRemoval: boolean;
    proven4AxisRemoval: boolean;
    proven5AxisRemoval: boolean;
    provenContinuousSweptRemoval: boolean;
    provenDeterministicReplay: boolean;
    provenGougeDetection: boolean;
  };
  verdict: 'VERIFIED_TRUTH' | 'GOUGE_DETECTED' | 'INVALIDATED' | 'FAILED';
  sha256Digest: string;
  telemetryEvents: IndustrialOsTelemetryEvent[];
}

export interface IndustrialOsTelemetryEvent {
  eventId: string;
  type: 
    | 'STOCK_SIMULATION_STARTED'
    | 'STOCK_INITIALIZED'
    | 'TOOLPATH_SEGMENT_SIMULATED'
    | 'MATERIAL_REMOVED'
    | 'STOCK_STATE_UPDATED'
    | 'STOCK_CHECKPOINT_CREATED'
    | 'AIR_CUT_DETECTED'
    | 'OVER_CUT_DETECTED'
    | 'UNMACHINED_REGION_DETECTED'
    | 'STOCK_COMPARISON_STARTED'
    | 'STOCK_COMPARISON_COMPLETED'
    | 'STOCK_SIMULATION_COMPLETED'
    | 'STOCK_SIMULATION_FAILED'
    | 'STOCK_SIMULATION_INVALIDATED'
    | 'STOCK_EVIDENCE_GENERATED';
  timestamp: number;
  payload: Record<string, any>;
}

export enum StockSimulationDiagnosticCode {
  INVALID_STOCK = 'INVALID_STOCK',
  INVALID_TOOL = 'INVALID_TOOL',
  INVALID_TOOLPATH = 'INVALID_TOOLPATH',
  INVALID_TARGET_GEOMETRY = 'INVALID_TARGET_GEOMETRY',
  UNSUPPORTED_STOCK_REPRESENTATION = 'UNSUPPORTED_STOCK_REPRESENTATION',
  STOCK_TRANSFORM_INVALID = 'STOCK_TRANSFORM_INVALID',
  TOOL_POSE_INVALID = 'TOOL_POSE_INVALID',
  STOCK_UPDATE_FAILED = 'STOCK_UPDATE_FAILED',
  SWEPT_CUTTER_FAILURE = 'SWEPT_CUTTER_FAILURE',
  STOCK_MESH_INVALID = 'STOCK_MESH_INVALID',
  STOCK_TO_TARGET_COMPARISON_FAILED = 'STOCK_TO_TARGET_COMPARISON_FAILED',
  OVER_CUT_DETECTED = 'OVER_CUT_DETECTED',
  UNMACHINED_MATERIAL_DETECTED = 'UNMACHINED_MATERIAL_DETECTED',
  SIMULATION_INCOMPLETE = 'SIMULATION_INCOMPLETE',
  SIMULATION_INVALIDATED = 'SIMULATION_INVALIDATED'
}
