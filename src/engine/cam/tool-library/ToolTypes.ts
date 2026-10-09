/**
 * SECP Industrial OS v3 — Real CAM Kernel
 * PATCH-261 — CAM Tool Library Core Types & Data Contracts
 * 
 * Single Source of Truth for tool identities, geometries, assemblies, 
 * cutting parameters, holder/machine compatibility, snapshots, versions, and validation.
 */

export type ToolUUID = string;

export type ToolCategory = 
  | 'MILLING'
  | 'HOLEMAKING'
  | 'THREADING'
  | 'TURNING'
  | 'SPECIAL';

export type ToolType = 
  | 'END_MILL'
  | 'BALL_END_MILL'
  | 'BULL_NOSE'
  | 'FACE_MILL'
  | 'DRILL'
  | 'REAMER'
  | 'CHAMFER_TOOL'
  | 'THREAD_MILL'
  | 'CUSTOM_TOOL';

export type ToolMaterial = 
  | 'CARBIDE'
  | 'HSS'
  | 'COBALT_HSS'
  | 'CERAMIC'
  | 'CBN'
  | 'PCD'
  | 'CERMET';

export type ToolCoating = 
  | 'UNCOATED'
  | 'TIALN'
  | 'ALCRN'
  | 'TIN'
  | 'TICN'
  | 'DIAMOND'
  | 'DLC'
  | 'ALTIN'
  | 'CRN'
  | 'NANO_COMPOSITE';

export type CornerGeometryType = 
  | 'SHARP'
  | 'RADIUS'
  | 'FULL_BALL'
  | 'CHAMFER_CORNER'
  | 'CONICAL_POINT'
  | 'CUSTOM_TIP';

export type CoolantMethod = 
  | 'FLOOD'
  | 'THROUGH_SPINDLE'
  | 'MIST'
  | 'AIR_BLAST'
  | 'CRYOGENIC'
  | 'DRY';

export type ParameterProvenance = 
  | 'MANUFACTURER_DATA'
  | 'ENGINEERING_DATABASE'
  | 'USER_DEFINED'
  | 'CALCULATED'
  | 'ESTIMATED';

export type WorkpieceMaterialClass = 
  | 'ISO_P_STEEL'
  | 'ISO_M_STAINLESS'
  | 'ISO_K_CAST_IRON'
  | 'ISO_N_NON_FERROUS'
  | 'ISO_S_HIGH_TEMP_ALLOY'
  | 'ISO_H_HARDENED_STEEL';

export type MaterialSuitability = 
  | 'OPTIMAL'
  | 'USABLE'
  | 'REDUCED_SPEED'
  | 'NOT_RECOMMENDED';

export type HolderInterfaceType = 
  | 'BT30'
  | 'BT40'
  | 'BT50'
  | 'HSK_A63'
  | 'HSK_E40'
  | 'HSK_A100'
  | 'CAT40'
  | 'CAT50'
  | 'SK40'
  | 'CAPTO_C6'
  | 'STRAIGHT_SHANK';

export type ClampingType = 
  | 'ER_COLLET'
  | 'SHRINK_FIT'
  | 'HYDRAULIC_CHUCK'
  | 'SIDE_LOCK_WELDON'
  | 'FACE_MILL_ARBOR'
  | 'DIRECT_COLLET';

export type ToolValidationStatus = 
  | 'TOOL_VALID'
  | 'TOOL_INVALID'
  | 'TOOL_GEOMETRY_INVALID'
  | 'TOOL_PARAMETER_INVALID'
  | 'TOOL_INCOMPATIBLE'
  | 'TOOL_VERSION_CONFLICT'
  | 'TOOL_DATA_INCOMPLETE';

export type ToolLifeClassification = 
  | 'NOMINAL'
  | 'ESTIMATED'
  | 'SENSOR_MEASURED'
  | 'MACHINE_REPORTED';

export type ToolAvailabilityStatus = 
  | 'AVAILABLE'
  | 'IN_USE'
  | 'MAINTENANCE'
  | 'MISSING'
  | 'RESERVED';

export type LibraryScope = 
  | 'GLOBAL'
  | 'PROJECT'
  | 'MACHINE_SPECIFIC';

export type ToolAuditEventType = 
  | 'TOOL_CREATED'
  | 'TOOL_UPDATED'
  | 'TOOL_VERSION_CREATED'
  | 'TOOL_ARCHIVED'
  | 'TOOL_RESTORED'
  | 'TOOL_IMPORTED'
  | 'TOOL_EXPORTED'
  | 'TOOL_SELECTED'
  | 'TOOL_ASSIGNED_TO_OPERATION'
  | 'TOOLPATH_TOOL_SNAPSHOT_CREATED'
  | 'TOOL_VALIDATION_STARTED'
  | 'TOOL_VALIDATION_COMPLETED'
  | 'TOOL_INVALIDATED';

export type CapabilityClassification = 
  | 'PROVEN'
  | 'PARTIAL'
  | 'UNPROVEN'
  | 'SIMULATED'
  | 'ABSENT';

// -------------------------------------------------------------
// Geometric & Dimensional Types
// -------------------------------------------------------------

export interface Vector2D {
  x: number;
  y: number;
}

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export interface DimensionWithTolerance {
  nominalMm: number;
  upperToleranceMm?: number;
  lowerToleranceMm?: number;
}

export interface ToolDimensions {
  cuttingDiameterMm: number;
  cuttingDiameterTolerance?: { upperMm: number; lowerMm: number };
  shankDiameterMm: number;
  overallLengthMm: number;
  cuttingLengthMm: number; // Flute length
  shoulderLengthMm: number;
  shoulderDiameterMm?: number;
  cornerRadiusMm?: number; // Bullnose or Chamfer
  tipAngleDeg?: number; // Drill (e.g. 118°), Chamfer (e.g. 90° or 60°)
  pilotDiameterMm?: number;
  pilotLengthMm?: number;
  fluteCount: number;
  helixAngleDeg?: number;
  taperAngleDeg?: number;
  threadPitchMm?: number; // For thread mills
  threadProfile?: string; // M, UN, G, NPT
  insertCount?: number; // For indexable face mills
  insertType?: string; // APKT, SEKN, RDMT, etc.
}

export interface CustomRevolvedPoint {
  radiusMm: number;
  heightMm: number; // Z-coordinate from tool tip (Z=0 at bottom tip)
}

export interface CustomToolDefinition {
  customToolId: string;
  name: string;
  revolvedProfile: CustomRevolvedPoint[]; // Monotonic increasing height
  meshTriangles?: number[][]; // Optional 3D representation
  cuttingZoneMaxZMm: number;
  shankZoneMinZMm: number;
}

export interface ToolGeometryModel {
  geometryHash: string; // SHA-256 deterministic hash
  type: ToolType;
  dimensions: ToolDimensions;
  cornerType: CornerGeometryType;
  customProfile?: CustomToolDefinition;
  boundingRadiusMm: number;
  totalLengthMm: number;
  fluteLengthMm: number;
  shankDiameterMm: number;
  silhouettePoints: Vector2D[]; // Revolved (r, z) pairs for swept volume
  cadMeshVertexCount: number;
  cadMeshTriangleCount: number;
}

// -------------------------------------------------------------
// Holder & Assembly
// -------------------------------------------------------------

export interface HolderProfileStep {
  diameterMm: number;
  lengthMm: number; // Step axial length
}

export interface ToolHolderDefinition {
  holderId: string;
  name: string;
  interfaceType: HolderInterfaceType;
  clampingType: ClampingType;
  gaugeLengthMm: number;
  upperDiameterMm: number;
  lowerDiameterMm: number;
  noseDiameterMm: number;
  clampingDiameterMinMm: number;
  clampingDiameterMaxMm: number;
  maxRpm: number;
  balanceGrade: string; // e.g. 'G2.5 @ 25000 RPM'
  coolantThrough: boolean;
  profileSteps: HolderProfileStep[];
  sha256Hash: string;
}

export interface ToolAssembly {
  assemblyId: string;
  name: string;
  toolUUID: string;
  toolVersion: string;
  holder: ToolHolderDefinition;
  stickOutMm: number; // Active extension from holder nose to tool tip
  gaugeLengthMm: number; // Holder gauge length + stickout
  effectiveLengthMm: number;
  runoutTirMm: number; // Total Indicated Runout at tip (e.g. 0.003 mm)
  weightKg: number;
  assemblyHash: string;
}

// -------------------------------------------------------------
// Cutting Parameters & Material Compatibility
// -------------------------------------------------------------

export interface ParameterRange {
  min: number;
  recommended: number;
  max: number;
}

export interface ToolCuttingParameters {
  materialClass: WorkpieceMaterialClass;
  specificAlloy?: string; // e.g. "Al 6061-T6", "AISI 4140"
  cuttingSpeedVcMMin: ParameterRange;
  spindleSpeedRpm: ParameterRange;
  feedPerToothFzMm: ParameterRange;
  feedRateVfMmMin: ParameterRange;
  axialDepthApMm: ParameterRange;
  radialDepthAeMm: ParameterRange;
  coolantRecommendation: CoolantMethod;
  provenance: ParameterProvenance;
  provenanceSource?: string; // e.g. "Sandvik Coromant CoroPlus v2024.2"
  validated: boolean;
  chipThinningEnabled: boolean;
}

export interface WorkpieceMaterialDefinition {
  materialId: string;
  materialName: string;
  materialClass: WorkpieceMaterialClass;
  densityGPerCm3: number;
  hardnessHRC?: number;
  hardnessHB?: number;
  tensileStrengthMPa?: number;
  machinabilityRatingPercent: number; // Baseline 100% (AISI 1212)
  specificCuttingForceKc1_1: number; // N/mm² at 1mm chip thickness
  cuttingForceSlopeZ: number; // Exponential slope mc
}

export interface ToolMaterialCompatibility {
  toolUUID: string;
  targetMaterialClass: WorkpieceMaterialClass;
  suitability: MaterialSuitability;
  recommendedParameters: ToolCuttingParameters;
  notes?: string;
}

// -------------------------------------------------------------
// Machine Compatibility
// -------------------------------------------------------------

export interface MachineToolCompatibility {
  spindleInterface: HolderInterfaceType;
  maxSpindleRpm: number;
  maxToolDiameterMm: number;
  maxToolLengthMm: number;
  maxToolWeightKg: number;
  allowThroughCoolant: boolean;
  atcMagazinePocketLimit?: number;
}

// -------------------------------------------------------------
// Core CAM Tool Entity
// -------------------------------------------------------------

export interface ToolVersionInfo {
  versionString: string; // e.g. "1.0.0", "1.1.0"
  revisionNumber: number;
  createdAtTimestamp: number;
  author: string;
  changeLog: string;
  versionHash: string;
  parentVersionHash?: string;
}

export interface ToolManufacturerMetadata {
  manufacturer: string;
  orderCode: string;
  catalogPage?: string;
  eclassCode?: string; // ISO 13399 standard
  iso13399Designation?: string;
  datasheetUrl?: string;
}

export interface ToolLifeMetadata {
  classification: ToolLifeClassification;
  nominalLifeMinutes: number;
  consumedLifeMinutes: number;
  wearStatePercent: number; // 0% = new, 100% = end of life
  lastMeasuredTimestamp?: number;
}

export interface CAMTool {
  toolUUID: ToolUUID;
  toolId: string; // Human-friendly ID (e.g. "T01", "EM-10-CRB-4F")
  name: string;
  type: ToolType;
  category: ToolCategory;
  version: ToolVersionInfo;
  geometry: ToolGeometryModel;
  material: ToolMaterial;
  coating: ToolCoating;
  coatingThicknessUm?: number;
  manufacturer?: ToolManufacturerMetadata;
  cuttingParameters: ToolCuttingParameters[];
  compatibleHolders: HolderInterfaceType[];
  defaultHolder?: ToolHolderDefinition;
  machineCompatibility?: MachineToolCompatibility;
  life?: ToolLifeMetadata;
  availability: ToolAvailabilityStatus;
  libraryScope: LibraryScope;
  projectId?: string;
  validationStatus: ToolValidationStatus;
  validationMessages: string[];
  isArchived: boolean;
  createdAt: number;
  updatedAt: number;
  entityHash: string;
}

// -------------------------------------------------------------
// Toolpath Snapshots & Change Invalidation
// -------------------------------------------------------------

export interface ToolSnapshot {
  snapshotId: string;
  toolUUID: ToolUUID;
  toolNumber?: number;
  toolVersion: string;
  toolName: string;
  toolType: ToolType;
  capturedAtTimestamp: number;
  geometryHash: string;
  snapshotHash: string;
  frozenTool: CAMTool;
  frozenAssembly?: ToolAssembly;
  assignedOperationId?: string;
  assignedOperationName?: string;
}

export interface ToolChangeInvalidationReport {
  toolUUID: ToolUUID;
  currentCatalogVersion: string;
  snapshotVersion: string;
  geometryChanged: boolean;
  dimensionsChanged: boolean;
  parametersChanged: boolean;
  holderChanged: boolean;
  invalidationRequired: boolean;
  affectedOperations: string[];
  invalidationReason?: string;
}

// -------------------------------------------------------------
// Audit Trail & Cryptographic Evidence
// -------------------------------------------------------------

export interface ToolAuditEvent {
  eventId: string;
  eventType: ToolAuditEventType;
  timestamp: number;
  toolUUID: ToolUUID;
  toolVersion: string;
  userId: string;
  details: Record<string, any>;
  sha256Digest: string;
}

export interface ToolEvidence {
  evidenceId: string;
  toolUUID: ToolUUID;
  toolVersion: string;
  toolName: string;
  toolType: ToolType;
  geometryHash: string;
  snapshotHash?: string;
  assemblyHash?: string;
  dimensionsSummary: {
    cuttingDiameterMm: number;
    shankDiameterMm: number;
    overallLengthMm: number;
    cuttingLengthMm: number;
    fluteCount: number;
    cornerRadiusMm?: number;
  };
  material: ToolMaterial;
  coating: ToolCoating;
  parametersSummary: {
    materialClass: WorkpieceMaterialClass;
    cuttingSpeedVc: number;
    spindleSpeedRpm: number;
    feedPerToothFz: number;
    feedRateVf: number;
    provenance: ParameterProvenance;
  };
  validationStatus: ToolValidationStatus;
  validationPassed: boolean;
  timestamp: number;
  engineVersion: string;
  provenanceChainSha256: string;
}

export interface ToolValidationResult {
  status: ToolValidationStatus;
  isValid: boolean;
  errors: string[];
  warnings: string[];
  validatedFields: string[];
  checkedAt: number;
}
